/*************************************************************
 * โมดูลรายงาน (Read-only)
 * - แยกจาก Workflow การจอง/จัดสรร/นัดรับโดยสมบูรณ์
 * - ทุก API ต้องผ่าน assertStaff_ และคืนเฉพาะข้อมูลที่ UI ต้องใช้
 *************************************************************/

const REPORT_CACHE_PREFIX = 'queue_report_v3_';
const REPORT_MAX_RANGE_DAYS = 92;

function reportText_(value) { return String(value == null ? '' : value).trim(); }

function reportDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  const text = reportText_(value);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = iso ? new Date(text + 'T00:00:00+07:00') : new Date(value);
  if (isNaN(date.getTime())) return null;
  if (iso && Utilities.formatDate(date, TZ, 'yyyy-MM-dd') !== text) return null;
  return date;
}

function reportDayKey_(value) {
  const date = reportDate_(value);
  return date ? Utilities.formatDate(date, TZ, 'yyyy-MM-dd') : '';
}

function reportDefaultRange_(now) {
  const end = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: Utilities.formatDate(startDate, TZ, 'yyyy-MM-dd'), end: end };
}

function reportNormalizeFilter_(filter, now) {
  filter = filter || {};
  const defaults = reportDefaultRange_(now);
  let start = /^\d{4}-\d{2}-\d{2}$/.test(reportText_(filter.start)) ? reportText_(filter.start) : defaults.start;
  let end = /^\d{4}-\d{2}-\d{2}$/.test(reportText_(filter.end)) ? reportText_(filter.end) : defaults.end;
  let startDate = reportDate_(start), endDate = reportDate_(end);
  if (!startDate || !endDate || startDate > endDate) {
    start = defaults.start; end = defaults.end;
    startDate = reportDate_(start); endDate = reportDate_(end);
  }
  if (daysBetween_(startDate, endDate) > REPORT_MAX_RANGE_DAYS - 1) {
    startDate = new Date(endDate.getTime() - (REPORT_MAX_RANGE_DAYS - 1) * 86400000);
    start = reportDayKey_(startDate);
  }
  return {
    group: reportText_(filter.group).slice(0, 80),
    model: reportText_(filter.model).slice(0, 120),
    start: start,
    end: end
  };
}

function reportInRange_(value, filter) {
  const key = reportDayKey_(value);
  return !!key && key >= filter.start && key <= filter.end;
}

function reportDimensionMatch_(row, filter) {
  if (filter.group && reportText_(row['กลุ่มลูกค้า']) !== filter.group) return false;
  if (filter.model && reportText_(row['รุ่น']) !== filter.model) return false;
  return true;
}

function reportItem_(row, now, reason, severity) {
  const item = toClient_(row, now);
  return {
    id: item.id,
    name: item.name || 'ไม่ระบุชื่อ',
    group: item.group || 'ไม่ระบุกลุ่ม',
    model: item.model || 'ไม่ระบุรุ่น',
    capacity: item.capacity || '',
    color: item.color || '',
    status: item.displayStatus || item.status,
    rawStatus: item.status,
    appt: item.appt || '',
    dueDate: item.dueDate || '',
    waitDays: item.waitDays || 0,
    callCount: item.callCount || 0,
    reason: reason || '',
    severity: severity || 'normal'
  };
}

function reportSortItems_(items) {
  const severity = { high: 0, medium: 1, normal: 2 };
  return items.sort(function (a, b) {
    const sa = severity[a.severity] == null ? 9 : severity[a.severity];
    const sb = severity[b.severity] == null ? 9 : severity[b.severity];
    const s = sa - sb;
    if (s) return s;
    if (b.waitDays !== a.waitDays) return b.waitDays - a.waitDays;
    return String(a.id).localeCompare(String(b.id));
  });
}

