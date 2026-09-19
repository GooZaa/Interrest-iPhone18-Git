begin;

-- Keep intentional multi-device bookings possible, but require the customer's
-- explicit acknowledgement for an identical device already in the queue.
alter table public.reservations
  add column if not exists duplicate_confirmed boolean not null default false;

create or replace function public.guard_customer_signup_row()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source is distinct from 'customer' then
    return new;
  end if;

  new.phone := regexp_replace(coalesce(new.phone, ''), '[^0-9]', '', 'g');
  if length(new.phone) < 9 or length(new.phone) > 15
     or nullif(btrim(new.customer_name), '') is null
     or nullif(btrim(new.model), '') is null
     or nullif(btrim(new.capacity), '') is null
     or nullif(btrim(new.color), '') is null
     or new.submission_id is null
     or new.submission_device_index is null
     or new.submission_device_index not between 1 and 20 then
    raise exception 'ข้อมูลลงชื่อไม่ครบหรือไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่';
  end if;

  -- Serialize simultaneous submissions for the same phone before the
  -- statement-level duplicate check runs.
  perform pg_advisory_xact_lock(hashtextextended(new.phone, 0));
  return new;
end;
$$;

drop trigger if exists guard_customer_signup_row_trigger on public.reservations;
create trigger guard_customer_signup_row_trigger
before insert on public.reservations
for each row execute function public.guard_customer_signup_row();

create or replace function public.guard_customer_signup_statement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from inserted_customer_rows n
    where n.source = 'customer'
      and (
        select count(*) from public.reservations r
        where r.submission_id = n.submission_id and r.source = 'customer'
      ) > 20
  ) then
    raise exception 'ลงทะเบียนได้สูงสุดครั้งละ 20 เครื่อง';
  end if;

  if exists (
    select 1
    from inserted_customer_rows n
    join public.reservations r
      on r.phone = n.phone and r.id <> n.id
     and lower(btrim(r.model)) = lower(btrim(n.model))
     and lower(btrim(r.capacity)) = lower(btrim(n.capacity))
     and lower(btrim(r.color)) = lower(btrim(n.color))
    where n.source = 'customer'
      and n.duplicate_confirmed is not true
      and (
        r.submission_id = n.submission_id
        or r.status in ('รอตรวจสอบ', 'รอสินค้า', 'ของมาแล้ว', 'นัดรับแล้ว')
        or (r.source = 'customer' and r.booked_at >= now() - interval '15 minutes' and r.status is distinct from 'ยกเลิก')
      )
  ) then
    raise exception 'DUPLICATE_CONFIRM_REQUIRED';
  end if;

  return null;
end;
$$;

drop trigger if exists guard_customer_signup_statement_trigger on public.reservations;
create trigger guard_customer_signup_statement_trigger
after insert on public.reservations
referencing new table as inserted_customer_rows
for each statement execute function public.guard_customer_signup_statement();

commit;
