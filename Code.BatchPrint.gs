/*************************************************************
 * โมดูลพิมพ์เอกสารหลายรายการ
 * แยกจาก Code.gs เพื่อลดผลกระทบต่อ workflow หลัก
 *************************************************************/

const BATCH_PRINT_MAX = 50;
const BATCH_PRINT_JOB_PREFIX = 'batch_print_job_v1_';
const BATCH_PRINT_DONE_PREFIX = 'batch_print_done_v1_';
const BATCH_PRINT_JOB_TTL_MS = 12 * 60 * 60 * 1000;

function batchPrintCleanupJobs_() {
  const props = scriptProps_();
  const all = props.getProperties();
  const now = Date.now();
  Object.keys(all).forEach(function (key) {
    if (key.indexOf(BATCH_PRINT_JOB_PREFIX) !== 0) return;
    try {
      const job = JSON.parse(all[key]);
      if (!job.createdAt || now - Number(job.createdAt) > BATCH_PRINT_JOB_TTL_MS) props.deleteProperty(key);
    } catch (e) { props.deleteProperty(key); }
  });
}

function batchPrintSaveJob_(job) {
  cacheJson_(BATCH_PRINT_JOB_PREFIX + job.id, job, 3600);
  scriptProps_().setProperty(BATCH_PRINT_JOB_PREFIX + job.id, JSON.stringify(job));
}