function reportStatusCounts_(rows) {
  const counts = {};
  [STATUS.PENDING, STATUS.WAIT, STATUS.ARR, STATUS.APPT, STATUS.DONE, STATUS.CANCEL].forEach(function (s) { counts[s] = 0; });
  rows.forEach(function (row) {
    const status = reportText_(row['สถานะ']);
    counts[status] = (counts[status] || 0) + 1;
  });
  return counts;
}

function reportUnknownStatusCount_(rows) {
  const allowed = [STATUS.PENDING, STATUS.WAIT, STATUS.ARR, STATUS.APPT, STATUS.DONE, STATUS.CANCEL];
  return rows.filter(function (row) { return allowed.indexOf(reportText_(row['สถานะ'])) === -1; }).length;
}

function reportActions_(rows, notes, now, waitLongDays, callThreshold) {
  const byId = {};
  notes.forEach(function (note) {
    const id = reportText_(note['รหัสจอง']);
    if (!byId[id]) byId[id] = [];
    byId[id].push(note);
  });
  const buckets = { overdue: [], today: [], noCall: [], waitLong: [], manyFails: [], quality: [] };
  const seenIds = {};
  rows.forEach(function (row) {
    const id = reportText_(row['รหัสจอง']);
    seenIds[id] = (seenIds[id] || 0) + 1;
    const status = reportText_(row['สถานะ']);
    const calls = Number(row['จำนวนครั้งที่โทร']) || 0;
    const created = reportDate_(row['วันเวลาที่จอง']);
    const waitDays = created ? Math.max(0, daysBetween_(new Date(created.getFullYear(), created.getMonth(), created.getDate()), new Date(now.getFullYear(), now.getMonth(), now.getDate()))) : 0;
    if (workFocusKey_(row, 'overdue', now, callThreshold)) {
      const dueOffset = dayOffset_(row['วันครบกำหนดรับ'], now);
      const pastDue = dueOffset !== null && dueOffset < 0;
      buckets.overdue.push(reportItem_(row, now, pastDue ? 'เลยวันครบกำหนดรับ' : 'เลยเวลานัด แต่ยังไม่ครบกำหนดรับ', pastDue ? 'high' : 'medium'));
    }
    if (workFocusKey_(row, 'today', now, callThreshold)) buckets.today.push(reportItem_(row, now, 'มีนัดรับวันนี้', 'medium'));
    if (status === STATUS.ARR && calls === 0) buckets.noCall.push(reportItem_(row, now, 'ของมาแล้วแต่ยังไม่เคยบันทึกการโทร', 'medium'));
    if (status === STATUS.WAIT && waitDays >= waitLongDays) buckets.waitLong.push(reportItem_(row, now, 'รอสินค้ามาแล้ว ' + waitDays + ' วัน', 'medium'));
    if ((status === STATUS.ARR || status === STATUS.APPT) && calls >= callThreshold) buckets.manyFails.push(reportItem_(row, now, 'บันทึกการโทรแล้ว ' + calls + ' ครั้ง', 'medium'));

    let qualityReason = '';
    if (!id) qualityReason = 'ไม่มีรหัสจอง';
    else if ([STATUS.PENDING, STATUS.WAIT, STATUS.ARR, STATUS.APPT, STATUS.DONE, STATUS.CANCEL].indexOf(status) === -1) qualityReason = 'พบสถานะที่ระบบไม่รู้จัก: ' + (status || 'ว่าง');
    else if (!reportText_(row['กลุ่มลูกค้า'])) qualityReason = 'ไม่ได้ระบุกลุ่มลูกค้า';
    else if (!created) qualityReason = 'ไม่มีวันที่สร้างคิวหรือรูปแบบวันที่ไม่ถูกต้อง';
    else if (status === STATUS.APPT && !reportDate_(row['วันนัดรับ'])) qualityReason = 'สถานะนัดรับแล้ว แต่ไม่มีวันนัดรับ';
    else if (row['วันนัดรับ'] && [STATUS.APPT, STATUS.DONE, STATUS.CANCEL].indexOf(status) === -1) qualityReason = 'มีวันนัดรับ แต่สถานะไม่สัมพันธ์กัน';
    else if (normPhone_(row['เบอร์โทร']).length < 9) qualityReason = 'เบอร์โทรไม่ครบหรือรูปแบบไม่ถูกต้อง';
    else {
      const auditText = autoCancelAuditText_(row, now);
      const hasAudit = auditText && (byId[id] || []).some(function (note) {
        return reportText_(note['ข้อความ']).indexOf(AUTO_CANCEL_AUDIT_PREFIX) === 0;
      });
      if (auditText && !hasAudit) qualityReason = 'ระบบแสดงยกเลิกอัตโนมัติ แต่ไม่พบประวัติ';
    }
    if (qualityReason) buckets.quality.push(reportItem_(row, now, qualityReason, 'high'));
  });
  Object.keys(seenIds).forEach(function (id) {
    if (!id || seenIds[id] < 2) return;
    rows.filter(function (row) { return reportText_(row['รหัสจอง']) === id; }).forEach(function (row) {
      buckets.quality.push(reportItem_(row, now, 'พบรหัสจองซ้ำ ' + seenIds[id] + ' รายการ', 'high'));
    });
  });
  Object.keys(buckets).forEach(function (key) { reportSortItems_(buckets[key]); });
  return buckets;
}

