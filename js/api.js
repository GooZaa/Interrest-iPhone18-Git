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
      appt: r.appointment_at ? fmtDate(r.appointment_at) : '',
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
      updatedAt: updatedAt,
      createdAt: createdAt,
      bookedAt: createdAt
    };
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
      if (window._currentSignupCaptcha) {
        const expected = String(window._currentSignupCaptcha.ans);
        const given = String(data.captchaAnswer || '').trim();
        if (given !== expected) {
          throw new Error('คำตอบไม่ถูกต้อง กรุณาลองใหม่');
        }
      }
      const cleanPhone = normPhone(data.phone);
      const name = String(data.name).trim();

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

      for (const d of data.devices) {
        const id = genShortId();
        const token = genToken();
        const price = d.price || (d.model ? (d.prices && d.prices[d.capacity]) || 0 : 0);

        newReservations.push({
          id: id,
          token: token,
          phone: cleanPhone,
          customer_name: name,
          customer_group: 'Walk-in',
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

      const { error: insErr } = await sb().from('reservations').insert(newReservations);
      if (insErr) throw new Error('เกิดข้อผิดพลาดในการบันทึก: ' + insErr.message);

      await sb().from('notes').insert(notes);
      return { ok: true, count: newReservations.length };
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

      const today = new Date().toISOString().slice(0, 10);
      if (appliedFilter.focus === 'overdue') {
        query = query.eq('status', 'ของมาแล้ว').lt('due_date', today);
      } else if (appliedFilter.focus === 'today') {
        query = query.eq('due_date', today);
      } else if (appliedFilter.focus === 'noCall') {
        query = query.eq('status', 'ของมาแล้ว').eq('call_count', 0);
      } else if (appliedFilter.focus === 'failed') {
        query = query.gte('call_count', 3);
      } else if (appliedFilter.focus === 'pending') {
        query = query.eq('status', 'รอตรวจสอบ');
      }

      if (appliedFilter.q) {
        const q = appliedFilter.q.trim();
        query = query.or(`customer_name.ilike.%${q}%,phone.ilike.%${q}%,id.ilike.%${q}%,model.ilike.%${q}%,bill_no.ilike.%${q}%`);
      }

      query = query.order('booked_at', { ascending: true }).limit(500);

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const items = (data || []).map(mapReservation);
      return {
        items: items,
        total: items.length,
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

      await sb().from('customers').upsert({
        phone: cleanPhone,
        name: custName,
        contact_channel: params.contactChannel || params.channel || 'LINE',
        contact_id: params.contactId || '',
        customer_group: params.customerGroup || params.group || 'Walk-in'
      }, { onConflict: 'phone' });

      const batchGroupId = 'B_' + Date.now();
      const reservations = [];
      const notes = [];

      for (const d of params.devices) {
        const id = genShortId();
        const token = genToken();

        reservations.push({
          id: id,
          token: token,
          phone: cleanPhone,
          customer_name: custName,
          customer_group: params.customerGroup || params.group || 'Walk-in',
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

      await sb().from('reservations').insert(reservations);
      await sb().from('notes').insert(notes);
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
        preOrder: data.pre_order_no || '',
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
        updateData.pre_order_no = dataPatch.preOrder || dataPatch.pre_order_no;
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
      await sb().from('reservations').update({
        status: 'รับของแล้ว',
        updated_at: new Date().toISOString()
      }).eq('id', resId);

      await sb().from('notes').insert({
        reservation_id: resId,
        author: 'Staff',
        message: 'ส่งมอบสินค้าเรียบร้อยแล้ว (ปิดรายการ)',
        source: 'auto',
        created_at: new Date().toISOString()
      });
      return true;
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

      const apptDate = new Date(dt);
      let postDueDays = 3;
      try {
        const { data: cfg } = await sb().from('system_configs').select('value').eq('key', 'วันครบกำหนดหลังนัด').single();
        if (cfg && cfg.value) postDueDays = Number(cfg.value) || 3;
      } catch(e){}

      const dueDate = new Date(apptDate.getTime() + postDueDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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

      await sb().from('reservations').update({
        status: 'รอสินค้า',
        customer_group: group || 'Walk-in',
        deposit: Number(deposit) || 0,
        bill_no: billNo || '',
        pre_order_no: pre || '',
        updated_at: new Date().toISOString()
      }).eq('id', id);

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
      const today = new Date().toISOString().slice(0, 10);
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
      const noCallItems = allRows.filter(r => r.status === 'ของมาแล้ว' && !r.call_count).map(mapReservation);
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
        appt: r.appointment_at ? fmtDate(r.appointment_at) : '',
        preOrder: r.pre_order_no || '',
        preBooking: r.pre_booking_no || '',
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
        appt: r.appointment_at ? fmtDate(r.appointment_at) : '',
        preOrder: r.pre_order_no || '',
        preBooking: r.pre_booking_no || '',
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

    async listBatchPrintCandidates(tokenOrFilter, filter) {
      const f = (typeof tokenOrFilter === 'object' && tokenOrFilter !== null) ? tokenOrFilter : (filter || {});
      let query = sb().from('reservations').select('*').in('status', ['ของมาแล้ว', 'นัดรับแล้ว', 'รอสินค้า']);
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
          token: r.token,
          checkUrl: getCheckUrl(r.token),
          labeled: !!r.is_labeled,
          isLabeled: !!r.is_labeled,
          appt: r.appointment_at ? fmtDate(r.appointment_at) : (r.due_date ? fmtDay(r.due_date) : '-')
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
          phone: r.phone,
          group: r.customer_group,
          model: r.model,
          capacity: r.capacity,
          color: r.color,
          status: r.status,
          deposit: r.deposit,
          billNo: r.bill_no,
          price: r.price_at_booking,
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
      const [allRes, groupsRes, prodsRes] = await Promise.all([
        sb().from('reservations').select('*'),
        sb().from('customer_groups').select('name').order('sort_order'),
        sb().from('products').select('*').order('id')
      ]);
      const rows = allRes.data || [];

      const counts = { 'รอตรวจสอบ': 0, 'รอสินค้า': 0, 'ของมาแล้ว': 0, 'นัดรับแล้ว': 0, 'รับของแล้ว': 0, 'ยกเลิก': 0 };
      rows.forEach(r => {
        if (counts[r.status] !== undefined) counts[r.status]++;
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
        item.demand++;
        if (r.status === 'รับของแล้ว') item.sold++;
        if (r.status === 'ยกเลิก') item.cancelled++;
        if (r.status === 'รอตรวจสอบ' || r.status === 'รอสินค้า') item.backlog++;
        if (r.status === 'ของมาแล้ว' || r.status === 'นัดรับแล้ว') item.allocated++;
      });

      const specs = Object.keys(specMap).map(k => {
        const item = specMap[k];
        item.closed = item.sold + item.cancelled;
        item.successRate = item.closed ? Math.round((item.sold * 1000) / item.closed) / 10 : null;
        item.label = item.model + ' · ' + item.capacity + ' · ' + item.color;
        return item;
      });

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
      const productSummary = Object.keys(productSummaryMap).map(k => productSummaryMap[k]);

      // 3. Actions list
      const today = new Date().toISOString().slice(0, 10);
      const overdueActions = rows.filter(r => r.status === 'ของมาแล้ว' && r.due_date && r.due_date < today).map(mapReservation);
      const todayActions = rows.filter(r => r.due_date === today).map(mapReservation);
      const noCallActions = rows.filter(r => r.status === 'ของมาแล้ว' && !r.call_count).map(mapReservation);
      const waitLongActions = rows.filter(r => r.status === 'รอสินค้า' && r.booked_at && daysBetween(new Date(r.booked_at), new Date()) > 7).map(mapReservation);
      const manyFailsActions = rows.filter(r => (r.call_count || 0) >= 3).map(mapReservation);

      const start = f.start || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const end = f.end || new Date().toISOString().slice(0, 10);

      // Build daily trend points for the period
      const dayMap = {};
      let cur = new Date(start + 'T00:00:00');
      const endD = new Date(end + 'T23:59:59');
      while (cur <= endD) {
        const dStr = cur.toISOString().slice(0, 10);
        dayMap[dStr] = { date: dStr, created: 0, done: 0 };
        cur.setDate(cur.getDate() + 1);
      }

      rows.forEach(r => {
        const cDate = (r.booked_at || r.created_at || '').slice(0, 10);
        if (dayMap[cDate]) {
          dayMap[cDate].created++;
        }
        if (r.status === 'รับของแล้ว') {
          const dDate = (r.updated_at || r.booked_at || r.created_at || '').slice(0, 10);
          if (dayMap[dDate]) {
            dayMap[dDate].done++;
          }
        }
      });

      const trend = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

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
        current: { total: rows.length, statuses: counts },
        actions: {
          overdue: overdueActions,
          today: todayActions,
          noCall: noCallActions,
          waitLong: waitLongActions,
          manyFails: manyFailsActions,
          quality: []
        },
        products: productSummary,
        productAnalytics: {
          specs: specs,
          dimensions: dimensions,
          rankings: rankings
        },
        period: {
          newCount: rows.length,
          doneCount: counts['รับของแล้ว'] || 0,
          cancelCount: counts['ยกเลิก'] || 0,
          trend: trend
        }
      };
    },

    async reportGetDetails(tokenOrReq, request) {
      const req = (typeof tokenOrReq === 'object' && tokenOrReq !== null) ? tokenOrReq : (request || {});
      const { data: allRes } = await sb().from('reservations').select('*');
      let items = allRes || [];

      if (req.kind === 'status' && req.value) {
        items = items.filter(r => r.status === req.value);
      } else if (req.kind === 'model' && req.value) {
        items = items.filter(r => r.model === req.value);
      } else if (req.kind === 'spec' && req.value) {
        items = items.filter(r => (r.model + ' · ' + r.capacity + ' · ' + r.color) === req.value);
      }

      return {
        title: req.value || 'รายละเอียด',
        total: items.length,
        items: items.map(mapReservation)
      };
    }
  };

  window.api = api;
})(window);