function batchPrintReadJob_(id) {
  const cached = readCachedJson_(BATCH_PRINT_JOB_PREFIX + id);
  if (cached) return cached;
  const text = scriptProps_().getProperty(BATCH_PRINT_JOB_PREFIX + id);
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

function batchPrintType_(value) {
  const v = String(value || 'label');
  if (['label', 'slip', 'pair'].indexOf(v) === -1) throw new Error('ประเภทเอกสารไม่ถูกต้อง');
  return v;
}

function batchPrintFormat_(value) {
  const v = String(value || 'a4');
  if (['a4', 'thermal'].indexOf(v) === -1) throw new Error('รูปแบบกระดาษไม่ถูกต้อง');
  return v;
}

function batchPrintScale_(format, value) {
  if (format === 'thermal') return 100;
  const v = Number(value) || 100;
  if ([90, 95, 100].indexOf(v) === -1) throw new Error('ขนาด A4 ต้องเป็น 90%, 95% หรือ 100%');
  return v;
}

function batchPrintEligibility_(r, type) {
  const status = String(r['สถานะ'] || '');
  if (status === STATUS.CANCEL || status === STATUS.DONE || status === STATUS.PENDING) {
    return { ok: false, reason: 'สถานะปัจจุบันไม่รองรับเอกสารที่เลือก' };
  }
  if (type === 'label' || type === 'pair') {
    if (status !== STATUS.ARR && status !== STATUS.APPT) {
      return { ok: false, reason: 'ใบแปะเครื่องพิมพ์ได้เมื่อสถานะเป็น ของมาแล้ว หรือ นัดรับแล้ว' };
    }
  } else if (type === 'slip' && [STATUS.WAIT, STATUS.ARR, STATUS.APPT].indexOf(status) === -1) {
    return { ok: false, reason: 'ใบจองสินค้าพิมพ์ได้เฉพาะรายการที่ยังเปิดอยู่' };
  }
  return { ok: true, reason: '' };
}

function batchPrintDateOnly_(value) {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

function batchPrintFilterDate_(value, label) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error((label || 'วันที่') + 'ไม่ถูกต้อง');
  const date = new Date(text + 'T00:00:00+07:00');
  if (isNaN(date.getTime()) || Utilities.formatDate(date, TZ, 'yyyy-MM-dd') !== text) throw new Error((label || 'วันที่') + 'ไม่ถูกต้อง');
  return text;
}

/** รายชื่อสำหรับหน้าเลือกพิมพ์ อ่านสดทุกครั้ง ไม่ใช้ cache รายชื่อหลัก */
function listBatchPrintCandidates(token, filter) {
  assertStaff_(token);
  filter = filter || {};
  const type = batchPrintType_(filter.type);
  const q = String(filter.q || '').trim().slice(0, 160).toLowerCase();
  const qDigits = normPhone_(filter.q || '');
  const group = String(filter.group || '');
  const status = String(filter.status || '');
  const model = String(filter.model || '');
  const capacity = String(filter.capacity || '');
  const color = String(filter.color || '');
  const labeled = String(filter.labeled || '');
  const apptFrom = batchPrintFilterDate_(filter.apptFrom, 'วันที่นัดรับเริ่มต้น');
  const apptTo = batchPrintFilterDate_(filter.apptTo, 'วันที่นัดรับสิ้นสุด');
  if (apptFrom && apptTo && apptFrom > apptTo) throw new Error('วันที่นัดรับเริ่มต้นต้องไม่เกินวันที่สิ้นสุด');
  const aisOnly = !!filter.aisOnly;
  const now = new Date();
  let rows = readAll_(SH.RES).filter(function (r) { return batchPrintEligibility_(r, type).ok; });

  if (group) rows = rows.filter(function (r) { return String(r['กลุ่มลูกค้า']) === group; });
  if (status) rows = rows.filter(function (r) { return String(r['สถานะ']) === status; });
  if (model) rows = rows.filter(function (r) { return String(r['รุ่น']) === model; });
  if (capacity) rows = rows.filter(function (r) { return String(r['ความจุ']) === capacity; });
  if (color) rows = rows.filter(function (r) { return String(r['สี']) === color; });
  if (aisOnly) rows = rows.filter(function (r) { return !!r['ล็อกซัพ']; });
  if (labeled === 'yes') rows = rows.filter(function (r) { return !!r['แปะใบแล้ว']; });
  if (labeled === 'no') rows = rows.filter(function (r) { return !r['แปะใบแล้ว']; });
  if (apptFrom) rows = rows.filter(function (r) { const d = batchPrintDateOnly_(r['วันนัดรับ']); return d && d >= apptFrom; });
  if (apptTo) rows = rows.filter(function (r) { const d = batchPrintDateOnly_(r['วันนัดรับ']); return d && d <= apptTo; });
  if (q) rows = rows.filter(function (r) {
    return String(r['รหัสจอง']).toLowerCase().indexOf(q) > -1 ||
      String(r['ชื่อลูกค้า']).toLowerCase().indexOf(q) > -1 ||
      (qDigits && String(r['เบอร์โทร']).indexOf(qDigits) > -1) ||
      String(r['รุ่น']).toLowerCase().indexOf(q) > -1 ||
      String(r['เลขPreBooking']).toLowerCase().indexOf(q) > -1 ||
      String(r['เลขPreOrder']).toLowerCase().indexOf(q) > -1 ||
      String(r['โครงการ']).toLowerCase().indexOf(q) > -1;
  });

  rows.sort(function (a, b) {
    const aa = sortableTime_(a['วันนัดรับ'] || a['วันครบกำหนดรับ'] || a['วันเวลาที่จอง']);
    const bb = sortableTime_(b['วันนัดรับ'] || b['วันครบกำหนดรับ'] || b['วันเวลาที่จอง']);
    return aa - bb;
  });
  return {
    items: rows.slice(0, 300).map(function (r) { return toClient_(r, now); }),
    total: rows.length,
    limited: rows.length > 300,
    maxSelection: BATCH_PRINT_MAX
  };
}

/** ตรวจข้อมูลซ้ำอีกครั้งทันที ก่อนสร้างเอกสารจริง */
function prepareBatchPrintJob(token, request) {
  assertStaff_(token);
  batchPrintCleanupJobs_();
  request = request || {};
  const type = batchPrintType_(request.type);
  const format = batchPrintFormat_(request.format);
  const scale = batchPrintScale_(format, request.scale);
  const seen = {};
  if (!Array.isArray(request.ids)) throw new Error('รายการสำหรับพิมพ์ไม่ถูกต้อง');
  const ids = request.ids.map(function (value) { return String(value || '').trim().slice(0, 120); }).filter(function (id) {
    if (!id || seen[id]) return false;
    seen[id] = true;
    return true;
  });
  if (!ids.length) throw new Error('กรุณาเลือกรายการที่ต้องการพิมพ์');
  if (ids.length > BATCH_PRINT_MAX) throw new Error('พิมพ์ได้สูงสุดครั้งละ ' + BATCH_PRINT_MAX + ' รายการ');

  const wanted = {};
  ids.forEach(function (id) { wanted[id] = true; });
  const byId = {};
  readAll_(SH.RES).forEach(function (r) {
    const id = String(r['รหัสจอง'] || '');
    if (wanted[id]) byId[id] = r;
  });
  const accepted = [], rejected = [];
  ids.forEach(function (id) {
    const row = byId[id];
    if (!row) { rejected.push({ id: id, reason: 'ไม่พบรายการ' }); return; }
    const check = batchPrintEligibility_(row, type);
    if (!check.ok) { rejected.push({ id: id, reason: check.reason }); return; }
    accepted.push(row);
  });
  if (!accepted.length) throw new Error('ไม่มีรายการที่ยังตรงเงื่อนไขสำหรับพิมพ์');

  const jobId = Utilities.getUuid();
  const meta = {
    id: jobId,
    ids: accepted.map(function (r) { return String(r['รหัสจอง']); }),
    type: type,
    format: format,
    scale: scale,
    who: user_(),
    createdAt: Date.now()
  };
  batchPrintSaveJob_(meta);
  const webUrl = printWebUrl_();
  return {
    jobId: jobId,
    type: type,
    format: format,
    scale: scale,
    items: accepted.map(function (r) { return buildPrintData_(r, webUrl); }),
    rejected: rejected,
    createdAt: fmtDate_(new Date(meta.createdAt))
  };
}

/** เรียกหลังผู้ใช้ยืนยันว่าพิมพ์สำเร็จเท่านั้น */
function confirmBatchPrintJob(token, jobId) {
  assertStaff_(token);
  const id = String(jobId || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error('ไม่พบรหัสงานพิมพ์');
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const cache = CacheService.getScriptCache();
    const done = readCachedJson_(BATCH_PRINT_DONE_PREFIX + id);
    if (done) return done;
    const meta = batchPrintReadJob_(id);
    if (!meta) throw new Error('งานพิมพ์หมดอายุ กรุณาเตรียมเอกสารใหม่');
    if (meta.confirmedResult) return meta.confirmedResult;
    const wanted = {};
    (meta.ids || []).forEach(function (x) { wanted[String(x)] = true; });
    const rows = readAll_(SH.RES).filter(function (r) { return wanted[String(r['รหัสจอง'])]; });
    const sh = sh_(SH.RES);
    let labeledCount = 0;
    if (meta.type === 'label' || meta.type === 'pair') {
      rows.forEach(function (r) {
        if (!r['แปะใบแล้ว']) { sh.getRange(r._row, 24).setValue(true); labeledCount++; }
      });
    }
    const typeText = meta.type === 'label' ? 'ใบแปะเครื่อง' : meta.type === 'slip' ? 'ใบจองสินค้า' : 'ใบแปะเครื่องและใบจองสินค้า';
    const paperText = meta.format === 'thermal' ? 'Thermal 80mm' : ('A4 ขนาด ' + meta.scale + '%');
    const now = new Date(), who = user_();
    const marker = 'งานพิมพ์หลายรายการ #' + id;
    const alreadyNoted = {};
    readAll_(SH.NOTE).forEach(function (note) {
      if (String(note['ข้อความ'] || '').indexOf(marker) > -1) alreadyNoted[String(note['รหัสจอง'] || '')] = true;
    });
    // marker แบบเต็มทำให้เรียกยืนยันซ้ำหลังคำขอสะดุดได้ โดยไม่เพิ่มประวัติซ้ำ
    const noteRows = rows.filter(function (r) { return !alreadyNoted[String(r['รหัสจอง'])]; }).map(function (r) {
      return [r['รหัสจอง'], now, who, 'พิมพ์หลายรายการสำเร็จ · ' + typeText + ' · ' + paperText + ' · ' + marker, 'auto'];
    });
    if (noteRows.length) {
      const noteSh = sh_(SH.NOTE);
      noteSh.getRange(noteSh.getLastRow() + 1, 1, noteRows.length, HEAD[SH.NOTE].length).setValues(noteRows);
    }
    rows.forEach(function (r) { invalidateReservationCache_(r['รหัสจอง']); });
    invalidateListCache_();
    SpreadsheetApp.flush();
    const result = { ok: true, count: rows.length, labeledCount: labeledCount, jobId: id };
    meta.confirmedResult = result;
    scriptProps_().setProperty(BATCH_PRINT_JOB_PREFIX + id, JSON.stringify(meta));
    cacheJson_(BATCH_PRINT_DONE_PREFIX + id, result, 21600);
    cache.remove(BATCH_PRINT_JOB_PREFIX + id);
    return result;
  } finally { lock.releaseLock(); }
}