function reportProductSummary_(rows, now) {
  const map = {};
  rows.forEach(function (row) {
    const model = reportText_(row['รุ่น']) || 'ไม่ระบุรุ่น';
    const capacity = reportText_(row['ความจุ']) || 'ไม่ระบุ';
    const color = reportText_(row['สี']) || 'ไม่ระบุ';
    const key = [model, capacity, color].join('\u001f');
    if (!map[key]) map[key] = { model: model, capacity: capacity, color: color, pending: 0, waiting: 0, arrived: 0, appointment: 0, done: 0, cancelled: 0, longestWait: 0 };
    const item = map[key], status = reportText_(row['สถานะ']);
    if (status === STATUS.PENDING) item.pending++;
    else if (status === STATUS.WAIT) item.waiting++;
    else if (status === STATUS.ARR) item.arrived++;
    else if (status === STATUS.APPT) item.appointment++;
    else if (status === STATUS.DONE) item.done++;
    else if (status === STATUS.CANCEL) item.cancelled++;
    if (status === STATUS.WAIT) {
      const created = reportDate_(row['วันเวลาที่จอง']);
      if (created) item.longestWait = Math.max(item.longestWait, Math.max(0, daysBetween_(created, now || new Date())));
    }
  });
  return Object.keys(map).map(function (key) { return map[key]; }).sort(function (a, b) {
    if (b.waiting !== a.waiting) return b.waiting - a.waiting;
    return (b.arrived + b.appointment) - (a.arrived + a.appointment);
  }).slice(0, 40);
}

function reportProductMetricRow_(model, capacity, color) {
  return { model: model, capacity: capacity, color: color, demand: 0, sold: 0, backlog: 0, allocated: 0, cancelled: 0, closed: 0, successRate: null };
}

function reportFinishProductMetric_(item) {
  item.closed = item.sold + item.cancelled;
  item.successRate = item.closed ? Math.round(item.sold * 1000 / item.closed) / 10 : null;
  return item;
}

function reportRollupProductMetric_(specs, field) {
  const map = {};
  specs.forEach(function (spec) {
    const value = reportText_(spec[field]) || 'ไม่ระบุ';
    if (!map[value]) map[value] = reportProductMetricRow_('', '', '');
    ['demand', 'sold', 'backlog', 'allocated', 'cancelled'].forEach(function (metric) { map[value][metric] += Number(spec[metric]) || 0; });
  });
  return Object.keys(map).map(function (value) {
    const item = reportFinishProductMetric_(map[value]);
    item.value = value;
    return item;
  });
}

