// API Bridge for Supabase (Full Implementation)
(function(window) {
  const SUPABASE_URL = 'https://qunbulmqtgeqsaiabkjq.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bmJ1bG1xdGdlcXNhaWFia2pxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0NzcxMDgsImV4cCI6MjEwNTA1MzEwOH0.bCGIwxUjSfogLmqDoGrm6u6Zo736KoElADOC5jMpxos';

  function sb() {
    if (window.supabaseClient) return window.supabaseClient;
    if (typeof window.getSupabaseClient === 'function') {
      const client = window.getSupabaseClient();
      if (client) return client;
    }
    const sbLib = window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
    if (sbLib && typeof sbLib.createClient === 'function') {
      window.supabaseClient = sbLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return window.supabaseClient;
    }
    throw new Error('ไม่สามารถเชื่อมต่อกับฐานข้อมูล Supabase ได้ (กรุณารีเฟรชหน้าเว็บ)');
  }

  function normPhone(p) {
    return String(p || '').replace(/\D/g, '');
  }

  function genShortId() {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const rand = String(Math.floor(1000 + Math.random() * 9000));
    return 'R' + yy + mm + dd + '-' + rand;
  }

  function genToken() {
    return Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  function maskName(name) {
    if (!name) return '***';
    const parts = name.trim().split(/\s+/);
    return parts.map(p => {
      if (p.length <= 2) return p[0] + '*';
      return p[0] + '*'.repeat(p.length - 2) + p[p.length - 1];
    }).join(' ');
  }

  function maskPhone(phone) {
    const digits = normPhone(phone);
    if (digits.length < 9) return '***';
    return digits.slice(0, 3) + '-xxx-' + digits.slice(-4);
  }

  function fmtDate(d) {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return String(d);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  function fmtDay(d) {
    if (!d) return '';
    const date = new Date(d);
    if (isNaN(date.getTime())) return String(d);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function bangkokDateKey(value) {
    const date = value instanceof Date ? value : new Date(value || Date.now());
    if (isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const values = {};
    parts.forEach(part => { values[part.type] = part.value; });
    return `${values.year}-${values.month}-${values.day}`;
  }

  function validatedAppointmentDate(value) {
    const date = new Date(value);
    if (isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      throw new Error('กรุณาเลือกวันและเวลานัดรับในอนาคต');
    }
    const timeParts = {};
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).forEach(part => { timeParts[part.type] = part.value; });
    const hour = Number(timeParts.hour);
    const minute = Number(timeParts.minute);
    if (hour < 11 || hour > 20 || (minute !== 0 && minute !== 30) || (hour === 20 && minute !== 0)) {
      throw new Error('เวลานัดรับต้องอยู่ระหว่าง 11:00–20:00 น. โดยเลือกทุก 30 นาที');
    }
    return date;
  }

  function bangkokDayBounds(value) {
    const key = bangkokDateKey(value);
    const parts = key.split('-').map(Number);
    const start = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]) - (7 * 60 * 60 * 1000));
    return {
      key: key,
      start: start.toISOString(),
      end: new Date(start.getTime() + (24 * 60 * 60 * 1000) - 1).toISOString()
    };
  }

  function fmtAppt(r) {
    if (!r) return '';
    if (r.appointment_at) return fmtDate(r.appointment_at);
    if (r.appointment_time) {
      return typeof fmtDateTime === 'function' ? fmtDateTime(r.appointment_time) : (typeof fmtDate === 'function' ? fmtDate(r.appointment_time) : String(r.appointment_time));
    }
    return '';
  }

  function daysBetween(a, b) {
    return Math.floor((b - a) / (1000 * 60 * 60 * 24));
  }

  function parsePriceMap(text) {
    const map = {};
    String(text || '').split(',').forEach(part => {
      const eq = part.indexOf('=');
      if (eq === -1) return;
      const cap = part.slice(0, eq).trim();
      const price = part.slice(eq + 1).replace(/[, ]/g, '').trim();
      if (cap && /^\d+$/.test(price)) map[cap] = Number(price);
    });
    return map;
  }

  function isSettingEnabled(v, defaultVal) {
    if (v === undefined || v === null || v === '') return defaultVal !== undefined ? defaultVal : true;
    if (typeof v === 'boolean') return v;
    const s = String(v).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }

  function isPreOrderGroup(value) {
    return String(value || '').trim().toLowerCase().indexOf('pre-order') !== -1;
  }

  function requirePreOrderNumber(group, value) {
    const preOrder = String(value || '').trim();
    if (isPreOrderGroup(group) && !preOrder) {
      throw new Error('กลุ่ม Pre-Order ต้องระบุเลข Pre-Order ก่อนบันทึก');
    }
    return preOrder;
  }

  function extractPreOrder(row) {
    if (!row || typeof row !== 'object') return '';
    let po = row.pre_order_no || row.pre_order || row.preorder || row.preorder_no || row.pre_order_id || row.order_no || row.po_no || row['เลขPreOrder'] || row['เลข Pre-Order'] || '';
    if (!po) {
      for (const k of Object.keys(row)) {
        const kl = k.toLowerCase().replace(/[\s\-_]/g, '');
        if ((kl.indexOf('preorder') !== -1 || kl.indexOf('พรี') !== -1 || kl.indexOf('ใบจอง') !== -1) && row[k]) {
          po = String(row[k]);
          break;
        }
      }
    }
    return String(po || '').trim();
  }


  function optFirst(a, b) {
    return (typeof a === 'string' && (a.startsWith('staff_') || a === 'logged_in')) ? b : a;
  }

  function getCheckUrl(token) {
    try {
      return new URL('check?t=' + encodeURIComponent(token), window.location.href).href;
    } catch (e) {
      return window.location.origin + '/check?t=' + encodeURIComponent(token);
    }
  }

  function parseBookingDate(r) {
    if (r.booked_at) return new Date(r.booked_at);
    if (r.created_at) return new Date(r.created_at);
    if (r.id && /^R\d{6}/.test(r.id)) {
      const y = 2000 + parseInt(r.id.slice(1, 3), 10);
      const m = parseInt(r.id.slice(3, 5), 10) - 1;
      const d = parseInt(r.id.slice(5, 7), 10);
      return new Date(y, m, d);
    }
    return null;
  }

  function mapReservation(r) {
    const bookedDate = parseBookingDate(r);
    const waitDays = (bookedDate && !isNaN(bookedDate.getTime())) ? Math.max(0, daysBetween(bookedDate, new Date())) : 0;
    let dueLabel = '';
    if (r.due_date) {
      const d = daysBetween(new Date(), new Date(r.due_date));
      if (d < 0) dueLabel = 'เลย ' + Math.abs(d) + ' วัน';
      else if (d === 0) dueLabel = 'ครบกำหนดวันนี้';
      else dueLabel = 'อีก ' + d + ' วัน';
    }
    const updateRaw = r.updated_at || r.booked_at || r.created_at;
    let updatedAt = '';
    if (updateRaw) {
      updatedAt = fmtDay(updateRaw);
    } else if (bookedDate && !isNaN(bookedDate.getTime())) {
      updatedAt = fmtDay(bookedDate);
    }
    const createdRaw = r.booked_at || r.created_at;
    let createdAt = '';
    if (createdRaw) {
      createdAt = fmtDate(createdRaw);
    } else if (bookedDate && !isNaN(bookedDate.getTime())) {
      createdAt = fmtDay(bookedDate);
    }
    return {
      id: r.id,
      name: r.customer_name,
      phone: r.phone,
      group: r.customer_group,
      model: r.model,
      capacity: r.capacity,
      color: r.color,
      status: r.status,
      displayStatus: r.status,
      rawStatus: r.status,
      dueDate: r.due_date ? fmtDay(r.due_date) : '',
      dueLabel: dueLabel,
      appt: fmtAppt(r),
      waitDays: waitDays,
      callCount: r.call_count || 0,
      urgent: !!r.is_urgent,
      isUrgent: !!r.is_urgent,
      urgentReason: r.urgent_reason,
      isLabeled: r.is_labeled,
      deposit: r.deposit,
      billNo: r.bill_no,
      token: r.token,
      checkUrl: getCheckUrl(r.token),
      preOrder: extractPreOrder(r),
      preBooking: r.pre_booking_no || '',
      supplierLock: !!r.lock_supplier,
      lockSupplier: !!r.lock_supplier,
      supplier: r.specified_supplier,
      promo: r.campaign,
      updatedAt: updatedAt,
      createdAt: createdAt,
      bookedAt: createdAt
    };
  }

  function reportFilterRows(rows, filter) {
    const f = filter || {};
    return (rows || []).filter(r => {
      if (f.group && r.customer_group !== f.group) return false;
      if (f.model && r.model !== f.model) return false;
      return true;
    });
  }

  function reportActionItem(row, reason, severity) {
    return Object.assign(mapReservation(row), {
      reason: reason || row.status || '',
      severity: severity || 'medium'
    });
  }

  function buildReportActions(rows, options) {
    const opts = options || {};
    const todayBounds = bangkokDayBounds(opts.now);
    const today = todayBounds.key;
    const waitLongDays = Number(opts.waitLongDays) || 14;
    const callAlertThreshold = Number(opts.callAlertThreshold) || 3;
    const knownStatuses = ['รอตรวจสอบ', 'รอสินค้า', 'ของมาแล้ว', 'นัดรับแล้ว', 'รับของแล้ว', 'ยกเลิก'];
    const activeContactStatuses = ['ของมาแล้ว', 'นัดรับแล้ว'];
    const activeStatuses = ['รอตรวจสอบ', 'รอสินค้า', 'ของมาแล้ว', 'นัดรับแล้ว'];

    const overdue = [], todayItems = [], noCall = [], waitLong = [], manyFails = [], quality = [];
    (rows || []).forEach(r => {
      const dueKey = r.due_date ? String(r.due_date).slice(0, 10) : '';
      const appointment = r.appointment_at ? new Date(r.appointment_at) : null;
      const appointmentValid = appointment && !isNaN(appointment.getTime());
      const appointmentKey = appointmentValid ? bangkokDateKey(appointment) : '';
      const isOverdue = (r.status === 'ของมาแล้ว' && dueKey && dueKey < today) ||
        (r.status === 'นัดรับแล้ว' && appointmentValid && appointment < new Date(todayBounds.start));

      if (isOverdue) {
        const reason = r.status === 'นัดรับแล้ว' ? 'เลยวันนัดรับสินค้า' : 'เลยวันครบกำหนดรับ';
        overdue.push(reportActionItem(r, reason, 'high'));
      }
      if (r.status === 'นัดรับแล้ว' && appointmentKey === today) {
        todayItems.push(reportActionItem(r, 'นัดรับสินค้า ' + fmtAppt(r), 'medium'));
      }
      if (activeContactStatuses.includes(r.status) && !(Number(r.call_count) || 0)) {
        noCall.push(reportActionItem(r, 'ของพร้อมแล้ว แต่ยังไม่มีบันทึกการโทร', 'medium'));
      }
      if (r.status === 'รอสินค้า') {
        const booked = parseBookingDate(r);
        const waitDays = booked && !isNaN(booked.getTime()) ? Math.max(0, daysBetween(booked, new Date())) : 0;
        if (waitDays >= waitLongDays) waitLong.push(reportActionItem(r, 'รอสินค้า ' + waitDays + ' วัน', 'medium'));
      }
      if (activeStatuses.includes(r.status) && (Number(r.call_count) || 0) >= callAlertThreshold) {
        manyFails.push(reportActionItem(r, 'บันทึกการโทรแล้ว ' + (Number(r.call_count) || 0) + ' ครั้ง', 'medium'));
      }

      const issues = [];
      if (!knownStatuses.includes(r.status)) issues.push('สถานะไม่อยู่ในระบบ');
      if (!r.customer_name || !r.phone) issues.push('ชื่อลูกค้าหรือเบอร์ติดต่อไม่ครบ');
      if (!r.model || !r.capacity || !r.color) issues.push('ข้อมูลสินค้าไม่ครบ');
      if (isPreOrderGroup(r.customer_group) && !extractPreOrder(r)) issues.push('ยังไม่มีเลข Pre-Order');
      if ((Number(r.deposit) || 0) > 0 && !String(r.bill_no || '').trim()) issues.push('มีมัดจำแต่ไม่มีเลขบิล');
      if (r.status === 'นัดรับแล้ว' && !appointmentValid) issues.push('สถานะนัดรับแล้วแต่ไม่มีวันนัดรับ');
      if (issues.length) quality.push(reportActionItem(r, issues.join(' · '), 'high'));
    });

    const sortByAppointment = (a, b) => String(a.appt || a.dueDate || '').localeCompare(String(b.appt || b.dueDate || ''));
    overdue.sort(sortByAppointment);
    todayItems.sort(sortByAppointment);
    waitLong.sort((a, b) => (b.waitDays || 0) - (a.waitDays || 0));
    manyFails.sort((a, b) => (b.callCount || 0) - (a.callCount || 0));
    return { overdue: overdue, today: todayItems, noCall: noCall, waitLong: waitLong, manyFails: manyFails, quality: quality };
  }

  const api = {
    // -------------------------------------------------------------
    // SIGNUP
    // -------------------------------------------------------------
    async getSignupBootstrap() {
      const [prodsRes, promosRes, cfgRes] = await Promise.all([
        sb().from('products').select('*').eq('is_active', true),
        sb().from('discount_campaigns').select('*').eq('is_active', true),
        sb().from('system_configs').select('*')
      ]);

      const products = (prodsRes.data || []).map(p => ({
        model: p.model,
        capacities: (p.capacities || '').split(',').map(s => s.trim()).filter(Boolean),
        colors: (p.colors || '').split(',').map(s => s.trim()).filter(Boolean),
        prices: parsePriceMap(p.prices)
      }));

      const configs = {};
      (cfgRes.data || []).forEach(c => { configs[c.key] = c.value; });

      const n1 = Math.floor(Math.random() * 12) + 2;
      const n2 = Math.floor(Math.random() * 9) + 1;
      window._currentSignupCaptcha = { sid: 'cap_' + Date.now(), a: n1, b: n2, ans: n1 + n2 };
      return {
        products: products,
        promos: (promosRes.data || []).map(pr => ({ name: pr.name, description: pr.description })),
        supplierLockEnabled: isSettingEnabled(configs['ล็อกซัพ'], true),
        aisThaiOnly: isSettingEnabled(configs['โครงการ AIS เฉพาะภาษาไทย'], false),
        aisPromoThaiOnly: isSettingEnabled(configs['โครงการ AIS เฉพาะภาษาไทย'], false),
        alternativeOptionsEnabled: isSettingEnabled(configs['เปิดใช้ตัวเลือกเครื่องทางเลือก'], true),
        captcha: { sid: window._currentSignupCaptcha.sid, a: n1, b: n2, q: `${n1} + ${n2} = ?`, ans: n1 + n2, answer: n1 + n2 }
      };
    },

    async checkSignupPhone(sid, phone) {
      const clean = normPhone(phone);
      if (clean.length < 9) return { state: 'new' };

      const { data: activeRes } = await sb()
        .from('reservations')
        .select('id')
        .eq('phone', clean)
        .in('status', ['รอตรวจสอบ', 'รอสินค้า', 'ของมาแล้ว', 'นัดรับแล้ว'])
        .limit(1);

      if (activeRes && activeRes.length > 0) return { state: 'active' };

      const { data: cust } = await sb().from('customers').select('phone').eq('phone', clean).limit(1);
      if (cust && cust.length > 0) return { state: 'known' };

      return { state: 'new' };
    },

    async submitSignup(data) {
      if (!data || !data.name || !data.phone || !data.devices || !data.devices.length) throw new Error('ข้อมูลไม่ครบถ้วน');
      if (data.devices.length > 20) throw new Error('ลงทะเบียนได้สูงสุดครั้งละ 20 เครื่อง');
      if (window._currentSignupCaptcha) {
        const expected = String(window._currentSignupCaptcha.ans);
        const given = String(data.captchaAnswer || '').trim();
        if (given !== expected) {
          throw new Error('คำตอบไม่ถูกต้อง กรุณาลองใหม่');
        }
      }
      const cleanPhone = normPhone(data.phone);
      const name = String(data.name).trim();
      const submissionId = String(data.submissionId || '').trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) {
        throw new Error('รหัสการส่งข้อมูลไม่ถูกต้อง กรุณาโหลดหน้าใหม่');
      }

      const { data: previousSubmission, error: previousError } = await sb().from('reservations')
        .select('id, submission_device_index').eq('submission_id', submissionId).order('submission_device_index', { ascending: true });
      if (previousError) throw new Error('ตรวจสอบการส่งซ้ำไม่สำเร็จ: ' + previousError.message);
      if (previousSubmission && previousSubmission.length) {
        return { ok: true, count: previousSubmission.length, duplicatePrevented: true, ids: previousSubmission.map(r => r.id) };
      }

      const deviceSignature = d => [d && d.model, d && d.capacity, d && d.color].map(v => String(v || '').trim().toLowerCase()).join('|');
      const incomingSignatures = data.devices.map(deviceSignature);
      const repeatedInside = incomingSignatures.filter((sig, index) => sig && incomingSignatures.indexOf(sig) !== index);
      const { data: activeRows, error: activeError } = await sb().from('reservations')
        .select('model, capacity, color').eq('phone', cleanPhone)
        .in('status', ['รอตรวจสอบ', 'รอสินค้า', 'ของมาแล้ว', 'นัดรับแล้ว']);
      if (activeError) throw new Error('ตรวจสอบรายการเดิมไม่สำเร็จ: ' + activeError.message);
      const activeSignatures = new Set((activeRows || []).map(deviceSignature));
      const existingMatches = incomingSignatures.filter(sig => activeSignatures.has(sig));
      if (!data.confirmDuplicate && (repeatedInside.length || existingMatches.length)) {
        const duplicateInfo = {
          repeatedInside: new Set(repeatedInside).size,
          existingMatches: existingMatches.length,
          deviceCount: data.devices.length
        };
        throw new Error('DUPLICATE_CONFIRM_REQUIRED|' + JSON.stringify(duplicateInfo));
      }

      await sb().from('customers').upsert({
        phone: cleanPhone,
        name: name,
        contact_channel: data.contactChannel || 'LINE',
        contact_id: data.contactId || '',
        language: data.language || 'th',
        customer_group: 'Walk-in'
      }, { onConflict: 'phone' });

      const batchGroupId = 'B_' + Date.now();
      const newReservations = [];
      const notes = [];

      for (let deviceIndex = 0; deviceIndex < data.devices.length; deviceIndex++) {
        const d = data.devices[deviceIndex];
        const id = genShortId();
        const token = genToken();
        const price = d.price || (d.model ? (d.prices && d.prices[d.capacity]) || 0 : 0);

        newReservations.push({
          id: id,
          token: token,
          phone: cleanPhone,
          customer_name: name,
          customer_group: 'Walk-in',
          pre_order_no: (typeof d !== 'undefined' && d.preOrder) ? d.preOrder : (data.preOrder || ''),
          pre_booking_no: (typeof d !== 'undefined' && d.preBooking) ? d.preBooking : (data.preBooking || ''),
          model: d.model,
          capacity: d.capacity,
          color: d.color,
          alternate_colors: Array.isArray(d.altColors) ? d.altColors.join(', ') : '',
          alternate_capacities: Array.isArray(d.altCaps) ? d.altCaps.join(', ') : '',
          lock_supplier: !!data.wantAIS,
          specified_supplier: data.wantAIS ? 'AIS' : null,
          campaign: data.selectedPromo || null,
          deposit: 0,
          status: 'รอตรวจสอบ',
          source: 'customer',
          extra_notes: data.note || '',
          price_at_booking: Number(price) || 0,
          batch_group_id: batchGroupId,
          submission_id: submissionId,
          submission_device_index: deviceIndex + 1,
          duplicate_confirmed: data.confirmDuplicate === true,
          booked_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

        notes.push({
          reservation_id: id,
          author: 'customer',
          message: 'ลูกค้าลงชื่อแสดงความสนใจผ่านหน้าเว็บ',
          source: 'auto',
          created_at: new Date().toISOString()
        });
      }

      let { error: insErr } = await sb().from('reservations').insert(newReservations);
      // Deploys from main may go live before the Supabase migration. In that
      // interval, retain the previous signup behavior instead of rejecting all
      // customer submissions because this new column is not installed yet.
      if (insErr && /duplicate_confirmed/i.test(String(insErr.message || '')) &&
          /(does not exist|schema cache|unknown column)/i.test(String(insErr.message || ''))) {
        const legacyReservations = newReservations.map(({ duplicate_confirmed, ...reservation }) => reservation);
        ({ error: insErr } = await sb().from('reservations').insert(legacyReservations));
      }
      if (insErr) {
        if (/submission|unique|duplicate/i.test(String(insErr.message || ''))) {
          const { data: replayRows } = await sb().from('reservations').select('id').eq('submission_id', submissionId);
          if (replayRows && replayRows.length) return { ok: true, count: replayRows.length, duplicatePrevented: true, ids: replayRows.map(r => r.id) };
        }
        throw new Error('เกิดข้อผิดพลาดในการบันทึก: ' + insErr.message);
      }

      await sb().from('notes').insert(notes);
      return { ok: true, count: newReservations.length, duplicatePrevented: false, ids: newReservations.map(r => r.id) };
    },

    // -------------------------------------------------------------
    // CHECK
    // -------------------------------------------------------------
    async checkByToken(token) {
      if (!token) throw new Error('ไม่พบข้อมูลการจอง');
      const { data, error } = await sb().from('reservations').select('*').eq('token', token).single();
      if (error || !data) throw new Error('ไม่พบข้อมูลการจองหรือลิงก์ไม่ถูกต้อง');

      return {
        id: data.id,
        maskedName: maskName(data.customer_name),
        maskedPhone: maskPhone(data.phone),
        model: data.model,
        capacity: data.capacity,
        color: data.color,
        price: data.price_at_booking
      };
    },

    async verifyAndReveal(token, inputPhone) {
      if (!token) throw new Error('ลิงก์ไม่ถูกต้อง');
      const cleanInput = normPhone(inputPhone);
      const { data, error } = await sb().from('reservations').select('*').eq('token', token).single();
      if (error || !data) throw new Error('ไม่พบข้อมูล');

      const LOCK_KEY = 'cust_lock_until_' + token;
      const FAIL_KEY = 'cust_fails_' + token;
      const lockedUntil = Number(localStorage.getItem(LOCK_KEY) || 0);
      const now = Date.now();

      // 1. If currently locked, refuse ANY input (even if correct phone is entered)
      if (now < lockedUntil) {
        const secLeft = Math.max(1, Math.ceil((lockedUntil - now) / 1000));
        return { ok: false, locked: true, lockedSec: secLeft };
      }

      // If previous lock time has passed, remove expired keys
      if (lockedUntil && now >= lockedUntil) {
        localStorage.removeItem(LOCK_KEY);
        localStorage.removeItem(FAIL_KEY);
      }

      const expectedPhone = normPhone(data.phone);
      if (cleanInput !== expectedPhone) {
        let fails = Number(localStorage.getItem(FAIL_KEY) || 0) + 1;
        localStorage.setItem(FAIL_KEY, String(fails));
        if (fails >= 5) {
          const newLockUntil = Date.now() + 60 * 1000; // ล็อก 1 นาที (60 วินาที)
          localStorage.setItem(LOCK_KEY, String(newLockUntil));
          localStorage.removeItem(FAIL_KEY);
          return { ok: false, locked: true, lockedSec: 60 };
        }
        return { ok: false, locked: false, remaining: 5 - fails };
      }

      // Phone is correct and not locked: clear state
      localStorage.removeItem(LOCK_KEY);
      localStorage.removeItem(FAIL_KEY);

      let dueRemainingDays = 0;
      if (data.due_date) {
        dueRemainingDays = daysBetween(new Date(), new Date(data.due_date));
      }

      let aheadCount = 0;
      if (data.status === 'รอสินค้า') {
        const { count } = await sb()
          .from('reservations')
          .select('*', { count: 'exact', head: true })
          .eq('model', data.model)
          .eq('capacity', data.capacity)
          .eq('color', data.color)
          .eq('status', 'รอสินค้า')
          .lt('booked_at', data.booked_at);
        aheadCount = count || 0;
      }

      const { data: cfgRows } = await sb().from('system_configs').select('*');
      const configs = {};
      (cfgRows || []).forEach(c => { configs[c.key] = c.value; });

      return {
        ok: true,
        data: {
          id: data.id,
          name: data.customer_name,
          phone: data.phone,
          group: data.customer_group,
          model: data.model,
          capacity: data.capacity,
          color: data.color,
          price: data.price_at_booking,
          status: data.status,
          deposit: data.deposit || 0,
          billNo: data.bill_no || '',
          dueDate: data.due_date ? fmtDay(data.due_date) : '',
          appt: data.appointment_at ? fmtDate(data.appointment_at) : '',
          additionalNote: data.extra_notes || '',
          supplierLock: data.lock_supplier,
          promo: data.campaign,
          preOrder: data.pre_order_no,
          preBooking: data.pre_booking_no,
          updatedAt: fmtDate(data.updated_at || data.booked_at || data.created_at || parseBookingDate(data)),
          dueRemainingDays: dueRemainingDays,
          aheadCount: aheadCount,
          avgWaitDays: 5,
          showCustomerGroup: isSettingEnabled(configs['แสดงกลุ่มลูกค้าในข้อมูลสำหรับลูกค้า'], false)
        }
      };
    },

    // -------------------------------------------------------------
    // STAFF PORTAL
    // -------------------------------------------------------------
    isInstalled() { return Promise.resolve(true); },
    runSetupFromWeb() { return Promise.resolve(true); },

        async getWelcomeConfig() {
      try {
        const { data: cfg } = await sb().from('system_configs').select('value').eq('key', 'แสดง QR ลงทะเบียนหน้า Welcome').single();
        return {
          showWelcomeQr: isSettingEnabled(cfg ? cfg.value : true, true)
        };
      } catch (e) {
        return { showWelcomeQr: true };
      }
    },

async validateLocationCode(tokenOrCode, code) {
      const c = String(code || tokenOrCode || '').trim();
      const validCodes = ['22100', '1234'];
      try {
        const { data } = await sb().from('system_configs').select('value').eq('key', 'LOCATION_CODE').single();
        if (data && data.value) validCodes.push(data.value.trim());
      } catch (e) {
        console.warn('Fallback location code check');
      }

      const LOCK_KEY = 'location_login_locked_until';
      const lockedUntil = Number(localStorage.getItem(LOCK_KEY) || 0);
      const now = Date.now();

      // If currently locked, refuse
      if (now < lockedUntil) {
        const retryAfterSec = Math.max(1, Math.ceil((lockedUntil - now) / 1000));
        return { ok: false, locked: true, retryAfterSec: retryAfterSec };
      }

      if (validCodes.includes(c)) {
        localStorage.removeItem(LOCK_KEY);
        const expTime = Date.now() + (30 * 24 * 60 * 60 * 1000);
        const token = expTime + '.staff_authenticated';
        sessionStorage.setItem('staff_auth_token', token);
        localStorage.setItem('queue_staff_last_active', String(Date.now()));
        localStorage.removeItem('queue_staff_session_expired');
        return { ok: true, token: token };
      }

      // If incorrect -> Lock for 1 minute (60 seconds)
      const lockSec = 60;
      localStorage.setItem(LOCK_KEY, String(now + lockSec * 1000));
      return { ok: false, locked: true, retryAfterSec: lockSec };
    },

    async getBootstrap(tokenOrForce, force) {
      const [prodsRes, groupsRes, supplyRes, promoRes, cfgRes] = await Promise.all([
        sb().from('products').select('*').eq('is_active', true),
        sb().from('customer_groups').select('*').eq('is_active', true).order('sort_order'),
        sb().from('suppliers').select('*').eq('is_active', true),
        sb().from('discount_campaigns').select('*').eq('is_active', true),
        sb().from('system_configs').select('*')
      ]);

      const products = (prodsRes.data || []).map(p => ({
        model: p.model,
        capacities: (p.capacities || '').split(',').map(s => s.trim()).filter(Boolean),
        colors: (p.colors || '').split(',').map(s => s.trim()).filter(Boolean),
        prices: parsePriceMap(p.prices)
      }));

      const groups = (groupsRes.data || []).map(g => ({
        name: g.name,
        color: g.badge_color,
        requireRef: g.require_ref_no,
        isDefault: g.is_default
      }));

      let suppliers = (supplyRes.data || []).map(s => s.name);
      if (!suppliers || suppliers.length === 0) {
        suppliers = ['AIS', 'Jaymart', 'TG Fone', 'Synnex', 'Com7'];
      }

      const promos = (promoRes.data || []).map(p => ({ name: p.name, desc: p.description }));
      const configs = {};
      (cfgRes.data || []).forEach(c => { configs[c.key] = c.value; });
      if (configs['หน่วงเวลา Popup บันทึกข้อมูล'] === undefined && configs['หน่วงเวลา Popup'] === undefined) {
        configs['หน่วงเวลา Popup บันทึกข้อมูล'] = 'TRUE';
      }

      const statuses = ['รอตรวจสอบ', 'รอสินค้า', 'ของมาแล้ว', 'นัดรับแล้ว'];

      return {
        user: 'iStudio Staff',
        storeName: 'iStudio Central Embassy',
        products: products,
        groups: groups,
        suppliers: suppliers,
        supplies: suppliers,
        statuses: statuses,
        promos: promos,
        defaultDueDays: 5,
        configs: configs,
                depositEnabled: isSettingEnabled(configs['เก็บมัดจำ'], true),
        supplierLockEnabled: isSettingEnabled(configs['ล็อกซัพ'], true),
        aisThaiOnly: isSettingEnabled(configs['โครงการ AIS เฉพาะภาษาไทย'], false),
        aisPromoThaiOnly: isSettingEnabled(configs['โครงการ AIS เฉพาะภาษาไทย'], false),
        alternativeOptionsEnabled: isSettingEnabled(configs['เปิดใช้ตัวเลือกเครื่องทางเลือก'], true)
      };
    },

    async listReservations(tokenOrFilter, filter) {
      const f = (typeof tokenOrFilter === 'object' && tokenOrFilter !== null) ? tokenOrFilter : (filter || {});
      const appliedFilter = {
        q: String(f.q || ''),
        group: String(f.group || ''),
        status: String(f.status || ''),
        focus: String(f.focus || ''),
        includeClosed: !!f.includeClosed
      };

      let query = sb().from('reservations').select('*');

      if (appliedFilter.status) {
        query = query.eq('status', appliedFilter.status);
      } else if (!appliedFilter.includeClosed) {
        query = query.neq('status', 'รับของแล้ว').neq('status', 'ยกเลิก');
      }

      if (appliedFilter.group) {
        query = query.eq('customer_group', appliedFilter.group);
      }

      const todayBounds = bangkokDayBounds();
      const today = todayBounds.key;
      if (appliedFilter.focus === 'overdue') {
        query = query.or(`and(status.eq.ของมาแล้ว,due_date.lt.${today}),and(status.eq.นัดรับแล้ว,appointment_at.lt.${todayBounds.start})`);
      } else if (appliedFilter.focus === 'today') {
        query = query.eq('status', 'นัดรับแล้ว').gte('appointment_at', todayBounds.start).lte('appointment_at', todayBounds.end);
      } else if (appliedFilter.focus === 'noCall') {
        query = query.in('status', ['ของมาแล้ว', 'นัดรับแล้ว']).or('call_count.is.null,call_count.eq.0');
      } else if (appliedFilter.focus === 'failed') {
        query = query.gte('call_count', 3);
      } else if (appliedFilter.focus === 'pending') {
        query = query.eq('status', 'รอตรวจสอบ');
      }

      if (appliedFilter.q) {
        const q = appliedFilter.q.trim();
        query = query.or(`customer_name.ilike.%${q}%,phone.ilike.%${q}%,id.ilike.%${q}%,model.ilike.%${q}%,bill_no.ilike.%${q}%,pre_order_no.ilike.%${q}%`);
      }

      query = query.order('booked_at', { ascending: true }).limit(500);

      const [{ data, error }, { data: allActive }] = await Promise.all([
        query,
        sb().from('reservations').select('status, due_date, appointment_at, call_count').not('status', 'in', '("รับของแล้ว","ยกเลิก")')
      ]);
      if (error) throw new Error(error.message);

      const activeRows = allActive || [];
      const focus = {
        overdue: activeRows.filter(r => (r.status === 'ของมาแล้ว' && r.due_date && r.due_date < today) || (r.status === 'นัดรับแล้ว' && r.appointment_at && new Date(r.appointment_at) < new Date(todayBounds.start))).length,
        today: activeRows.filter(r => r.status === 'นัดรับแล้ว' && r.appointment_at && bangkokDateKey(r.appointment_at) === today).length,
        noCall: activeRows.filter(r => (r.status === 'ของมาแล้ว' || r.status === 'นัดรับแล้ว') && !(r.call_count || 0)).length,
        failed: activeRows.filter(r => (r.status === 'ของมาแล้ว' || (r.status === 'นัดรับแล้ว' && r.appointment_at && new Date(r.appointment_at) < new Date(todayBounds.start))) && (r.call_count || 0) >= 3).length,
        pending: activeRows.filter(r => r.status === 'รอตรวจสอบ').length
      };

      const items = (data || []).map(mapReservation);
      return {
        items: items,
        total: items.length,
        focus: focus,
        appliedFilter: appliedFilter
      };
    },

    async lookupPhone(tokenOrPhone, phone) {
      const p = optFirst(tokenOrPhone, phone);
      const clean = normPhone(p);
      if (clean.length < 9) return { exists: false, reservations: [] };

      const { data: cust } = await sb().from('customers').select('*').eq('phone', clean).single();
      const { data: activeRes } = await sb().from('reservations').select('*').eq('phone', clean).in('status', ['รอสินค้า', 'ของมาแล้ว', 'นัดรับแล้ว']);
      const mappedActive = (activeRes || []).map(mapReservation);

      if (!cust && mappedActive.length === 0) return { exists: false, reservations: [] };

      return {
        exists: true,
        customer: cust ? {
          name: cust.name || '',
          phone: cust.phone || clean,
          channel: cust.contact_channel || 'LINE',
          contactId: cust.contact_id || ''
        } : null,
        reservations: mappedActive,
        activeReservations: mappedActive
      };
    },

    async saveReservation(tokenOrP, p) {
      const params = (typeof tokenOrP === 'object' && tokenOrP !== null) ? tokenOrP : p;
      const custName = String(params && (params.name || params.customerName) || '').trim();
      if (!params || !params.phone || !custName || !params.devices || !params.devices.length) {
        throw new Error('ข้อมูลไม่ครบถ้วน: กรุณากรอกชื่อ เบอร์โทร และระบุเครื่องที่ต้องการจอง');
      }
      const cleanPhone = normPhone(params.phone);
      const customerGroup = params.customerGroup || params.group || 'Walk-in';
      const batchPreOrder = requirePreOrderNumber(customerGroup, params.preOrder);

      await sb().from('customers').upsert({
        phone: cleanPhone,
        name: custName,
        contact_channel: params.contactChannel || params.channel || 'LINE',
        contact_id: params.contactId || '',
        customer_group: customerGroup
      }, { onConflict: 'phone' });

      const batchGroupId = 'B_' + Date.now();
      const reservations = [];
      const notes = [];

      for (const d of params.devices) {
        const id = genShortId();
        const token = genToken();
        const devicePreOrder = requirePreOrderNumber(customerGroup, (d && d.preOrder) || batchPreOrder);

        reservations.push({
          id: id,
          token: token,
          phone: cleanPhone,
          customer_name: custName,
          customer_group: customerGroup,
          pre_order_no: devicePreOrder,
          pre_booking_no: (d && d.preBooking) || params.preBooking || '',
          model: d.model,
          capacity: d.capacity,
          color: d.color,
          alternate_colors: Array.isArray(d.altColors) ? d.altColors.join(', ') : '',
          alternate_capacities: Array.isArray(d.altCaps) ? d.altCaps.join(', ') : '',
          lock_supplier: !!(d.supplierLock || params.lockSupplier),
          specified_supplier: d.supplier || params.specifiedSupplier || null,
          campaign: d.promo || params.campaign || null,
          deposit: Number(d.deposit) || 0,
          bill_no: d.billNo || params.billNo || '',
          deposit_date: d.deposit ? new Date().toISOString().slice(0, 10) : null,
          status: 'รอสินค้า',
          source: 'staff',
          staff_name: params.staffName || 'Staff',
          extra_notes: params.extraNotes || params.note || '',
          price_at_booking: Number(d.price) || 0,
          batch_group_id: batchGroupId,
          booked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          updated_by: params.staffName || 'Staff'
        });

        notes.push({
          reservation_id: id,
          author: params.staffName || 'Staff',
          message: 'พนักงานบันทึกการจองใหม่',
          source: 'manual',
          created_at: new Date().toISOString()
        });
      }

      const { error: reservationError } = await sb().from('reservations').insert(reservations);
      if (reservationError) throw new Error('บันทึกรายการจองไม่สำเร็จ: ' + reservationError.message);
      const { error: noteError } = await sb().from('notes').insert(notes);
      if (noteError) console.warn('บันทึกไทม์ไลน์ไม่สำเร็จ:', noteError.message);
      return {
        ok: true,
        count: reservations.length,
        devices: reservations.map(r => ({ id: r.id, token: r.token })),
        ids: reservations.map(r => r.id)
      };
    },

    async getReservation(tokenOrId, id) {
      const resId = optFirst(tokenOrId, id);
      const { data, error } = await sb().from('reservations').select('*').eq('id', resId).single();
      if (error || !data) throw new Error('ไม่พบข้อมูลรายการจอง');

      const [{ data: notes }, { data: siblingRows }] = await Promise.all([
        sb().from('notes').select('*').eq('reservation_id', resId).order('created_at', { ascending: false }),
        sb().from('reservations').select('*').eq('phone', data.phone).neq('id', data.id).not('status', 'in', '("ยกเลิก")')
      ]);

      let depositBatchCount = 1;
      let depositBatchTotal = Number(data.deposit) || 0;
      if (data.bill_no || data.batch_group_id) {
        let bQuery = sb().from('reservations').select('deposit');
        if (data.bill_no) bQuery = bQuery.eq('bill_no', data.bill_no);
        else bQuery = bQuery.eq('batch_group_id', data.batch_group_id);
        const { data: bData } = await bQuery;
        if (bData && bData.length > 1) {
          depositBatchCount = bData.length;
          depositBatchTotal = bData.reduce((acc, row) => acc + (Number(row.deposit) || 0), 0);
        }
      }

      return {
        id: data.id,
        token: data.token,
        checkUrl: getCheckUrl(data.token),
        name: data.customer_name,
        phone: data.phone,
        group: data.customer_group,
        model: data.model,
        capacity: data.capacity,
        color: data.color,
        altColors: (data.alternate_colors || '').split(',').map(s => s.trim()).filter(Boolean),
        altCaps: (data.alternate_capacities || '').split(',').map(s => s.trim()).filter(Boolean),
        lockSupplier: !!data.lock_supplier,
        supplierLock: !!data.lock_supplier,
        supplier: data.specified_supplier,
        promo: data.campaign,
        deposit: data.deposit,
        billNo: data.bill_no,
        depositDate: data.deposit_date,
        status: data.status,
        dueDate: data.due_date ? fmtDay(data.due_date) : '',
        appt: data.appointment_at ? fmtDate(data.appointment_at) : '',
        rescheduleCount: data.reschedule_count || 0,
        staffName: data.staff_name,
        isLabeled: data.is_labeled,
        source: data.source,
        callCount: data.call_count || 0,
        updatedAt: fmtDate(data.updated_at),
        updatedBy: data.updated_by,
        preOrder: extractPreOrder(data),
        preBooking: data.pre_booking_no || '',
        extraNotes: data.extra_notes || '',
        additionalNote: data.extra_notes || '',
        siblings: (siblingRows || []).map(mapReservation),
        depositBatchCount: depositBatchCount,
        depositBatchTotal: depositBatchTotal,
        lastCalledAt: data.last_called_at ? fmtDate(data.last_called_at) : '',
        urgent: !!data.is_urgent,
        isUrgent: !!data.is_urgent,
        urgentReason: data.urgent_reason || '',
        dueRemainingDays: data.due_date ? daysBetween(new Date(), new Date(data.due_date)) : null,
        createdAt: (function(){ const bd = parseBookingDate(data); return (bd && !isNaN(bd.getTime())) ? fmtDate(bd) : ''; })(),
        bookedAt: (function(){ const bd = parseBookingDate(data); return (bd && !isNaN(bd.getTime())) ? fmtDate(bd) : ''; })(),
        price: data.price_at_booking,
        notes: (notes || []).map(n => ({
          at: fmtDate(n.created_at),
          who: n.author,
          text: n.message,
          source: n.source
        }))
      };
    },

    async getReservationNotes(tokenOrId, id) {
      const resId = optFirst(tokenOrId, id);
      const { data } = await sb().from('notes').select('*').eq('reservation_id', resId).order('created_at', { ascending: false });
      return (data || []).map(n => ({
        at: fmtDate(n.created_at),
        who: n.author,
        text: n.message,
        source: n.source
      }));
    },

    async editReservation(tokenOrId, idOrPatch, patch) {
      let id, dataPatch;
      if (typeof tokenOrId === 'string' && (tokenOrId.startsWith('staff_') || tokenOrId === 'logged_in' || isFinite(Number(tokenOrId.split('.')[0])))) {
        id = idOrPatch;
        dataPatch = patch;
      } else {
        id = tokenOrId;
        dataPatch = idOrPatch;
      }

      const changesPreOrderIdentity = dataPatch.group !== undefined || dataPatch.customer_group !== undefined ||
        dataPatch.preOrder !== undefined || dataPatch.pre_order_no !== undefined;
      if (changesPreOrderIdentity) {
        const { data: current, error: currentError } = await sb()
          .from('reservations')
          .select('customer_group, pre_order_no')
          .eq('id', id)
          .single();
        if (currentError || !current) throw new Error('ไม่พบรายการจองที่ต้องการแก้ไข');
        const finalGroup = dataPatch.group !== undefined || dataPatch.customer_group !== undefined
          ? (dataPatch.group || dataPatch.customer_group || '')
          : current.customer_group;
        const finalPreOrder = dataPatch.preOrder !== undefined || dataPatch.pre_order_no !== undefined
          ? (dataPatch.preOrder !== undefined ? dataPatch.preOrder : dataPatch.pre_order_no)
          : current.pre_order_no;
        requirePreOrderNumber(finalGroup, finalPreOrder);
      }

      const updateData = {
        updated_at: new Date().toISOString()
      };
      if (dataPatch.model !== undefined) updateData.model = dataPatch.model;
      if (dataPatch.capacity !== undefined) updateData.capacity = dataPatch.capacity;
      if (dataPatch.color !== undefined) updateData.color = dataPatch.color;
      if (dataPatch.price !== undefined && dataPatch.price !== null) {
        updateData.price_at_booking = Number(dataPatch.price);
      } else if (dataPatch.model && dataPatch.capacity) {
        try {
          const { data: prodRow } = await sb().from('products').select('prices').eq('model', dataPatch.model).single();
          if (prodRow && prodRow.prices) {
            const pmap = parsePriceMap(prodRow.prices);
            if (pmap[dataPatch.capacity] != null) {
              updateData.price_at_booking = Number(pmap[dataPatch.capacity]);
            }
          }
        } catch (pe) {}
      }
      if (dataPatch.group !== undefined || dataPatch.customer_group !== undefined) {
        updateData.customer_group = dataPatch.group || dataPatch.customer_group;
      }
      if (dataPatch.preOrder !== undefined || dataPatch.pre_order_no !== undefined) {
        updateData.pre_order_no = dataPatch.preOrder !== undefined ? String(dataPatch.preOrder || '').trim() : String(dataPatch.pre_order_no || '').trim();
      }
      if (dataPatch.preBooking !== undefined || dataPatch.pre_booking_no !== undefined) {
        updateData.pre_booking_no = dataPatch.preBooking || dataPatch.pre_booking_no;
      }
      if (dataPatch.supplierLock !== undefined || dataPatch.lock_supplier !== undefined) {
        updateData.lock_supplier = !!(dataPatch.supplierLock || dataPatch.lock_supplier);
      }
      if (dataPatch.promo !== undefined || dataPatch.campaign !== undefined) {
        updateData.campaign = dataPatch.promo || dataPatch.campaign || null;
      }
      if (dataPatch.billNo !== undefined || dataPatch.bill_no !== undefined) {
        updateData.bill_no = dataPatch.billNo || dataPatch.bill_no || '';
      }
      if (dataPatch.deposit !== undefined) {
        updateData.deposit = Number(dataPatch.deposit) || 0;
      }

      const { error } = await sb().from('reservations').update(updateData).eq('id', id);
      if (error) throw new Error(error.message);

      const changeSpecs = [updateData.model, updateData.capacity, updateData.color].filter(Boolean).join(' ');
      const priceText = updateData.price_at_booking != null ? ' (฿' + Number(updateData.price_at_booking).toLocaleString('th-TH') + ')' : '';
      await sb().from('notes').insert({
        reservation_id: id,
        author: 'Staff',
        message: 'แก้ไขข้อมูลการจอง' + (changeSpecs ? ': ' + changeSpecs + priceText : ''),
        source: 'manual',
        created_at: new Date().toISOString()
      });
      return true;
    },

    async markArrived(tokenOrId, id) {
      const resId = optFirst(tokenOrId, id);
      let initDays = 3;
      try {
        const { data: cfg } = await sb().from('system_configs').select('value').eq('key', 'วันครบกำหนดเริ่มต้น').single();
        if (cfg && cfg.value) initDays = Number(cfg.value) || 3;
      } catch(e){}

      const dueDate = new Date(Date.now() + initDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { error } = await sb().from('reservations').update({
        status: 'ของมาแล้ว',
        due_date: dueDate,
        updated_at: new Date().toISOString()
      }).eq('id', resId);
      if (error) throw new Error(error.message);

      await sb().from('notes').insert({
        reservation_id: resId,
        author: 'Staff',
        message: 'เปลี่ยนสถานะเป็น: ของมาแล้ว (กำหนดรับภายใน ' + initDays + ' วัน)',
        source: 'auto',
        created_at: new Date().toISOString()
      });
      return true;
    },
    async cancelByCustomer(tokenOrId, idOrReason, reasonOrOther, other) {
      let id, rsn, oth;
      if (typeof tokenOrId === 'string' && (tokenOrId.startsWith('staff_') || tokenOrId === 'logged_in' || isFinite(Number(tokenOrId.split('.')[0])))) {
        id = idOrReason; rsn = reasonOrOther; oth = other;
      } else {
        id = tokenOrId; rsn = idOrReason; oth = reasonOrOther;
      }

      await sb().from('reservations').update({
        status: 'ยกเลิก',
        updated_at: new Date().toISOString()
      }).eq('id', id);

      const msg = 'ลูกค้ายกเลิก: ' + (rsn || 'ไม่ระบุ') + (oth ? ' (' + oth + ')' : '');
      await sb().from('notes').insert({
        reservation_id: id,
        author: 'Staff',
        message: msg,
        source: 'manual',
        created_at: new Date().toISOString()
      });
      return true;
    },
    async markLabeled(tokenOrId, id) {
      const resId = optFirst(tokenOrId, id);
      await sb().from('reservations').update({ is_labeled: true }).eq('id', resId);
      return { ok: true };
    },

    async logCallResult(tokenOrId, idOrResult, resultOrNote, note) {
      let id, res, ntext;
      if (typeof tokenOrId === 'string' && (tokenOrId.startsWith('staff_') || tokenOrId === 'logged_in' || isFinite(Number(tokenOrId.split('.')[0])))) {
        id = idOrResult; res = resultOrNote; ntext = note;
      } else {
        id = tokenOrId; res = idOrResult; ntext = resultOrNote;
      }

      const { data: current } = await sb().from('reservations').select('call_count').eq('id', id).single();
      const calls = ((current && current.call_count) || 0) + 1;

      await sb().from('reservations').update({
        call_count: calls,
        last_called_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', id);

      const callLabels = {
        'busy': 'ติดต่อไม่ได้',
        'no_answer': 'ลูกค้าไม่รับสาย',
        'notified': 'แจ้งลูกค้าแล้ว',
        'ok': 'ยืนยันนัดรับตามเดิม',
        'other': 'อื่นๆ',
        'อื่นๆ': 'อื่นๆ'
      };
      const label = callLabels[res] || res || 'ติดต่อสำเร็จ';
      const msg = 'บันทึกผลการโทร (ครั้งที่ ' + calls + '): ' + label + (ntext ? ' — ' + ntext : '');
      await sb().from('notes').insert({
        reservation_id: id,
        author: 'Staff',
        message: msg,
        source: 'manual',
        created_at: new Date().toISOString()
      });
      return true;
    },

    async markDone(tokenOrId, id) {
      const resId = optFirst(tokenOrId, id);
      const { data: current, error: currentError } = await sb().from('reservations')
        .select('id, status').eq('id', resId).single();
      if (currentError || !current) throw new Error('ไม่พบรายการจอง');
      if (current.status === 'รับของแล้ว') throw new Error('รายการนี้บันทึกรับสินค้าแล้ว');
      if (current.status !== 'นัดรับแล้ว') throw new Error('รับสินค้าได้เฉพาะรายการที่มีสถานะนัดรับแล้ว');

      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await sb().from('reservations').update({
        status: 'รับของแล้ว',
        updated_at: now
      }).eq('id', resId).eq('status', 'นัดรับแล้ว').select('id');
      if (updateError) throw new Error('บันทึกรับสินค้าไม่สำเร็จ: ' + updateError.message);
      if (!updated || updated.length !== 1) throw new Error('สถานะรายการเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลใหม่');

      const { error: noteError } = await sb().from('notes').insert({
        reservation_id: resId,
        author: 'Staff',
        message: 'ยืนยันว่าลูกค้ามารับสินค้าแล้ว · ส่งมอบสินค้าเรียบร้อย (ปิดรายการ)',
        source: 'manual',
        created_at: now
      });
      if (noteError) {
        await sb().from('reservations').update({ status: 'นัดรับแล้ว', updated_at: new Date().toISOString() })
          .eq('id', resId).eq('status', 'รับของแล้ว');
        throw new Error('บันทึกประวัติไม่สำเร็จ ระบบคืนสถานะเดิมแล้ว กรุณาลองใหม่');
      }
      return { ok: true, status: 'รับของแล้ว' };
    },

    async undoMarkDone(tokenOrId, idOrReason, reason) {
      let resId, undoReason;
      if (typeof tokenOrId === 'string' && (tokenOrId.startsWith('staff_') || tokenOrId === 'logged_in' || isFinite(Number(tokenOrId.split('.')[0])))) {
        resId = idOrReason;
        undoReason = reason;
      } else {
        resId = tokenOrId;
        undoReason = idOrReason;
      }
      undoReason = String(undoReason || '').trim();
      if (!undoReason) throw new Error('กรุณาระบุเหตุผลที่ยกเลิกสถานะรับสินค้าแล้ว');
      if (undoReason.length > 500) throw new Error('เหตุผลต้องไม่เกิน 500 ตัวอักษร');

      const { data: current, error: currentError } = await sb().from('reservations')
        .select('id, status, appointment_at').eq('id', resId).single();
      if (currentError || !current) throw new Error('ไม่พบรายการจอง');
      if (current.status !== 'รับของแล้ว') throw new Error('ยกเลิกสถานะได้เฉพาะรายการที่รับสินค้าแล้ว');
      if (!current.appointment_at) throw new Error('รายการนี้ไม่มีวันนัดเดิม กรุณาตรวจสอบข้อมูลก่อนย้อนสถานะ');

      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await sb().from('reservations').update({
        status: 'นัดรับแล้ว',
        updated_at: now
      }).eq('id', resId).eq('status', 'รับของแล้ว').select('id');
      if (updateError) throw new Error('ยกเลิกสถานะรับสินค้าไม่สำเร็จ: ' + updateError.message);
      if (!updated || updated.length !== 1) throw new Error('สถานะรายการเปลี่ยนไปแล้ว กรุณาโหลดข้อมูลใหม่');

      const { error: noteError } = await sb().from('notes').insert({
        reservation_id: resId,
        author: 'Staff',
        message: 'ยกเลิกสถานะรับสินค้าแล้ว · เหตุผล: ' + undoReason + ' · ย้อนกลับเป็น: นัดรับแล้ว',
        source: 'manual',
        created_at: now
      });
      if (noteError) {
        await sb().from('reservations').update({ status: 'รับของแล้ว', updated_at: new Date().toISOString() })
          .eq('id', resId).eq('status', 'นัดรับแล้ว');
        throw new Error('บันทึกประวัติไม่สำเร็จ ระบบคืนสถานะรับของแล้ว กรุณาลองใหม่');
      }
      return { ok: true, status: 'นัดรับแล้ว', reason: undoReason };
    },

    async addManualNote(tokenOrId, idOrText, text) {
      let id, msg;
      if (typeof tokenOrId === 'string' && (tokenOrId.startsWith('staff_') || tokenOrId === 'logged_in')) {
        id = idOrText; msg = text;
      } else {
        id = tokenOrId; msg = idOrText;
      }
      if (!msg || !msg.trim()) return true;

      await sb().from('notes').insert({
        reservation_id: id,
        author: 'Staff',
        message: msg.trim(),
        source: 'manual',
        created_at: new Date().toISOString()
      });
      return true;
    },

    async setAppointment(tokenOrId, idOrDt, dtOrForce, force) {
      let id, dt;
      if (typeof tokenOrId === 'string' && (tokenOrId.startsWith('staff_') || tokenOrId === 'logged_in' || isFinite(Number(tokenOrId.split('.')[0])))) {
        id = idOrDt; dt = dtOrForce;
      } else {
        id = tokenOrId; dt = idOrDt;
      }

      const apptDate = validatedAppointmentDate(dt);
      let postDueDays = 3;
      try {
        const { data: cfg } = await sb().from('system_configs').select('value').eq('key', 'วันครบกำหนดหลังนัด').single();
        if (cfg && cfg.value) postDueDays = Number(cfg.value) || 3;
      } catch(e){}

      const appointmentDay = bangkokDateKey(apptDate);
      const [year, month, day] = appointmentDay.split('-').map(Number);
      const dueDate = new Date(Date.UTC(year, month - 1, day + postDueDays)).toISOString().slice(0, 10);

      const { data: cur } = await sb().from('reservations').select('status, appointment_at, reschedule_count').eq('id', id).single();
      const isReschedule = cur && cur.status === 'นัดรับแล้ว' && cur.appointment_at;
      const rescheduleCount = ((cur && cur.reschedule_count) || 0) + (isReschedule ? 1 : 0);

      await sb().from('reservations').update({
        status: 'นัดรับแล้ว',
        appointment_at: apptDate.toISOString(),
        due_date: dueDate,
        reschedule_count: rescheduleCount,
        updated_at: new Date().toISOString()
      }).eq('id', id);

      await sb().from('notes').insert({
        reservation_id: id,
        author: 'Staff',
        message: 'บันทึกวันนัดรับสินค้า: ' + fmtDate(apptDate) + ' · ครบกำหนดรับ ' + fmtDay(dueDate) + (isReschedule ? ' (เลื่อนนัดครั้งที่ ' + rescheduleCount + ')' : ''),
        source: 'manual',
        created_at: new Date().toISOString()
      });
      return { ok: true, dueDate: fmtDay(dueDate) };
    },

    async releaseReservation(tokenOrId, idOrReason, reasonOrOther, other) {
      let id, rsn, oth;
      if (typeof tokenOrId === 'string' && (tokenOrId.startsWith('staff_') || tokenOrId === 'logged_in')) {
        id = idOrReason; rsn = reasonOrOther; oth = other;
      } else {
        id = tokenOrId; rsn = idOrReason; oth = reasonOrOther;
      }

      await sb().from('reservations').update({
        status: 'ยกเลิก',
        updated_at: new Date().toISOString()
      }).eq('id', id);

      const msg = 'ยกเลิกคิว: ' + (rsn || 'สละสิทธิ์') + (oth ? ' (' + oth + ')' : '');
      await sb().from('notes').insert({
        reservation_id: id,
        author: 'Staff',
        message: msg,
        source: 'manual',
        created_at: new Date().toISOString()
      });
      return true;
    },

    async markUrgent(tokenOrId, idOrReason, reason) {
      let id, rsn;
      if (typeof tokenOrId === 'string' && (tokenOrId.startsWith('staff_') || tokenOrId === 'logged_in')) {
        id = idOrReason; rsn = reason;
      } else {
        id = tokenOrId; rsn = idOrReason;
      }

      await sb().from('reservations').update({
        is_urgent: true,
        urgent_reason: rsn || 'เคสเร่งด่วน',
        updated_at: new Date().toISOString()
      }).eq('id', id);

      await sb().from('notes').insert({
        reservation_id: id,
        author: 'Staff',
        message: 'ทำเครื่องหมายเป็นเคสเร่งด่วน: ' + (rsn || 'ไม่ระบุเหตุผล'),
        source: 'manual',
        created_at: new Date().toISOString()
      });
      return true;
    },

    async clearUrgent(tokenOrId, id) {
      const resId = optFirst(tokenOrId, id);
      await sb().from('reservations').update({
        is_urgent: false,
        urgent_reason: '',
        updated_at: new Date().toISOString()
      }).eq('id', resId);

      await sb().from('notes').insert({
        reservation_id: resId,
        author: 'Staff',
        message: 'ยกเลิกเครื่องหมายเร่งด่วน',
        source: 'manual',
        created_at: new Date().toISOString()
      });
      return true;
    },

    async approveCustomerSignup(tokenOrId, idOrGroup, groupOrDeposit, depositOrBill, billOrPre, preOrder) {
      let id, group, deposit, billNo, pre;
      if (typeof tokenOrId === 'string' && (tokenOrId.startsWith('staff_') || tokenOrId === 'logged_in')) {
        id = idOrGroup; group = groupOrDeposit; deposit = depositOrBill; billNo = billOrPre; pre = preOrder;
      } else {
        id = tokenOrId; group = idOrGroup; deposit = groupOrDeposit; billNo = depositOrBill; pre = billOrPre;
      }
      pre = requirePreOrderNumber(group || 'Walk-in', pre);

      const { error: approvalError } = await sb().from('reservations').update({
        status: 'รอสินค้า',
        customer_group: group || 'Walk-in',
        deposit: Number(deposit) || 0,
        bill_no: billNo || '',
        pre_order_no: pre,
        updated_at: new Date().toISOString()
      }).eq('id', id);
      if (approvalError) throw new Error('อนุมัติรายการไม่สำเร็จ: ' + approvalError.message);

      await sb().from('notes').insert({
        reservation_id: id,
        author: 'Staff',
        message: 'อนุมัติรายการลงทะเบียน เข้าสู่คิว: รอสินค้า' + (group ? ' (' + group + ')' : ''),
        source: 'manual',
        created_at: new Date().toISOString()
      });
      return true;
    },

    async getFollowUpList() {
      const today = bangkokDateKey();
      let waitLongDays = 14;
      let callAlertThreshold = 3;
      try {
        const { data: cfgs } = await sb().from('system_configs').select('key, value');
        (cfgs || []).forEach(c => {
          if (c.key === 'วันรอนาน') waitLongDays = Number(c.value) || 14;
          if (c.key === 'ครั้งโทรไม่ติดแล้วเตือน') callAlertThreshold = Number(c.value) || 3;
        });
      } catch(e){}

      const [overdueRes, urgentRes, pendingRes, allActiveRes] = await Promise.all([
        sb().from('reservations').select('*').eq('status', 'ของมาแล้ว').lt('due_date', today),
        sb().from('reservations').select('*').eq('is_urgent', true).neq('status', 'รับของแล้ว').neq('status', 'ยกเลิก'),
        sb().from('reservations').select('*').eq('status', 'รอตรวจสอบ'),
        sb().from('reservations').select('*').in('status', ['รอสินค้า', 'ของมาแล้ว', 'นัดรับแล้ว'])
      ]);

      const overdueItems = (overdueRes.data || []).map(mapReservation);
      const pendingItems = (pendingRes.data || []).map(mapReservation);
      const urgentItems = (urgentRes.data || []).map(mapReservation);

      const allRows = allActiveRes.data || [];
      const noCallItems = allRows.filter(r => (r.status === 'ของมาแล้ว' || r.status === 'นัดรับแล้ว') && !r.call_count).map(mapReservation);
      const manyFailsItems = allRows.filter(r => (r.call_count || 0) >= callAlertThreshold).map(mapReservation);
      const dueTodayItems = allRows.filter(r => r.due_date === today).map(mapReservation);
      const waitLongItems = allRows.filter(r => {
        if (r.status !== 'รอสินค้า') return false;
        const bd = parseBookingDate(r);
        return bd && !isNaN(bd.getTime()) && daysBetween(bd, new Date()) >= waitLongDays;
      }).map(mapReservation);

      return {
        overdueCount: overdueItems.length,
        overdue: overdueItems,
        manyFails: manyFailsItems,
        noCall: noCallItems,
        dueToday: dueTodayItems,
        pending: pendingItems,
        waitLong: waitLongItems,
        urgent: urgentItems
      };
    },

    async getPendingApprovalCount() {
      const { count } = await sb().from('reservations').select('*', { count: 'exact', head: true }).eq('status', 'รอตรวจสอบ');
      return count || 0;
    },

    async approveAllPending() {
      const { data, error } = await sb().from('reservations').update({
        status: 'รอสินค้า',
        updated_at: new Date().toISOString()
      }).eq('status', 'รอตรวจสอบ').select('id');

      if (error) throw new Error(error.message);
      if (data && data.length > 0) {
        const notes = data.map(r => ({
          reservation_id: r.id,
          author: 'Staff',
          message: 'อนุมัติการลงทะเบียนและนำเข้าคิวรอสินค้า (อนุมัติทั้งหมด)',
          source: 'auto',
          created_at: new Date().toISOString()
        }));
        await sb().from('notes').insert(notes);
      }
      return { ok: true, count: (data || []).length };
    },

    async getDurationInfo(tokenOrId, id) {
      const resId = optFirst(tokenOrId, id);
      const { data: res } = await sb().from('reservations').select('*').eq('id', resId).single();
      if (!res) throw new Error('ไม่พบข้อมูลรายการจอง');

      const { data: notes } = await sb().from('notes').select('*').eq('reservation_id', resId).order('created_at', { ascending: true });

      const createdDateObj = parseBookingDate(res);
      const createdAt = (createdDateObj && !isNaN(createdDateObj.getTime())) ? fmtDate(createdDateObj) : '—';

      let arrivedDateObj = null;
      const arrNotes = (notes || []).filter(n => n.message && (n.message.includes('เปลี่ยนเป็น ของมาแล้ว') || n.message.includes('สินค้ามาแล้ว') || n.message.includes('สินค้าเข้า')));
      if (arrNotes.length > 0) {
        arrivedDateObj = new Date(arrNotes[0].created_at);
      } else if (res.status === 'ของมาแล้ว' || res.status === 'นัดรับแล้ว' || res.status === 'รับของแล้ว') {
        arrivedDateObj = res.updated_at ? new Date(res.updated_at) : (res.due_date ? new Date(res.due_date) : null);
      }
      const arrivedAt = (arrivedDateObj && !isNaN(arrivedDateObj.getTime())) ? fmtDate(arrivedDateObj) : '';

      const status = res.status;
      const hasArrived = status === 'ของมาแล้ว' || status === 'นัดรับแล้ว' || status === 'รับของแล้ว';

      let totalWaitDays = null;
      if (hasArrived && createdDateObj && arrivedDateObj) {
        totalWaitDays = Math.max(0, daysBetween(createdDateObj, arrivedDateObj));
      } else if (hasArrived && createdDateObj) {
        totalWaitDays = Math.max(0, daysBetween(createdDateObj, new Date()));
      }

      let currentWaitDays = null;
      if (createdDateObj) {
        currentWaitDays = Math.max(0, daysBetween(createdDateObj, new Date()));
      }

      let aheadCount = 0;
      if (!hasArrived && status !== 'ยกเลิก') {
        const bookedTime = res.booked_at || (createdDateObj ? createdDateObj.toISOString() : null);
        let aheadQuery = sb().from('reservations')
          .select('id, booked_at', { count: 'exact' })
          .eq('model', res.model)
          .eq('capacity', res.capacity)
          .eq('color', res.color)
          .in('status', ['รอสินค้า', 'รอตรวจสอบ'])
          .neq('id', res.id);

        if (bookedTime) {
          aheadQuery = aheadQuery.lt('booked_at', bookedTime);
        }
        const { count, error } = await aheadQuery;
        if (!error && count != null) {
          aheadCount = count;
        }
      }

      return {
        createdAt: createdAt,
        createdDate: createdAt,
        arrivedAt: arrivedAt,
        appt: res.appointment_at ? fmtDate(res.appointment_at) : '',
        dueDate: res.due_date ? fmtDay(res.due_date) : '',
        hasArrived: hasArrived,
        totalWaitDays: totalWaitDays,
        currentWaitDays: currentWaitDays,
        waitDays: currentWaitDays,
        aheadCount: aheadCount
      };
    },

    async getAppointmentSlot(tokenOrWhen, when) {
      return { ok: true, available: true };
    },

    // -------------------------------------------------------------
    // PRINT & BATCH PRINT
    // -------------------------------------------------------------
    async getPrintData(tokenOrId, id) {
      const resId = optFirst(tokenOrId, id);
      const { data: r } = await sb().from('reservations').select('*').eq('id', resId).single();
      if (!r) throw new Error('ไม่พบข้อมูลพิมพ์');

      const checkUrl = getCheckUrl(r.token);
      return {
        id: r.id,
        token: r.token,
        checkUrl: checkUrl,
        customerName: r.customer_name,
        name: r.customer_name,
        phone: r.phone,
        group: r.customer_group,
        customerGroup: r.customer_group,
        model: r.model,
        capacity: r.capacity,
        color: r.color,
        deposit: r.deposit,
        billNo: r.bill_no,
        dueDate: r.due_date ? fmtDay(r.due_date) : '',
        appt: fmtAppt(r),
        preOrder: extractPreOrder(r),
        preBooking: r.pre_booking_no || '',
        additionalNote: r.extra_notes || '',
        status: r.status,
        price: r.price_at_booking,
        supplier: r.specified_supplier,
        lockSupplier: r.lock_supplier,
        storeName: 'iStudio Central Embassy'
      };
    },

    async getPrintDataBatch(tokenOrIds, ids) {
      const targetIds = Array.isArray(tokenOrIds) ? tokenOrIds : (ids || []);
      const { data } = await sb().from('reservations').select('*').in('id', targetIds);
      return (data || []).map(r => ({
        id: r.id,
        token: r.token,
        checkUrl: getCheckUrl(r.token),
        customerName: r.customer_name,
        name: r.customer_name,
        phone: r.phone,
        group: r.customer_group,
        customerGroup: r.customer_group,
        model: r.model,
        capacity: r.capacity,
        color: r.color,
        deposit: r.deposit,
        billNo: r.bill_no,
        dueDate: r.due_date ? fmtDay(r.due_date) : '',
        appt: fmtAppt(r),
        preOrder: extractPreOrder(r),
        preBooking: r.pre_booking_no || '',
        additionalNote: r.extra_notes || '',
        status: r.status,
        price: r.price_at_booking,
        supplier: r.specified_supplier,
        lockSupplier: r.lock_supplier,
        storeName: 'iStudio Central Embassy'
      }));
    },

    async markLabeledBatch(tokenOrIds, ids) {
      const targetIds = Array.isArray(tokenOrIds) ? tokenOrIds : (ids || []);
      await sb().from('reservations').update({ is_labeled: true }).in('id', targetIds);
      return { ok: true, count: targetIds.length };
    },

    async getBulkWorkspace() {
      const rows = [];
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await sb().from('reservations').select('*')
          .not('status', 'in', '("รับของแล้ว","ยกเลิก")')
          .order('booked_at', { ascending: false }).order('id', { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw new Error('โหลดรายการสำหรับจัดการหลายรายการไม่สำเร็จ: ' + error.message);
        rows.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }
      const activeRows = rows.filter(r => r.status !== 'รับของแล้ว' && r.status !== 'ยกเลิก');
      const items = activeRows.map(r => Object.assign(mapReservation(r), {
        source: r.source || '',
        batchGroupId: r.batch_group_id || '',
        bookedAtIso: r.booked_at || r.created_at || '',
        appointmentAtIso: r.appointment_at || '',
        extraNotes: r.extra_notes || ''
      }));

      const customerRows = activeRows.filter(r => r.source === 'customer');
      const signature = r => [r.model, r.capacity, r.color].map(v => String(v || '').trim().toLowerCase()).join('|');
      const batches = new Map();
      customerRows.forEach(r => {
        const key = r.batch_group_id || ('NO_BATCH:' + r.id);
        if (!batches.has(key)) batches.set(key, []);
        batches.get(key).push(r);
      });
      const duplicateCandidates = [];
      batches.forEach((batchRows, batchId) => {
        const bySpec = new Map();
        batchRows.forEach(r => {
          const key = signature(r);
          if (!bySpec.has(key)) bySpec.set(key, []);
          bySpec.get(key).push(r);
        });
        bySpec.forEach(specRows => {
          if (specRows.length > 1) duplicateCandidates.push({
            key: 'inside:' + batchId + ':' + signature(specRows[0]),
            type: 'same_submission', severity: 'medium', ids: specRows.map(r => r.id),
            name: specRows[0].customer_name, phone: specRows[0].phone,
            spec: [specRows[0].model, specRows[0].capacity, specRows[0].color].filter(Boolean).join(' · '),
            detail: 'สเปกเหมือนกัน ' + specRows.length + ' เครื่องในการส่งครั้งเดียว'
          });
        });
      });

      const batchSummaries = [];
      batches.forEach((batchRows, batchId) => {
        const times = batchRows.map(r => Date.parse(r.booked_at || r.created_at)).filter(Number.isFinite);
        batchSummaries.push({
          id: batchId, phone: normPhone(batchRows[0] && batchRows[0].phone), rows: batchRows,
          at: times.length ? Math.min.apply(Math, times) : 0,
          signature: batchRows.map(signature).sort().join('||')
        });
      });
      const byPhone = new Map();
      batchSummaries.forEach(b => { if (!byPhone.has(b.phone)) byPhone.set(b.phone, []); byPhone.get(b.phone).push(b); });
      byPhone.forEach(phoneBatches => {
        phoneBatches.sort((a, b) => a.at - b.at);
        for (let i = 0; i < phoneBatches.length; i++) {
          for (let j = i + 1; j < phoneBatches.length; j++) {
            const gapSeconds = Math.round((phoneBatches[j].at - phoneBatches[i].at) / 1000);
            if (gapSeconds > 900) break;
            if (phoneBatches[i].signature !== phoneBatches[j].signature) continue;
            const allRows = phoneBatches[i].rows.concat(phoneBatches[j].rows);
            duplicateCandidates.push({
              key: 'repeat:' + phoneBatches[i].id + ':' + phoneBatches[j].id,
              type: 'repeated_submission', severity: gapSeconds <= 120 ? 'high' : 'medium', ids: allRows.map(r => r.id),
              name: allRows[0].customer_name, phone: allRows[0].phone,
              spec: phoneBatches[j].rows.map(r => [r.model, r.capacity, r.color].filter(Boolean).join(' · ')).join(' / '),
              detail: 'ส่งข้อมูลเหมือนกันซ้ำภายใน ' + gapSeconds + ' วินาที'
            });
          }
        }
      });

      return { items: items, duplicateCandidates: duplicateCandidates };
    },

    async performBatchAction(request) {
      const req = request || {};
      const ids = Array.isArray(req.ids) ? Array.from(new Set(req.ids.map(String).filter(Boolean))) : [];
      if (!ids.length) throw new Error('กรุณาเลือกอย่างน้อย 1 รายการ');
      if (ids.length > 100) throw new Error('ทำรายการได้สูงสุดครั้งละ 100 รายการ');
      if (!/^[0-9a-f-]{36}$/i.test(String(req.requestId || ''))) throw new Error('ไม่พบ Request ID ของชุดงาน');
      if (req.action === 'appointment') validatedAppointmentDate(req.payload && req.payload.appointment_at);
      const { data, error } = await sb().rpc('perform_batch_action', {
        p_request_id: req.requestId,
        p_action: req.action,
        p_ids: ids,
        p_payload: req.payload || {},
        p_actor: req.actor || 'Staff'
      });
      if (error) throw new Error(error.message || 'ดำเนินการหลายรายการไม่สำเร็จ');
      return data || { ok: true, count: ids.length };
    },

    async listBatchPrintCandidates(tokenOrFilter, filter) {
      const f = (typeof tokenOrFilter === 'object' && tokenOrFilter !== null) ? tokenOrFilter : (filter || {});
      let query = sb().from('reservations').select('*').in('status', ['ของมาแล้ว', 'นัดรับแล้ว', 'รอสินค้า']);
      if (f.group) query = query.eq('customer_group', f.group);
      if (f.status) query = query.eq('status', f.status);
      if (f.model) query = query.eq('model', f.model);
      if (f.capacity) query = query.eq('capacity', f.capacity);
      if (f.color) query = query.eq('color', f.color);
      if (f.aisOnly) query = query.eq('lock_supplier', true);
      if (f.labeled === 'yes') query = query.eq('is_labeled', true);
      if (f.labeled === 'no') query = query.or('is_labeled.is.null,is_labeled.eq.false');
      if (f.apptFrom) query = query.gte('appointment_at', f.apptFrom + 'T00:00:00');
      if (f.apptTo) query = query.lte('appointment_at', f.apptTo + 'T23:59:59');
      if (f.q) {
        const q = String(f.q).trim();
        query = query.or(`customer_name.ilike.%${q}%,phone.ilike.%${q}%,id.ilike.%${q}%,model.ilike.%${q}%,bill_no.ilike.%${q}%,pre_order_no.ilike.%${q}%`);
      }
      const { data } = await query;
      return {
        items: (data || []).map(r => ({
          id: r.id,
          name: r.customer_name,
          phone: r.phone,
          group: r.customer_group || 'Walk-in',
          customerGroup: r.customer_group || 'Walk-in',
          model: r.model,
          capacity: r.capacity,
          color: r.color,
          status: r.status,
          displayStatus: r.status,
          token: r.token,
          checkUrl: getCheckUrl(r.token),
          labeled: !!r.is_labeled,
          isLabeled: !!r.is_labeled,
          preOrder: r.pre_order_no || '',
          preBooking: r.pre_booking_no || '',
          supplierLock: !!r.lock_supplier,
          lockSupplier: !!r.lock_supplier,
          promo: r.campaign,
          dueDate: r.due_date ? fmtDay(r.due_date) : '',
          appt: fmtAppt(r) || (r.due_date ? fmtDay(r.due_date) : '-')
        })),
        total: (data || []).length,
        maxSelection: 50
      };
    },

    async prepareBatchPrintJob(tokenOrReq, request) {
      const req = (typeof tokenOrReq === 'object' && tokenOrReq !== null) ? tokenOrReq : (request || {});
      const ids = req.ids || [];
      const { data } = await sb().from('reservations').select('*').in('id', ids);
      return {
        jobId: 'job_' + Date.now(),
        type: req.type || 'label',
        format: req.format || 'a4',
        scale: req.scale || 100,
        items: (data || []).map(r => ({
          id: r.id,
          token: r.token,
          checkUrl: getCheckUrl(r.token),
          customerName: r.customer_name,
          name: r.customer_name,
          maskedName: maskName(r.customer_name),
          maskedPhone: maskPhone(r.phone),
          phone: r.phone,
          group: r.customer_group,
          customerGroup: r.customer_group,
          model: r.model,
          capacity: r.capacity,
          color: r.color,
          status: r.status,
          deposit: r.deposit,
          billNo: r.bill_no,
          dueDate: r.due_date ? fmtDay(r.due_date) : '',
          appt: fmtAppt(r),
          preOrder: r.pre_order_no || '',
          preBooking: r.pre_booking_no || '',
          additionalNote: r.extra_notes || '',
          price: r.price_at_booking,
          supplier: r.specified_supplier,
          lockSupplier: r.lock_supplier,
          supplierLock: r.lock_supplier,
          promo: r.campaign,
          storeName: 'iStudio Central Embassy'
        }))
      };
    },

    async confirmBatchPrintJob(tokenOrJobId, jobId) {
      return { ok: true };
    },

    // -------------------------------------------------------------
    // STOCK ALLOCATION
    // -------------------------------------------------------------
    async matchStock(tokenOrP, p) {
      const input = (typeof tokenOrP === 'object' && tokenOrP !== null) ? tokenOrP : p;
      if (!input) return { exact: [], alt: [] };

      // Exact matches (FIFO)
      const { data: exact } = await sb()
        .from('reservations')
        .select('*')
        .eq('status', 'รอสินค้า')
        .eq('model', input.model)
        .eq('capacity', input.capacity)
        .eq('color', input.color)
        .order('booked_at', { ascending: true })
        .limit(input.qty || 50);

      // Alternate matches
      const { data: alt } = await sb()
        .from('reservations')
        .select('*')
        .eq('status', 'รอสินค้า')
        .eq('model', input.model)
        .neq('color', input.color)
        .ilike('alternate_colors', '%' + input.color + '%')
        .order('booked_at', { ascending: true })
        .limit(input.qty || 50);

      const calcWaitDays = (d) => {
        if (!d) return 0;
        const t = new Date(d).getTime();
        if (isNaN(t)) return 0;
        return Math.max(0, Math.floor((Date.now() - t) / 86400000));
      };

      const mapMatchedRes = (r, matchType) => ({
        id: r.id,
        name: r.customer_name || r.name || '',
        phone: r.phone || '',
        group: r.customer_group || r.group || 'Walk-in',
        model: r.model || '',
        capacity: r.capacity || '',
        color: r.color || '',
        supplierLock: !!r.supplier_lock,
        supplier: r.supplier || (r.supplier_lock ? 'AIS' : ''),
        promo: r.promo || '',
        urgent: !!r.is_urgent,
        isUrgent: !!r.is_urgent,
        waitDays: calcWaitDays(r.booked_at || r.created_at),
        createdAt: fmtDate(r.booked_at || r.created_at),
        bookedAt: fmtDate(r.booked_at || r.created_at),
        matchType: matchType,
        altReason: matchType === 'รับสีสำรองได้' ? 'รับสีสำรองได้' : ''
      });

      return {
        exact: (exact || []).map(r => mapMatchedRes(r, 'ตรงตามที่ต้องการ')),
        alt: (alt || []).map(r => mapMatchedRes(r, 'รับสีสำรองได้'))
      };
    },

    async allocateToCustomer(tokenOrId, idOrDue, dueOrLot, lotKey) {
      let id, dueDate;
      if (typeof tokenOrId === 'string' && (tokenOrId.startsWith('staff_') || tokenOrId === 'logged_in')) {
        id = idOrDue; dueDate = dueOrLot;
      } else {
        id = tokenOrId; dueDate = idOrDue;
      }

      await sb().from('reservations').update({
        status: 'ของมาแล้ว',
        due_date: dueDate || new Date(Date.now() + 5*86400000).toISOString().slice(0, 10),
        updated_at: new Date().toISOString()
      }).eq('id', id);

      await sb().from('notes').insert({
        reservation_id: id,
        author: 'Staff',
        message: 'จัดสรรสินค้าเข้าคิวเรียบร้อยแล้ว สถานะเปลี่ยนเป็น: ของมาแล้ว',
        source: 'auto',
        created_at: new Date().toISOString()
      });
      return true;
    },

    async resetStockLot(supplier, model, cap, col, q) {
      return { ok: true, declared: Number(q) || 0, remaining: Number(q) || 0 };
    },

    // -------------------------------------------------------------
    // SETTINGS (ตั้งค่า)
    // -------------------------------------------------------------
    async adminList(tokenOrSheet, sheetName) {
      const sheet = optFirst(tokenOrSheet, sheetName);
      if (sheet === 'รุ่นสินค้า') {
        const { data } = await sb().from('products').select('*').order('id');
        const rows = (data || []).map((p, idx) => ({
          _row: p.id || (idx + 2),
          'รุ่น': p.model,
          'ความจุ': p.capacities,
          'สี': p.colors,
          'เปิดรับจอง': p.is_active,
          'ราคา': p.prices
        }));
        return { head: ['รุ่น', 'ความจุ', 'สี', 'เปิดรับจอง', 'ราคา'], rows: rows };
      }
      if (sheet === 'กลุ่มลูกค้า') {
        const { data } = await sb().from('customer_groups').select('*').order('sort_order');
        const rows = (data || []).map((g, idx) => ({
          _row: g.id || (idx + 2),
          'ชื่อกลุ่ม': g.name,
          'เปิดใช้': g.is_active,
          'สีป้าย': g.badge_color,
          'ต้องกรอกเลขอ้างอิง': g.require_ref_no,
          'ค่าเริ่มต้น': g.is_default,
          'ลำดับแสดงผล': g.sort_order
        }));
        return { head: ['ชื่อกลุ่ม', 'เปิดใช้', 'สีป้าย', 'ต้องกรอกเลขอ้างอิง', 'ค่าเริ่มต้น', 'ลำดับแสดงผล'], rows: rows };
      }
      if (sheet === 'ซัพพลายเออร์') {
        const { data } = await sb().from('suppliers').select('*').order('id');
        const rows = (data || []).map((s, idx) => ({
          _row: s.id || (idx + 2),
          'ชื่อซัพพลายเออร์': s.name,
          'เปิดใช้': s.is_active
        }));
        return { head: ['ชื่อซัพพลายเออร์', 'เปิดใช้'], rows: rows };
      }
      if (sheet === 'โครงการส่วนลด') {
        const { data } = await sb().from('discount_campaigns').select('*').order('id');
        const rows = (data || []).map((c, idx) => ({
          _row: c.id || (idx + 2),
          'ชื่อโครงการ': c.name,
          'คำอธิบาย': c.description,
          'เปิดใช้': c.is_active
        }));
        return { head: ['ชื่อโครงการ', 'คำอธิบาย', 'เปิดใช้'], rows: rows };
      }
      if (sheet === 'ค่าระบบ') {
        const { data } = await sb().from('system_configs').select('*');
        const list = data || [];
        const hasDelay = list.some(c => c.key === 'หน่วงเวลา Popup บันทึกข้อมูล' || c.key === 'หน่วงเวลา Popup');
        if (!hasDelay) {
          list.push({
            key: 'หน่วงเวลา Popup บันทึกข้อมูล',
            value: 'TRUE',
            description: 'เปิดดีเลย์ 2-3 วินาทีสำหรับ Popup กำลังบันทึกข้อมูลและยืนยัน เพื่อให้อ่านทัน'
          });
        }
        const rows = list.map((cfg, idx) => ({
          _row: idx + 2,
          'คีย์': cfg.key,
          'ค่า': cfg.value,
          'คำอธิบาย': cfg.description || ''
        }));
        return { head: ['คีย์', 'ค่า', 'คำอธิบาย'], rows: rows };
      }
      return { head: [], rows: [] };
    },

    async adminSaveBatch(tokenOrBatch, batch) {
      const b = (typeof tokenOrBatch === 'object' && tokenOrBatch !== null) ? tokenOrBatch : (batch || {});
      for (const sheet of Object.keys(b)) {
        const change = b[sheet];
        if (sheet === 'รุ่นสินค้า') {
          if (change.adds && change.adds.length) {
            for (const v of change.adds) {
              await sb().from('products').insert({
                model: v[0],
                capacities: v[1],
                colors: v[2],
                is_active: v[3] === true || String(v[3]) === 'true',
                prices: v[4]
              });
            }
          }
          if (change.updates && change.updates.length) {
            for (const u of change.updates) {
              const v = u.values;
              await sb().from('products').update({
                model: v[0],
                capacities: v[1],
                colors: v[2],
                is_active: v[3] === true || String(v[3]) === 'true',
                prices: v[4]
              }).eq('id', u.row);
            }
          }
          if (change.deletes && change.deletes.length) {
            for (const d of change.deletes) {
              await sb().from('products').delete().eq('id', d.row);
            }
          }
        } else if (sheet === 'กลุ่มลูกค้า') {
          if (change.adds && change.adds.length) {
            for (const v of change.adds) {
              await sb().from('customer_groups').insert({
                name: v[0],
                is_active: v[1] === true || String(v[1]) === 'true',
                badge_color: v[2] || '#444441',
                require_ref_no: v[3] === true || String(v[3]) === 'true',
                is_default: v[4] === true || String(v[4]) === 'true',
                sort_order: Number(v[5]) || 99
              });
            }
          }
          if (change.updates && change.updates.length) {
            for (const u of change.updates) {
              const v = u.values;
              await sb().from('customer_groups').update({
                name: v[0],
                is_active: v[1] === true || String(v[1]) === 'true',
                badge_color: v[2] || '#444441',
                require_ref_no: v[3] === true || String(v[3]) === 'true',
                is_default: v[4] === true || String(v[4]) === 'true',
                sort_order: Number(v[5]) || 99
              }).eq('id', u.row);
            }
          }
          if (change.deletes && change.deletes.length) {
            for (const d of change.deletes) {
              await sb().from('customer_groups').delete().eq('id', d.row);
            }
          }
        } else if (sheet === 'ซัพพลายเออร์') {
          if (change.adds && change.adds.length) {
            for (const v of change.adds) {
              await sb().from('suppliers').insert({
                name: v[0],
                is_active: v[1] === true || String(v[1]) === 'true'
              });
            }
          }
          if (change.updates && change.updates.length) {
            for (const u of change.updates) {
              const v = u.values;
              await sb().from('suppliers').update({
                name: v[0],
                is_active: v[1] === true || String(v[1]) === 'true'
              }).eq('id', u.row);
            }
          }
          if (change.deletes && change.deletes.length) {
            for (const d of change.deletes) {
              await sb().from('suppliers').delete().eq('id', d.row);
            }
          }
        } else if (sheet === 'โครงการส่วนลด') {
          if (change.adds && change.adds.length) {
            for (const v of change.adds) {
              await sb().from('discount_campaigns').insert({
                name: v[0],
                description: v[1],
                is_active: v[2] === true || String(v[2]) === 'true'
              });
            }
          }
          if (change.updates && change.updates.length) {
            for (const u of change.updates) {
              const v = u.values;
              await sb().from('discount_campaigns').update({
                name: v[0],
                description: v[1],
                is_active: v[2] === true || String(v[2]) === 'true'
              }).eq('id', u.row);
            }
          }
          if (change.deletes && change.deletes.length) {
            for (const d of change.deletes) {
              await sb().from('discount_campaigns').delete().eq('id', d.row);
            }
          }
        } else if (sheet === 'ค่าระบบ') {
          if (change.updates && change.updates.length) {
            for (const u of change.updates) {
              const v = u.values;
              await sb().from('system_configs').upsert({
                key: v[0],
                value: String(v[1]),
                description: v[2]
              }, { onConflict: 'key' });
            }
          }
        }
      }
      return true;
    },

    // -------------------------------------------------------------
    // REPORTS (รายงาน & สเปกยอดนิยม)
    // -------------------------------------------------------------
    async reportGetDashboard(tokenOrFilter, filter) {
      const f = (typeof tokenOrFilter === 'object' && tokenOrFilter !== null) ? tokenOrFilter : (filter || {});
      const [allRes, groupsRes, prodsRes, configsRes] = await Promise.all([
        sb().from('reservations').select('*'),
        sb().from('customer_groups').select('name').order('sort_order'),
        sb().from('products').select('*').order('id'),
        sb().from('system_configs').select('key, value')
      ]);
      if (allRes.error) throw new Error(allRes.error.message);
      const allRows = allRes.data || [];
      const rows = reportFilterRows(allRows, f);
      const configs = {};
      (configsRes.data || []).forEach(c => { configs[c.key] = c.value; });
      const waitLongDays = Number(configs['วันรอนาน']) || 14;
      const callAlertThreshold = Number(configs['ครั้งโทรไม่ติดแล้วเตือน']) || 3;

      const today = bangkokDateKey();
      const defaultStartDate = new Date();
      defaultStartDate.setDate(defaultStartDate.getDate() - 29);
      let start = /^\d{4}-\d{2}-\d{2}$/.test(String(f.start || '')) ? String(f.start) : bangkokDateKey(defaultStartDate);
      let end = /^\d{4}-\d{2}-\d{2}$/.test(String(f.end || '')) ? String(f.end) : today;
      if (start > end) { const swap = start; start = end; end = swap; }
      const maxStart = new Date(end + 'T00:00:00Z');
      maxStart.setUTCDate(maxStart.getUTCDate() - 91);
      const earliest = maxStart.toISOString().slice(0, 10);
      if (start < earliest) start = earliest;
      const inPeriod = key => !!key && key >= start && key <= end;
      const createdKey = r => bangkokDateKey(r.booked_at || r.created_at);
      const updatedKey = r => bangkokDateKey(r.updated_at || r.booked_at || r.created_at);

      const counts = { 'รอตรวจสอบ': 0, 'รอสินค้า': 0, 'ของมาแล้ว': 0, 'นัดรับแล้ว': 0, 'รับของแล้ว': 0, 'ยกเลิก': 0 };
      let unknownStatuses = 0;
      rows.forEach(r => {
        if (counts[r.status] !== undefined) counts[r.status]++;
        else unknownStatuses++;
      });

      // 1. Build Product Analytics
      const specMap = {};
      rows.forEach(r => {
        const model = r.model || 'ไม่ระบุรุ่น';
        const capacity = r.capacity || 'ไม่ระบุ';
        const color = r.color || 'ไม่ระบุ';
        const key = [model, capacity, color].join('|');
        if (!specMap[key]) {
          specMap[key] = {
            model: model,
            capacity: capacity,
            color: color,
            demand: 0,
            sold: 0,
            backlog: 0,
            allocated: 0,
            cancelled: 0,
            closed: 0,
            successRate: null
          };
        }
        const item = specMap[key];
        if (inPeriod(createdKey(r))) item.demand++;
        if (r.status === 'รับของแล้ว' && inPeriod(updatedKey(r))) item.sold++;
        if (r.status === 'ยกเลิก' && inPeriod(updatedKey(r))) item.cancelled++;
        if (r.status === 'รอตรวจสอบ' || r.status === 'รอสินค้า') item.backlog++;
        if (r.status === 'ของมาแล้ว' || r.status === 'นัดรับแล้ว') item.allocated++;
      });

      const specs = Object.keys(specMap).map(k => {
        const item = specMap[k];
        item.closed = item.sold + item.cancelled;
        item.successRate = item.closed ? Math.round((item.sold * 1000) / item.closed) / 10 : null;
        item.label = item.model + ' · ' + item.capacity + ' · ' + item.color;
        return item;
      }).filter(item => item.demand || item.sold || item.backlog || item.allocated || item.cancelled);

      function rollupDimension(field) {
        const rmap = {};
        specs.forEach(s => {
          const val = s[field] || 'ไม่ระบุ';
          if (!rmap[val]) {
            rmap[val] = {
              model: '',
              capacity: '',
              color: '',
              demand: 0,
              sold: 0,
              backlog: 0,
              allocated: 0,
              cancelled: 0,
              closed: 0,
              successRate: null,
              value: val
            };
          }
          ['demand', 'sold', 'backlog', 'allocated', 'cancelled'].forEach(m => {
            rmap[val][m] += s[m];
          });
        });
        return Object.keys(rmap).map(val => {
          const item = rmap[val];
          item.closed = item.sold + item.cancelled;
          item.successRate = item.closed ? Math.round((item.sold * 1000) / item.closed) / 10 : null;
          return item;
        });
      }

      const dimensions = {
        model: rollupDimension('model'),
        capacity: rollupDimension('capacity'),
        color: rollupDimension('color'),
        spec: specs.map(item => Object.assign({}, item, { value: item.label }))
      };

      function topMetric(items, metric) {
        let usable = (items || []).filter(item => metric === 'successRate' ? item.closed >= 1 : item[metric] > 0);
        if (!usable.length) usable = items || [];
        if (!usable.length) return null;
        const sorted = usable.slice().sort((a, b) => {
          if (metric === 'successRate') {
            const sa = a.successRate == null ? -1 : a.successRate;
            const sb = b.successRate == null ? -1 : b.successRate;
            return sb - sa;
          }
          return (b[metric] || 0) - (a[metric] || 0);
        });
        return sorted[0] || null;
      }

      const rankings = {};
      ['demand', 'sold', 'backlog', 'successRate'].forEach(metric => {
        rankings[metric] = {
          model: topMetric(dimensions.model, metric),
          capacity: topMetric(dimensions.capacity, metric),
          color: topMetric(dimensions.color, metric),
          spec: topMetric(dimensions.spec, metric)
        };
      });

      // 2. Build Product Summary
      const productSummaryMap = {};
      rows.forEach(r => {
        const model = r.model || 'ไม่ระบุรุ่น';
        const capacity = r.capacity || 'ไม่ระบุ';
        const color = r.color || 'ไม่ระบุ';
        const key = [model, capacity, color].join('|');
        if (!productSummaryMap[key]) {
          productSummaryMap[key] = {
            model: model,
            capacity: capacity,
            color: color,
            pending: 0,
            waiting: 0,
            arrived: 0,
            appointment: 0,
            done: 0,
            cancelled: 0,
            longestWait: 0
          };
        }
        const item = productSummaryMap[key];
        if (r.status === 'รอตรวจสอบ') item.pending++;
        else if (r.status === 'รอสินค้า') item.waiting++;
        else if (r.status === 'ของมาแล้ว') item.arrived++;
        else if (r.status === 'นัดรับแล้ว') item.appointment++;
        else if (r.status === 'รับของแล้ว') item.done++;
        else if (r.status === 'ยกเลิก') item.cancelled++;

        if (r.status === 'รอสินค้า' && r.booked_at) {
          const w = daysBetween(new Date(r.booked_at), new Date());
          if (w > item.longestWait) item.longestWait = w;
        }
      });
      const productSummary = Object.keys(productSummaryMap).map(k => productSummaryMap[k]).sort((a, b) => {
        const pendingA = a.pending + a.waiting;
        const pendingB = b.pending + b.waiting;
        return pendingB - pendingA || b.waiting - a.waiting || a.model.localeCompare(b.model);
      });

      // 3. Actions list
      const actions = buildReportActions(rows, { waitLongDays: waitLongDays, callAlertThreshold: callAlertThreshold });

      // Build daily trend points for the period
      const dayMap = {};
      let cur = new Date(start + 'T00:00:00Z');
      const endD = new Date(end + 'T00:00:00Z');
      while (cur <= endD) {
        const dStr = cur.toISOString().slice(0, 10);
        dayMap[dStr] = { date: dStr, created: 0, done: 0 };
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      rows.forEach(r => {
        const cDate = createdKey(r);
        if (dayMap[cDate]) {
          dayMap[cDate].created++;
        }
        if (r.status === 'รับของแล้ว') {
          const dDate = updatedKey(r);
          if (dayMap[dDate]) {
            dayMap[dDate].done++;
          }
        }
      });

      const trend = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
      const newCount = rows.filter(r => inPeriod(createdKey(r))).length;
      const doneRows = rows.filter(r => r.status === 'รับของแล้ว' && inPeriod(updatedKey(r)));
      const cancelRows = rows.filter(r => r.status === 'ยกเลิก' && inPeriod(updatedKey(r)));
      const closedCount = doneRows.length + cancelRows.length;
      const waitSamples = doneRows.map(r => {
        const booked = parseBookingDate(r);
        const closed = new Date(r.updated_at || r.booked_at || r.created_at || '');
        if (!booked || isNaN(booked.getTime()) || isNaN(closed.getTime())) return null;
        return Math.max(0, daysBetween(booked, closed));
      }).filter(v => v !== null);
      const avgWaitDays = waitSamples.length ? Math.round(waitSamples.reduce((sum, value) => sum + value, 0) * 10 / waitSamples.length) / 10 : null;

      return {
        generatedAt: fmtDate(new Date()),
        appliedFilter: {
          start: start,
          end: end,
          group: f.group || '',
          model: f.model || '',
          quick: f.quick || '30d'
        },
        options: {
          groups: (groupsRes.data || []).map(g => g.name),
          models: (prodsRes.data || []).map(p => p.model)
        },
        current: { total: rows.length, statuses: counts, unknownStatuses: unknownStatuses },
        actions: actions,
        actionRules: { waitLongDays: waitLongDays, callAlertThreshold: callAlertThreshold },
        products: productSummary,
        productAnalytics: {
          specs: specs,
          dimensions: dimensions,
          rankings: rankings
        },
        period: {
          newCount: newCount,
          doneCount: doneRows.length,
          cancelCount: cancelRows.length,
          successRate: closedCount ? Math.round(doneRows.length * 1000 / closedCount) / 10 : null,
          avgWaitDays: avgWaitDays,
          waitSampleSize: waitSamples.length,
          trend: trend
        }
      };
    },

    async reportGetDetails(tokenOrReq, request) {
      const req = (typeof tokenOrReq === 'object' && tokenOrReq !== null) ? tokenOrReq : (request || {});
      const { data: allRes } = await sb().from('reservations').select('*');
      let items = reportFilterRows(allRes || [], req.filter || {});
      let mappedItems = null;

      if (req.kind === 'status' && req.value) {
        items = items.filter(r => r.status === req.value);
      } else if (req.kind === 'model' && req.value) {
        items = items.filter(r => r.model === req.value);
      } else if (req.kind === 'spec' && req.value) {
        items = items.filter(r => (r.model + ' · ' + r.capacity + ' · ' + r.color) === req.value);
      } else if (req.kind === 'action' && req.value) {
        let waitLongDays = 14;
        let callAlertThreshold = 3;
        const { data: configs } = await sb().from('system_configs').select('key, value');
        (configs || []).forEach(c => {
          if (c.key === 'วันรอนาน') waitLongDays = Number(c.value) || waitLongDays;
          if (c.key === 'ครั้งโทรไม่ติดแล้วเตือน') callAlertThreshold = Number(c.value) || callAlertThreshold;
        });
        const actions = buildReportActions(items, { waitLongDays: waitLongDays, callAlertThreshold: callAlertThreshold });
        mappedItems = actions[req.value] || [];
      }

      return {
        title: req.kind === 'action' ? ({
          overdue: 'เลยกำหนด', today: 'นัดรับวันนี้', noCall: 'ยังไม่เคยโทร',
          waitLong: 'รอสินค้านาน', manyFails: 'ติดต่อหลายครั้ง', quality: 'ข้อมูลที่ต้องตรวจสอบ'
        }[req.value] || 'งานที่ต้องจัดการ') : (req.value || 'รายละเอียด'),
        total: mappedItems ? mappedItems.length : items.length,
        items: mappedItems || items.map(mapReservation)
      };
    },

    async exportReservations(tokenOrFilter, filter) {
      const f = (typeof tokenOrFilter === 'object' && tokenOrFilter !== null) ? tokenOrFilter : (filter || {});
      let query = sb().from('reservations').select('*');

      if (f.status) {
        query = query.eq('status', f.status);
      }
      if (f.group) {
        query = query.eq('customer_group', f.group);
      }
      if (f.startDate) {
        query = query.gte('booked_at', f.startDate + 'T00:00:00');
      }
      if (f.endDate) {
        query = query.lte('booked_at', f.endDate + 'T23:59:59');
      }

      query = query.order('booked_at', { ascending: true });
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data || []).map(mapReservation);
    },

    async importReservations(tokenOrItems, items) {
      const rows = Array.isArray(tokenOrItems) ? tokenOrItems : (items || []);
      if (!rows.length) throw new Error('ไม่พบข้อมูลที่จะนำเข้า');

      // ดึงราคาสินค้ามาทำ lookup เผื่อในไฟล์ไม่ได้ระบุราคา
      const { data: prods } = await sb().from('products').select('*');
      const prodMap = {};
      (prods || []).forEach(p => {
        prodMap[p.model] = parsePriceMap(p.prices);
      });

      const todayPrefix = (function() {
        const d = new Date();
        const yy = String(d.getFullYear()).slice(-2);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `R${yy}${mm}${dd}`;
      })();

      const generateUniqueId = () => {
        const rand = Math.floor(1000 + Math.random() * 9000);
        return `${todayPrefix}-${rand}`;
      };

      const generateToken = () => {
        return 'tk_' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
      };

      const reservationsToInsert = [];
      const notesToInsert = [];

      rows.forEach(r => {
        const id = r.id || generateUniqueId();
        const token = r.token || generateToken();
        const bookedAt = r.bookedAt ? new Date(r.bookedAt).toISOString() : new Date().toISOString();

        let price = r.price;
        if ((price == null || price === '') && prodMap[r.model] && prodMap[r.model][r.capacity] != null) {
          price = prodMap[r.model][r.capacity];
        }

        const resObj = {
          id: id,
          token: token,
          customer_name: r.name || 'ไม่ระบุชื่อ',
          phone: r.phone || '',
          contact_channel: r.channel || 'โทรอย่างเดียว',
          contact_id: r.contactId || (r.channel === 'โทรอย่างเดียว' ? (r.phone || '') : ''),
          customer_group: r.group || 'Walk-in',
          model: r.model || '',
          capacity: r.capacity || '',
          color: r.color || '',
          price_at_booking: Number(price) || 0,
          status: r.status || 'รอสินค้า',
          pre_order_no: r.preOrder || r.pre_order_no || '',
          pre_booking_no: r.preBooking || r.pre_booking_no || '',
          lock_supplier: !!r.supplierLock,
          supplier_name: r.supplierLock ? 'AIS' : null,
          campaign: r.promo || null,
          deposit: Number(r.deposit) || 0,
          bill_no: r.billNo || '',
          extra_notes: r.note || '',
          source: 'import',
          booked_at: bookedAt,
          updated_at: new Date().toISOString()
        };
        resObj.pre_order_no = requirePreOrderNumber(resObj.customer_group, resObj.pre_order_no);
        reservationsToInsert.push(resObj);

        notesToInsert.push({
          reservation_id: id,
          author: 'Import',
          message: 'นำเข้ารายการจองจากไฟล์ (' + resObj.model + ' ' + resObj.capacity + ' ' + resObj.color + ')',
          source: 'manual',
          created_at: new Date().toISOString()
        });
      });

      // Insert in chunks of 50
      const CHUNK_SIZE = 50;
      for (let i = 0; i < reservationsToInsert.length; i += CHUNK_SIZE) {
        const resChunk = reservationsToInsert.slice(i, i + CHUNK_SIZE);
        const { error: insErr } = await sb().from('reservations').insert(resChunk);
        if (insErr) throw new Error('เกิดข้อผิดพลาดในการบันทึกนำเข้า: ' + insErr.message);

        const noteChunk = notesToInsert.slice(i, i + CHUNK_SIZE);
        await sb().from('notes').insert(noteChunk);
      }

      return { ok: true, count: reservationsToInsert.length };
    },
  };

  window.api = api;
})(window);
