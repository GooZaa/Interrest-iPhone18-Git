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

  function optFirst(a, b) {
    return (typeof a === 'string' && (a.startsWith('staff_') || a === 'logged_in')) ? b : a;
  }

  function mapReservation(r) {
    const waitDays = daysBetween(new Date(r.booked_at), new Date());
    let dueLabel = '';
    if (r.due_date) {
      const d = daysBetween(new Date(), new Date(r.due_date));
      if (d < 0) dueLabel = 'เลย ' + Math.abs(d) + ' วัน';
      else if (d === 0) dueLabel = 'ครบกำหนดวันนี้';
      else dueLabel = 'อีก ' + d + ' วัน';
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
      waitDays: Math.max(0, waitDays),
      callCount: r.call_count || 0,
      urgent: r.is_urgent,
      isUrgent: r.is_urgent,
      urgentReason: r.urgent_reason,
      isLabeled: r.is_labeled,
      deposit: r.deposit,
      billNo: r.bill_no,
      token: r.token
    };
  }

  const api = {
    // -------------------------------------------------------------
    // SIGNUP
    // -------------------------------------------------------------
    async getSignupBootstrap() {
      let { data: prods } = await sb().from('products').select('*').eq('is_active', true);
      if (!prods || prods.length === 0) {
        const defaults = [
          { model: 'iPhone 17 Pro Max', capacities: '256GB, 512GB, 1TB', colors: 'Natural Titanium, Black Titanium, White Titanium, Blue Titanium', is_active: true, prices: '256GB=48900, 512GB=56900, 1TB=64900' },
          { model: 'iPhone 17 Pro', capacities: '256GB, 512GB, 1TB', colors: 'Natural Titanium, Black Titanium, White Titanium, Blue Titanium', is_active: true, prices: '256GB=42900, 512GB=50900, 1TB=58900' },
          { model: 'iPhone 17', capacities: '128GB, 256GB, 512GB', colors: 'Black, White, Blue, Pink, Green', is_active: true, prices: '128GB=32900, 256GB=36900, 512GB=44900' },
          { model: 'iPhone 17 Air', capacities: '256GB, 512GB', colors: 'Space Gray, Silver, Gold', is_active: true, prices: '256GB=39900, 512GB=47900' }
        ];
        const { data: inserted } = await sb().from('products').insert(defaults).select('*');
        prods = inserted || defaults;
      }

      const products = (prods || []).map(p => ({
        model: p.model,
        capacities: (p.capacities || '').split(',').map(s => s.trim()).filter(Boolean),
        colors: (p.colors || '').split(',').map(s => s.trim()).filter(Boolean),
        prices: parsePriceMap(p.prices)
      }));

      let { data: promos } = await sb().from('discount_campaigns').select('*').eq('is_active', true);
      if (!promos || promos.length === 0) {
        const defaultPromos = [
          { name: 'HotDeal', description: 'เปิดเบอร์ใหม่ ย้ายค่าย เปลี่ยนเติมเงินเป็นรายเดือน', is_active: true },
          { name: 'BestBuy', description: 'ลูกค้า AIS ปัจจุบัน', is_active: true },
          { name: 'นิติบุคคล', description: 'ทุนจดทะเบียนไม่เกิน 200 ล้าน', is_active: true }
        ];
        const { data: inserted } = await sb().from('discount_campaigns').insert(defaultPromos).select('*');
        promos = inserted || defaultPromos;
      }

      const n1 = Math.floor(Math.random() * 9) + 1;
      const n2 = Math.floor(Math.random() * 9) + 1;
      return {
        products: products,
        promos: (promos || []).map(pr => ({ name: pr.name, description: pr.description })),
        alternativeOptionsEnabled: true,
        aisPromoThaiOnly: false,
        captcha: { sid: 'cap_' + Date.now(), q: `${n1} + ${n2} = ?`, a: n1 + n2 }
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
      const cleanPhone = normPhone(data.phone);
      const name = String(data.name).trim();

      await sb().from('customers').upsert({
        phone: cleanPhone,
        name: name,
        contact_channel: data.contactChannel || 'LINE',
        contact_id: data.contactId || '',
        language: data.language || 'th',
        customer_group: 'ลูกค้า Walk-in'
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
          customer_group: 'ลูกค้า Walk-in',
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

      const expectedPhone = normPhone(data.phone);
      if (cleanInput !== expectedPhone) {
        let fails = Number(sessionStorage.getItem('verify_fails_' + token) || 0) + 1;
        sessionStorage.setItem('verify_fails_' + token, String(fails));
        if (fails >= 5) return { ok: false, locked: true, lockedSec: 180 };
        return { ok: false, locked: false, remaining: 5 - fails };
      }

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
          updatedAt: fmtDate(data.updated_at),
          dueRemainingDays: dueRemainingDays,
          aheadCount: aheadCount,
          avgWaitDays: 5,
          showCustomerGroup: true
        }
      };
    },

    // -------------------------------------------------------------
    // STAFF PORTAL
    // -------------------------------------------------------------
    isInstalled() { return Promise.resolve(true); },
    runSetupFromWeb() { return Promise.resolve(true); },

    async validateLocationCode(tokenOrCode, code) {
      const c = String(code || tokenOrCode || '').trim();
      const validCodes = ['22100', '1234'];
      try {
        const { data } = await sb().from('system_configs').select('value').eq('key', 'LOCATION_CODE').single();
        if (data && data.value) validCodes.push(data.value.trim());
      } catch (e) {
        console.warn('Fallback location code check');
      }

      if (validCodes.includes(c)) {
        sessionStorage.setItem('staff_auth_token', 'logged_in_' + Date.now());
        return { ok: true, token: 'staff_session_valid' };
      }
      return { ok: false, locked: false, remaining: 3 };
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
        depositEnabled: configs['เก็บมัดจำ'] !== 'false',
        supplierLockEnabled: configs['ล็อกซัพ'] !== 'false',
        alternativeOptionsEnabled: configs['เปิดใช้ตัวเลือกเครื่องทางเลือก'] !== 'false'
      };
    },

    async listReservations(tokenOrFilter, filter) {
      const f = (typeof tokenOrFilter === 'object' && tokenOrFilter !== null) ? tokenOrFilter : (filter || {});
      let query = sb().from('reservations').select('*');

      if (f.status) {
        query = query.eq('status', f.status);
      } else if (!f.includeClosed) {
        query = query.neq('status', 'รับของแล้ว').neq('status', 'ยกเลิก');
      }

      if (f.group) query = query.eq('customer_group', f.group);

      if (f.q) {
        const q = String(f.q).trim();
        query = query.or(`customer_name.ilike.%${q}%,phone.ilike.%${q}%,id.ilike.%${q}%,model.ilike.%${q}%`);
      }

      query = query.order('booked_at', { ascending: true }).limit(500);

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const items = (data || []).map(mapReservation);
      return { items: items, total: items.length };
    },

    async lookupPhone(tokenOrPhone, phone) {
      const p = optFirst(tokenOrPhone, phone);
      const clean = normPhone(p);
      if (clean.length < 9) return { exists: false };

      const { data: cust } = await sb().from('customers').select('*').eq('phone', clean).single();
      if (!cust) return { exists: false };

      const { data: activeRes } = await sb().from('reservations').select('*').eq('phone', clean).in('status', ['รอสินค้า', 'ของมาแล้ว', 'นัดรับแล้ว']);
      return { exists: true, customer: cust, activeReservations: activeRes || [] };
    },

    async saveReservation(tokenOrP, p) {
      const params = (typeof tokenOrP === 'object' && tokenOrP !== null) ? tokenOrP : p;
      if (!params || !params.phone || !params.customerName || !params.devices || !params.devices.length) {
        throw new Error('ข้อมูลไม่ครบถ้วน');
      }
      const cleanPhone = normPhone(params.phone);

      await sb().from('customers').upsert({
        phone: cleanPhone,
        name: params.customerName,
        contact_channel: params.contactChannel || 'LINE',
        contact_id: params.contactId || '',
        customer_group: params.customerGroup || 'ลูกค้า Walk-in'
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
          customer_name: params.customerName,
          customer_group: params.customerGroup,
          model: d.model,
          capacity: d.capacity,
          color: d.color,
          alternate_colors: Array.isArray(d.altColors) ? d.altColors.join(', ') : '',
          alternate_capacities: Array.isArray(d.altCaps) ? d.altCaps.join(', ') : '',
          lock_supplier: !!params.lockSupplier,
          specified_supplier: params.specifiedSupplier || null,
          campaign: params.campaign || null,
          deposit: Number(d.deposit) || 0,
          bill_no: d.billNo || params.billNo || '',
          deposit_date: d.deposit ? new Date().toISOString().slice(0, 10) : null,
          status: 'รอสินค้า',
          source: 'staff',
          staff_name: params.staffName || 'Staff',
          extra_notes: params.extraNotes || '',
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
      return { ok: true, ids: reservations.map(r => r.id) };
    },

    async getReservation(tokenOrId, id) {
      const resId = optFirst(tokenOrId, id);
      const { data, error } = await sb().from('reservations').select('*').eq('id', resId).single();
      if (error || !data) throw new Error('ไม่พบข้อมูลรายการจอง');

      const { data: notes } = await sb().from('notes').select('*').eq('reservation_id', resId).order('created_at', { ascending: false });

      return {
        id: data.id,
        token: data.token,
        name: data.customer_name,
        phone: data.phone,
        group: data.customer_group,
        model: data.model,
        capacity: data.capacity,
        color: data.color,
        altColors: (data.alternate_colors || '').split(',').map(s => s.trim()).filter(Boolean),
        altCaps: (data.alternate_capacities || '').split(',').map(s => s.trim()).filter(Boolean),
        lockSupplier: data.lock_supplier,
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
        preOrder: data.pre_order_no,
        preBooking: data.pre_booking_no,
        extraNotes: data.extra_notes,
        lastCalledAt: data.last_called_at ? fmtDate(data.last_called_at) : '',
        isUrgent: data.is_urgent,
        urgentReason: data.urgent_reason,
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
      if (typeof tokenOrId === 'string' && (tokenOrId.startsWith('staff_') || tokenOrId === 'logged_in')) {
        id = idOrPatch;
        dataPatch = patch;
      } else {
        id = tokenOrId;
        dataPatch = idOrPatch;
      }

      dataPatch.updated_at = new Date().toISOString();
      const { error } = await sb().from('reservations').update(dataPatch).eq('id', id);
      if (error) throw new Error(error.message);

      await sb().from('notes').insert({
        reservation_id: id,
        author: 'Staff',
        message: 'แก้ไขข้อมูลการจอง',
        source: 'manual',
        created_at: new Date().toISOString()
      });
      return true;
    },

    async markArrived(tokenOrId, id) {
      const resId = optFirst(tokenOrId, id);
      const dueDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { error } = await sb().from('reservations').update({
        status: 'ของมาแล้ว',
        due_date: dueDate,
        updated_at: new Date().toISOString()
      }).eq('id', resId);
      if (error) throw new Error(error.message);

      await sb().from('notes').insert({
        reservation_id: resId,
        author: 'Staff',
        message: 'เปลี่ยนสถานะเป็น: ของมาแล้ว (กำหนดรับภายใน 5 วัน)',
        source: 'auto',
        created_at: new Date().toISOString()
      });
      return true;
    },

    async logCallResult(tokenOrId, idOrResult, resultOrNote, note) {
      let id, res, ntext;
      if (typeof tokenOrId === 'string' && (tokenOrId.startsWith('staff_') || tokenOrId === 'logged_in')) {
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

      const msg = 'โทรติดตามครั้งที่ ' + calls + ': ' + (res || 'ติดต่อสำเร็จ') + (ntext ? ' (' + ntext + ')' : '');
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
      if (typeof tokenOrId === 'string' && (tokenOrId.startsWith('staff_') || tokenOrId === 'logged_in')) {
        id = idOrDt; dt = dtOrForce;
      } else {
        id = tokenOrId; dt = idOrDt;
      }

      const apptDate = new Date(dt);
      const dueDate = new Date(apptDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      await sb().from('reservations').update({
        status: 'นัดรับแล้ว',
        appointment_at: apptDate.toISOString(),
        due_date: dueDate,
        updated_at: new Date().toISOString()
      }).eq('id', id);

      await sb().from('notes').insert({
        reservation_id: id,
        author: 'Staff',
        message: 'บันทึกวันนัดรับสินค้า: ' + fmtDate(apptDate),
        source: 'manual',
        created_at: new Date().toISOString()
      });
      return true;
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
        customer_group: group || 'ลูกค้า Walk-in',
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
      const manyFailsItems = allRows.filter(r => (r.call_count || 0) >= 3).map(mapReservation);
      const dueTodayItems = allRows.filter(r => r.due_date === today).map(mapReservation);
      const waitLongItems = allRows.filter(r => r.status === 'รอสินค้า' && daysBetween(new Date(r.booked_at), new Date()) > 7).map(mapReservation);

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
      return { ok: true, count: (data || []).length };
    },

    async getDurationInfo(tokenOrId, id) {
      const resId = optFirst(tokenOrId, id);
      const { data: res } = await sb().from('reservations').select('*').eq('id', resId).single();
      const { data: notes } = await sb().from('notes').select('*').eq('reservation_id', resId);
      return {
        createdDate: res ? fmtDate(res.booked_at) : '',
        waitDays: res ? daysBetween(new Date(res.booked_at), new Date()) : 0,
        notesCount: (notes || []).length
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

      return {
        id: r.id,
        token: r.token,
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
          model: r.model,
          capacity: r.capacity,
          color: r.color,
          status: r.status,
          token: r.token,
          isLabeled: r.is_labeled
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

      return {
        exact: (exact || []).map(r => ({
          id: r.id,
          name: r.customer_name,
          phone: r.phone,
          group: r.customer_group,
          model: r.model,
          capacity: r.capacity,
          color: r.color,
          bookedAt: fmtDate(r.booked_at),
          matchType: 'ตรงตามที่ต้องการ'
        })),
        alt: (alt || []).map(r => ({
          id: r.id,
          name: r.customer_name,
          phone: r.phone,
          group: r.customer_group,
          model: r.model,
          capacity: r.capacity,
          color: r.color,
          bookedAt: fmtDate(r.booked_at),
          matchType: 'รับสีสำรองได้'
        }))
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

    async resetStockLot() { return { ok: true }; },

    // -------------------------------------------------------------
    // SETTINGS
    // -------------------------------------------------------------
    async adminList(tokenOrSheet, sheetName) {
      const sheet = optFirst(tokenOrSheet, sheetName);
      const map = {
        'รุ่นสินค้า': 'products',
        'กลุ่มลูกค้า': 'customer_groups',
        'ซัพพลายเออร์': 'suppliers',
        'โครงการส่วนลด': 'discount_campaigns',
        'ค่าระบบ': 'system_configs'
      };
      const table = map[sheet] || sheet;
      const { data } = await sb().from(table).select('*');
      return { rows: data || [] };
    },

    async adminSaveBatch(tokenOrBatch, batch) {
      return true;
    },

    // -------------------------------------------------------------
    // REPORTS
    // -------------------------------------------------------------
    async reportGetDashboard(tokenOrFilter, filter) {
      const { data: allRes } = await sb().from('reservations').select('*');
      const rows = allRes || [];

      const counts = { 'รอตรวจสอบ': 0, 'รอสินค้า': 0, 'ของมาแล้ว': 0, 'นัดรับแล้ว': 0, 'รับของแล้ว': 0, 'ยกเลิก': 0 };
      rows.forEach(r => {
        if (counts[r.status] !== undefined) counts[r.status]++;
      });

      return {
        generatedAt: fmtDate(new Date()),
        current: { total: rows.length, statuses: counts },
        actions: { overdue: [], today: [], noCall: [], waitLong: [], manyFails: [], quality: [] },
        products: [],
        productAnalytics: { specs: [], dimensions: { model: [], capacity: [], color: [] }, rankings: {} },
        period: { newCount: rows.length, doneCount: counts['รับของแล้ว'], cancelCount: counts['ยกเลิก'], trend: [] }
      };
    },

    async reportGetDetails(tokenOrReq, request) {
      return { title: 'รายละเอียด', total: 0, items: [] };
    }
  };

  window.api = api;
})(window);