function reportTopProductMetric_(items, metric) {
  let usable = (items || []).filter(function (item) { return metric === 'successRate' ? item.closed >= 3 : Number(item[metric]) > 0; });
  // ชุดข้อมูลช่วงเริ่มใช้งานอาจยังไม่มีสเปกที่ปิดครบ 3 รายการ จึงแสดงข้อมูลที่มีพร้อมระบุ sample size
  if (metric === 'successRate' && !usable.length) usable = (items || []).filter(function (item) { return item.closed > 0; });
  usable.sort(function (a, b) {
    const av = metric === 'successRate' ? Number(a.successRate) : Number(a[metric]);
    const bv = metric === 'successRate' ? Number(b.successRate) : Number(b[metric]);
    if (bv !== av) return bv - av;
    if (b.closed !== a.closed) return b.closed - a.closed;
    return String(a.value || a.label || '').localeCompare(String(b.value || b.label || ''));
  });
  return usable[0] || null;
}

/**
 * วิเคราะห์สินค้า 4 มุมมอง โดยตั้งใจแยกฐานเวลาให้ตรงความหมาย:
 * demand = วันที่สร้างคิวในช่วง, sold/cancelled = วันที่อัปเดตล่าสุดในช่วง,
 * backlog/allocated = สถานะปัจจุบัน (ไม่จำกัดวัน)
 */
function reportProductAnalytics_(rows, filter) {
  const map = {};
  rows.forEach(function (row) {
    const model = reportText_(row['รุ่น']) || 'ไม่ระบุรุ่น';
    const capacity = reportText_(row['ความจุ']) || 'ไม่ระบุ';
    const color = reportText_(row['สี']) || 'ไม่ระบุ';
    const key = [model, capacity, color].join('\u001f');
    if (!map[key]) map[key] = reportProductMetricRow_(model, capacity, color);
    const item = map[key], status = reportText_(row['สถานะ']);
    if (reportInRange_(row['วันเวลาที่จอง'], filter)) item.demand++;
    if (status === STATUS.DONE && reportInRange_(row['อัปเดตล่าสุด'], filter)) item.sold++;
    if (status === STATUS.CANCEL && reportInRange_(row['อัปเดตล่าสุด'], filter)) item.cancelled++;
    if (status === STATUS.PENDING || status === STATUS.WAIT) item.backlog++;
    if (status === STATUS.ARR || status === STATUS.APPT) item.allocated++;
  });
  const specs = Object.keys(map).map(function (key) {
    const item = reportFinishProductMetric_(map[key]);
    item.label = item.model + ' · ' + item.capacity + ' · ' + item.color;
    return item;
  }).filter(function (item) { return item.demand || item.sold || item.cancelled || item.backlog || item.allocated; });
  const dimensions = {
    model: reportRollupProductMetric_(specs, 'model'),
    capacity: reportRollupProductMetric_(specs, 'capacity'),
    color: reportRollupProductMetric_(specs, 'color'),
    spec: specs.map(function (item) {
      const copy = {};
      Object.keys(item).forEach(function (key) { copy[key] = item[key]; });
      copy.value = item.label;
      return copy;
    })
  };
  const rankings = {};
  ['demand', 'sold', 'backlog', 'successRate'].forEach(function (metric) {
    rankings[metric] = {
      model: reportTopProductMetric_(dimensions.model, metric),
      capacity: reportTopProductMetric_(dimensions.capacity, metric),
      color: reportTopProductMetric_(dimensions.color, metric),
      spec: reportTopProductMetric_(dimensions.spec, metric)
    };
  });
  return { specs: specs, dimensions: dimensions, rankings: rankings };
}

