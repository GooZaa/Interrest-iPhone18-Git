begin;

create extension if not exists pgcrypto;

alter table public.reservations
  add column if not exists submission_id uuid,
  add column if not exists submission_device_index integer;

create unique index if not exists reservations_submission_device_uidx
  on public.reservations (submission_id, submission_device_index)
  where submission_id is not null;

create index if not exists reservations_customer_duplicate_lookup_idx
  on public.reservations (phone, source, booked_at desc);

create table if not exists public.batch_operations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  action text not null check (action in ('arrived', 'appointment', 'call', 'note', 'done')),
  actor text not null default 'Staff',
  payload jsonb not null default '{}'::jsonb,
  item_count integer not null default 0,
  success_count integer not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.batch_operation_items (
  operation_id uuid not null references public.batch_operations(id) on delete cascade,
  reservation_id text not null references public.reservations(id) on delete restrict,
  previous_status text,
  new_status text,
  created_at timestamptz not null default now(),
  primary key (operation_id, reservation_id)
);

alter table public.batch_operations enable row level security;
alter table public.batch_operation_items enable row level security;

create or replace function public.perform_batch_action(
  p_request_id uuid,
  p_action text,
  p_ids text[],
  p_payload jsonb default '{}'::jsonb,
  p_actor text default 'Staff'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operation_id uuid;
  v_ids text[];
  v_requested_count integer;
  v_found_count integer;
  v_invalid_count integer;
  v_now timestamptz := now();
  v_days integer := 3;
  v_due_date date;
  v_appt timestamptz;
  v_note text;
  v_call_result text;
  v_call_label text;
begin
  if p_request_id is null then
    raise exception 'ไม่พบ Request ID';
  end if;
  if p_action not in ('arrived', 'appointment', 'call', 'note', 'done') then
    raise exception 'ไม่รองรับคำสั่งนี้';
  end if;

  select array_agg(distinct item order by item)
    into v_ids
  from unnest(coalesce(p_ids, array[]::text[])) as u(item)
  where nullif(btrim(item), '') is not null;

  v_requested_count := coalesce(array_length(v_ids, 1), 0);
  if v_requested_count = 0 then
    raise exception 'กรุณาเลือกอย่างน้อย 1 รายการ';
  end if;
  if v_requested_count > 100 then
    raise exception 'ทำรายการได้สูงสุดครั้งละ 100 รายการ';
  end if;

  insert into public.batch_operations(request_id, action, actor, payload, item_count)
  values (p_request_id, p_action, left(coalesce(nullif(btrim(p_actor), ''), 'Staff'), 120), coalesce(p_payload, '{}'::jsonb), v_requested_count)
  on conflict (request_id) do nothing
  returning id into v_operation_id;

  if v_operation_id is null then
    select id into v_operation_id from public.batch_operations where request_id = p_request_id;
    return jsonb_build_object(
      'ok', true,
      'replayed', true,
      'operationId', v_operation_id,
      'count', (select success_count from public.batch_operations where id = v_operation_id)
    );
  end if;

  perform 1 from public.reservations where id = any(v_ids) for update;
  select count(*) into v_found_count from public.reservations where id = any(v_ids);
  if v_found_count <> v_requested_count then
    raise exception 'พบรายการ % จาก % รายการ กรุณาโหลดข้อมูลใหม่', v_found_count, v_requested_count;
  end if;

  if p_action = 'arrived' then
    select count(*) into v_invalid_count from public.reservations where id = any(v_ids) and status is distinct from 'รอสินค้า';
    if v_invalid_count > 0 then
      raise exception 'สินค้าเข้าได้เฉพาะรายการสถานะ รอสินค้า (% รายการไม่ตรงเงื่อนไข)', v_invalid_count;
    end if;
  elsif p_action = 'appointment' then
    select count(*) into v_invalid_count from public.reservations where id = any(v_ids) and status not in ('ของมาแล้ว', 'นัดรับแล้ว');
    if v_invalid_count > 0 then
      raise exception 'ตั้งวันนัดได้เฉพาะรายการสถานะ ของมาแล้ว หรือ นัดรับแล้ว (% รายการไม่ตรงเงื่อนไข)', v_invalid_count;
    end if;
    begin
      v_appt := (p_payload->>'appointment_at')::timestamptz;
    exception when others then
      raise exception 'วันและเวลานัดรับไม่ถูกต้อง';
    end;
    if v_appt is null then raise exception 'กรุณาระบุวันและเวลานัดรับ'; end if;
  elsif p_action = 'call' then
    select count(*) into v_invalid_count from public.reservations where id = any(v_ids) and status in ('รับของแล้ว', 'ยกเลิก');
    if v_invalid_count > 0 then
      raise exception 'บันทึกผลการโทรไม่ได้กับรายการที่ปิดแล้ว (% รายการ)', v_invalid_count;
    end if;
    v_call_result := nullif(btrim(p_payload->>'call_result'), '');
    if v_call_result is null then raise exception 'กรุณาระบุผลการโทร'; end if;
    if v_call_result not in ('busy', 'no_answer', 'notified', 'ok', 'other') then raise exception 'ผลการโทรไม่ถูกต้อง'; end if;
  elsif p_action = 'note' then
    v_note := nullif(btrim(p_payload->>'note'), '');
    if v_note is null then raise exception 'กรุณาระบุหมายเหตุ'; end if;
    if length(v_note) > 1000 then raise exception 'หมายเหตุต้องไม่เกิน 1,000 ตัวอักษร'; end if;
  elsif p_action = 'done' then
    select count(*) into v_invalid_count from public.reservations where id = any(v_ids) and status is distinct from 'นัดรับแล้ว';
    if v_invalid_count > 0 then
      raise exception 'รับสินค้าได้เฉพาะรายการสถานะ นัดรับแล้ว (% รายการไม่ตรงเงื่อนไข)', v_invalid_count;
    end if;
  end if;

  insert into public.batch_operation_items(operation_id, reservation_id, previous_status, new_status)
  select v_operation_id, id, status,
    case p_action
      when 'arrived' then 'ของมาแล้ว'
      when 'appointment' then 'นัดรับแล้ว'
      when 'done' then 'รับของแล้ว'
      else status
    end
  from public.reservations where id = any(v_ids);

  if p_action = 'arrived' then
    select case when value ~ '^\d+$' then value::integer else 3 end into v_days
      from public.system_configs where key = 'วันครบกำหนดเริ่มต้น' limit 1;
    v_days := coalesce(v_days, 3);
    v_due_date := (v_now at time zone 'Asia/Bangkok')::date + v_days;
    update public.reservations set status = 'ของมาแล้ว', due_date = v_due_date, updated_at = v_now where id = any(v_ids);
    v_note := 'จัดการหลายรายการ: เปลี่ยนสถานะเป็น ของมาแล้ว (กำหนดรับภายใน ' || v_days || ' วัน)';
  elsif p_action = 'appointment' then
    select case when value ~ '^\d+$' then value::integer else 3 end into v_days
      from public.system_configs where key = 'วันครบกำหนดหลังนัด' limit 1;
    v_days := coalesce(v_days, 3);
    v_due_date := (v_appt at time zone 'Asia/Bangkok')::date + v_days;
    update public.reservations
      set status = 'นัดรับแล้ว', appointment_at = v_appt, due_date = v_due_date,
          reschedule_count = coalesce(reschedule_count, 0) + case when status = 'นัดรับแล้ว' and appointment_at is not null then 1 else 0 end,
          updated_at = v_now
      where id = any(v_ids);
    v_note := 'จัดการหลายรายการ: นัดรับสินค้า ' || to_char(v_appt at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI') || ' · ครบกำหนดรับ ' || to_char(v_due_date, 'DD/MM/YYYY');
  elsif p_action = 'call' then
    v_call_label := case v_call_result
      when 'busy' then 'ติดต่อไม่ได้'
      when 'no_answer' then 'ลูกค้าไม่รับสาย'
      when 'notified' then 'แจ้งลูกค้าแล้ว'
      when 'ok' then 'ยืนยันนัดรับตามเดิม'
      else 'อื่นๆ'
    end;
    update public.reservations set call_count = coalesce(call_count, 0) + 1, last_called_at = v_now, updated_at = v_now where id = any(v_ids);
    v_note := 'จัดการหลายรายการ: บันทึกผลการโทร · ' || v_call_label || case when nullif(btrim(p_payload->>'note'), '') is not null then ' — ' || btrim(p_payload->>'note') else '' end;
  elsif p_action = 'note' then
    update public.reservations set updated_at = v_now where id = any(v_ids);
    v_note := 'จัดการหลายรายการ: ' || v_note;
  elsif p_action = 'done' then
    update public.reservations set status = 'รับของแล้ว', updated_at = v_now where id = any(v_ids);
    v_note := 'จัดการหลายรายการ: ยืนยันว่าลูกค้ารับสินค้าแล้ว · ส่งมอบเรียบร้อย (ปิดรายการ)';
  end if;

  insert into public.notes(reservation_id, author, message, source, created_at)
  select id, left(coalesce(nullif(btrim(p_actor), ''), 'Staff'), 120), v_note, 'manual', v_now
  from public.reservations where id = any(v_ids);

  update public.batch_operations set success_count = v_requested_count, completed_at = now() where id = v_operation_id;

  return jsonb_build_object('ok', true, 'replayed', false, 'operationId', v_operation_id, 'count', v_requested_count);
end;
$$;

revoke all on function public.perform_batch_action(uuid, text, text[], jsonb, text) from public;
grant execute on function public.perform_batch_action(uuid, text, text[], jsonb, text) to anon, authenticated;

commit;