function reportPeriod_(rows, notes, filter) {
  const points = {}, start = reportDate_(filter.start), end = reportDate_(filter.end);
  for (let d = new Date(start.getTime()); d <= end; d.setDate(d.getDate() + 1)) {
    const key = reportDayKey_(d);
    points[key] = { date: key, created: 0, done: 0, cancelled: 0 };
  }
  rows.forEach(function (row) {
    const createdKey = reportDayKey_(row['วันเวลาที่จอง']);
    if (points[createdKey]) points[createdKey].created++;
    const status = reportText_(row['สถานะ']);
    const updatedKey = reportDayKey_(row['อัปเดตล่าสุด']);
    if (points[updatedKey] && status === STATUS.DONE) points[updatedKey].done++;
    if (points[updatedKey] && status === STATUS.CANCEL) points[updatedKey].cancelled++;
  });
  // อัตราปิดสำเร็จอ้างอิงวันที่อัปเดตล่าสุดเสมอ เพื่อให้ตัวตั้งและตัวหารเป็นเหตุการณ์ปิดงานช่วงเดียวกัน
  const closed = rows.filter(function (row) {
    return (row['สถานะ'] === STATUS.DONE || row['สถานะ'] === STATUS.CANCEL) && reportInRange_(row['อัปเดตล่าสุด'], filter);
  });
  const done = closed.filter(function (row) { return row['สถานะ'] === STATUS.DONE; }).length;
  const waitSamples = [];
  const createdById = {};
  rows.forEach(function (row) { createdById[reportText_(row['รหัสจอง'])] = reportDate_(row['วันเวลาที่จอง']); });
  notes.forEach(function (note) {
    if (reportText_(note['ข้อความ']).indexOf('เปลี่ยนเป็น ของมาแล้ว') === -1 || !reportInRange_(note['วันเวลา'], filter)) return;
    const created = createdById[reportText_(note['รหัสจอง'])], arrived = reportDate_(note['วันเวลา']);
    if (created && arrived && arrived >= created) waitSamples.push(daysBetween_(created, arrived));
  });
  return {
    newCount: rows.filter(function (row) { return reportInRange_(row['วันเวลาที่จอง'], filter); }).length,
    doneCount: rows.filter(function (row) { return row['สถานะ'] === STATUS.DONE && reportInRange_(row['อัปเดตล่าสุด'], filter); }).length,
    cancelCount: rows.filter(function (row) { return row['สถานะ'] === STATUS.CANCEL && reportInRange_(row['อัปเดตล่าสุด'], filter); }).length,
    successRate: closed.length ? Math.round(done * 1000 / closed.length) / 10 : null,
    avgWaitDays: waitSamples.length ? Math.round(waitSamples.reduce(function (a, b) { return a + b; }, 0) / waitSamples.length * 10) / 10 : null,
    waitSampleSize: waitSamples.length,
    trend: Object.keys(points).sort().map(function (key) { return points[key]; })
  };
}

/** ข้อมูลหน้า Report ทั้งหมดในคำขอเดียว เพื่อลดจำนวนครั้งที่อ่าน Google Sheets */
function reportGetDashboard(token, filter, forceRefresh) {
  assertStaff_(token);
  const now = new Date(), appliedFilter = reportNormalizeFilter_(filter, now);
  const cache = CacheService.getScriptCache();
  const version = cache.get(CACHE_LIST_VERSION) || '0';
  const cacheKey = REPORT_CACHE_PREFIX + version + '_' + Utilities.base64EncodeWebSafe(JSON.stringify(appliedFilter));
  const cached = forceRefresh ? null : readCachedJson_(cacheKey);
  if (cached && JSON.stringify(cached.appliedFilter) === JSON.stringify(appliedFilter)) return cached;

  const allRows = readAll_(SH.RES);
  const allNotes = readAll_(SH.NOTE);
  const groupOptions = Array.from(new Set(allRows.map(function (row) { return reportText_(row['กลุ่มลูกค้า']); }).filter(Boolean))).sort();
  const modelOptions = Array.from(new Set(allRows.map(function (row) { return reportText_(row['รุ่น']); }).filter(Boolean))).sort();
  // ค่าเก่าจาก localStorage หรือค่าที่ดัดแปลงต้องไม่ทำให้รายงานว่างโดยไม่ทราบสาเหตุ
  if (appliedFilter.group && groupOptions.indexOf(appliedFilter.group) === -1) appliedFilter.group = '';
  if (appliedFilter.model && modelOptions.indexOf(appliedFilter.model) === -1) appliedFilter.model = '';
  const rows = allRows.filter(function (row) { return reportDimensionMatch_(row, appliedFilter); });
  const waitLongDays = Number(cfg_('วันรอนาน', 14)) || 14;
  const callThreshold = Number(cfg_('ครั้งโทรไม่ติดแล้วเตือน', 3)) || 3;
  const actions = reportActions_(rows.filter(function (row) { return row['สถานะ'] !== STATUS.DONE && row['สถานะ'] !== STATUS.CANCEL; }), allNotes, now, waitLongDays, callThreshold);
  const result = {
    generatedAt: fmtDate_(now),
    generatedAtRaw: now.getTime(),
    appliedFilter: appliedFilter,
    options: { groups: groupOptions, models: modelOptions },
    thresholds: { waitLongDays: waitLongDays, callThreshold: callThreshold },
    current: { total: rows.length, statuses: reportStatusCounts_(rows), unknownStatuses: reportUnknownStatusCount_(rows) },
    actions: actions,
    products: reportProductSummary_(rows, now),
    productAnalytics: reportProductAnalytics_(rows, appliedFilter),
    period: reportPeriod_(rows, allNotes, appliedFilter)
  };
  cacheJson_(cacheKey, result, 45);
  return result;
}

/** โหลดรายชื่อเมื่อกดการ์ด — แยกจาก Dashboard เพื่อไม่ส่งข้อมูลส่วนบุคคลจำนวนมากโดยไม่จำเป็น */
function reportGetDetails(token, request) {
  assertStaff_(token);
  request = request || {};
  const now = new Date(), filter = reportNormalizeFilter_(request.filter, now);
  const rows = readAll_(SH.RES).filter(function (row) { return reportDimensionMatch_(row, filter); });
  let selected = [], title = 'รายละเอียด';
  if (request.kind === 'status') {
    const allowed = [STATUS.PENDING, STATUS.WAIT, STATUS.ARR, STATUS.APPT, STATUS.DONE, STATUS.CANCEL];
    const status = reportText_(request.value);
    if (allowed.indexOf(status) === -1) throw new Error('สถานะรายงานไม่ถูกต้อง');
    selected = rows.filter(function (row) { return row['สถานะ'] === status; }).map(function (row) { return reportItem_(row, now); });
    title = status;
  } else if (request.kind === 'action') {
    const action = reportText_(request.value);
    const allowedActions = ['overdue', 'today', 'noCall', 'waitLong', 'manyFails', 'quality'];
    if (allowedActions.indexOf(action) === -1) throw new Error('หมวดงานรายงานไม่ถูกต้อง');
    const actions = reportActions_(rows.filter(function (row) { return row['สถานะ'] !== STATUS.DONE && row['สถานะ'] !== STATUS.CANCEL; }), readAll_(SH.NOTE), now, Number(cfg_('วันรอนาน', 14)) || 14, Number(cfg_('ครั้งโทรไม่ติดแล้วเตือน', 3)) || 3);
    selected = actions[action] || [];
    title = { overdue: 'เลยกำหนด', today: 'นัดรับวันนี้', noCall: 'ยังไม่เคยโทร', waitLong: 'รอสินค้านาน', manyFails: 'ติดต่อหลายครั้ง', quality: 'ข้อมูลที่ต้องตรวจสอบ' }[action];
  } else {
    throw new Error('ไม่พบประเภทรายละเอียด');
  }
  reportSortItems_(selected);
  return { title: title, total: selected.length, items: selected.slice(0, 100), limited: selected.length > 100 };
}
