/*************************************************************
 * ═══════════════════════════════════════════════════════
 *  ไฟล์: Code.gs
 *  ระบบ: ระบบติดตามคิวจอง iPhone (Google Sheets + Apps Script)
 *  หน้าที่: โค้ดฝั่งเซิร์ฟเวอร์ทั้งหมด — จัดการชีต, บันทึก/อ่านการจอง,
 *          สถานะคิว, จับคู่ของเข้า, บริบทคิว, ตั้งค่าผ่านเว็บ,
 *          ลูกค้ากรอกเอง, ยืนยันตัวตนผ่าน QR, ข้อมูลพิมพ์เอกสาร
 *  คู่กับไฟล์ HTML: Index (แอปพนักงาน), Signup (ลูกค้ากรอกเอง),
 *          Check (ลูกค้าเช็กสถานะผ่าน QR)
 *  วิธีติดตั้ง: ดูไฟล์ "วิธีติดตั้ง.md"
 * ═══════════════════════════════════════════════════════
 *************************************************************/

// ชื่อร้าน/สาขา ที่จะพิมพ์บนเอกสาร — แก้ตรงนี้ได้ (หรือย้ายไปชีตค่าระบบภายหลัง)
const STORE_NAME = 'iStudio Central Embassy';
const WALK_IN_GROUP = 'ลูกค้า Walk-in';
const LEGACY_WALK_IN_GROUP = 'ลูกค้าทั่วไป';

const TZ = 'Asia/Bangkok';
const GROUP_PALETTE = ['#0F6E56', '#0C447C', '#633806', '#3C3489', '#444441', '#9A3412', '#166534', '#7C2D92'];

const SH = {
  CUST: 'ลูกค้า', RES: 'การจอง', NOTE: 'โน้ต',
  PROD: 'รุ่นสินค้า', GROUP: 'กลุ่มลูกค้า', SUPPLY: 'ซัพพลายเออร์',
  PROMO: 'โครงการส่วนลด', STAFF: 'พนักงาน', CFG: 'ค่าระบบ', LOT: 'ล็อตของเข้า'
};

const HEAD = {
  [SH.CUST]: ['เบอร์โทร', 'ชื่อ-นามสกุล', 'ช่องทางติดต่อ', 'ไอดี/อีเมล', 'ภาษา', 'กลุ่มลูกค้า', 'วันที่บันทึกครั้งแรก'],
  [SH.RES]: ['รหัสจอง', 'โทเคน', 'เบอร์โทร', 'ชื่อลูกค้า', 'กลุ่มลูกค้า', 'เลขPreBooking',
    'รุ่น', 'ความจุ', 'สี', 'สีสำรอง', 'ความจุสำรอง', 'ล็อกซัพ', 'ซัพที่ระบุ', 'โครงการ',
    'มัดจำ', 'เลขบิลมัดจำ', 'วันที่รับมัดจำ', 'สถานะ', 'วันเวลาที่จอง', 'วันครบกำหนดรับ',
    'วันนัดรับ', 'จำนวนครั้งที่เลื่อน', 'พนักงานที่รับเรื่อง', 'แปะใบแล้ว', 'ที่มา',
    'จำนวนครั้งที่โทร', 'อัปเดตล่าสุด', 'ผู้แก้ไขล่าสุด', 'เลขPreOrder', 'ข้อมูลเพิ่มเติม', 'วันที่โทรล่าสุด', 'เร่งด่วน', 'เหตุผลเร่งด่วน', 'ราคาขณะจอง', 'รหัสชุดการจอง'],
  [SH.NOTE]: ['รหัสจอง', 'วันเวลา', 'ผู้เขียน', 'ข้อความ', 'ที่มา'],
  [SH.PROD]: ['รุ่น', 'ความจุ', 'สี', 'เปิดรับจอง', 'ราคา'],
  [SH.GROUP]: ['ชื่อกลุ่ม', 'เปิดใช้', 'สีป้าย', 'ต้องกรอกเลขอ้างอิง', 'ค่าเริ่มต้น', 'ลำดับแสดงผล'],
  [SH.SUPPLY]: ['ชื่อซัพพลายเออร์', 'เปิดใช้'],
  [SH.PROMO]: ['ชื่อโครงการ', 'คำอธิบาย', 'เปิดใช้'],
  [SH.STAFF]: ['ชื่อ', 'อีเมล'],
  [SH.CFG]: ['คีย์', 'ค่า', 'คำอธิบาย'],
  [SH.LOT]: ['คีย์', 'รุ่น', 'ความจุ', 'สี', 'ซัพ', 'จำนวนเข้า', 'จัดสรรแล้ว', 'อัปเดตล่าสุด', 'ผู้อัปเดต']
};

const STATUS = { WAIT: 'รอสินค้า', ARR: 'ของมาแล้ว', APPT: 'นัดรับแล้ว', DONE: 'รับของแล้ว', CANCEL: 'ยกเลิก', PENDING: 'รอตรวจสอบ' };
const AIS_SUPPLIER = 'AIS'; // โปรโมชันในระบบ = โปรแกรม AIS ทั้งหมด จึงผูกกับซัพนี้เสมอ

/* ============================================================
 * ติดตั้ง
 * ==========================================================*/

function onOpen() {
  SpreadsheetApp.getUi().createMenu('ระบบคิวจอง')
    .addItem('ติดตั้ง / ซ่อมโครงสร้างชีต', 'setup')
    .addItem('ตั้งรหัส Location', 'setLocationCode')
    .addItem('เพิ่มข้อมูลตัวอย่าง', 'seedDefaults')
    .addItem('เปลี่ยนรหัสรายการทดลองเป็นรูปแบบใหม่', 'migrateTestReservationIds')
    .addToUi();
}

function assertEditorExecution_() {
  const active = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  const effective = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (!active || !effective || active !== effective) {
    throw new Error('คำสั่งบำรุงรักษานี้ต้องรันจากไฟล์ Google Sheets หรือ Apps Script Editor โดยผู้มีสิทธิ์แก้ไขระบบ');
  }
}

function setup() {
  assertEditorExecution_();
  return setup_();
}

function setup_() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(TZ);
  Object.keys(HEAD).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const head = HEAD[name];
    if (sh.getMaxColumns() < head.length) sh.insertColumnsAfter(sh.getMaxColumns(), head.length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#262624').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
    if (sh.getMaxColumns() > head.length) sh.deleteColumns(head.length + 1, sh.getMaxColumns() - head.length);
  });
  const junk = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
  if (junk && junk.getLastRow() === 0) ss.deleteSheet(junk);
  if (ss.getSheetByName(SH.PROD).getLastRow() < 2) seedDefaults_();
  migrateWalkInGroup_();
  ensureGroupSettingsSchema_();
  ensureConfigDefaults_();
  protectDataSheets_();
  SpreadsheetApp.getActive().toast('ติดตั้งเรียบร้อย', 'ระบบคิวจอง', 5);
}

function protectDataSheets_() {
  [SH.CUST, SH.RES, SH.NOTE].forEach(function (name) {
    const sh = SpreadsheetApp.getActive().getSheetByName(name);
    const existing = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    if (existing.length === 0) {
      const p = sh.protect().setDescription('แก้ผ่านแอปเท่านั้น');
      p.removeEditors(p.getEditors());
      if (p.canDomainEdit()) p.setDomainEdit(false);
    }
  });
}

function seedDefaults() {
  assertEditorExecution_();
  return seedDefaults_();
}

function seedDefaults_() {
  const ss = SpreadsheetApp.getActive();
  const g = ss.getSheetByName(SH.GROUP);
  if (g.getLastRow() < 2) g.getRange(2, 1, 5, 6).setValues([
    ['Store-VIP', true, '#0F6E56', false, true, 1], ['Head Office-VIP', true, '#0C447C', false, false, 2],
    ['Pre-Order', true, '#633806', false, false, 3], ['Pre-Booking', false, '#3C3489', true, false, 4],
    [WALK_IN_GROUP, true, '#444441', false, false, 5]
  ]);
  const s = ss.getSheetByName(SH.SUPPLY);
  if (s.getLastRow() < 2) s.getRange(2, 1, 4, 2).setValues([['SYNNEX', true], ['AIS', true], ['VST', true], ['DTAC', true]]);
  const pr = ss.getSheetByName(SH.PROMO);
  if (pr.getLastRow() < 2) pr.getRange(2, 1, 3, 3).setValues([
    ['HotDeal', 'เปิดเบอร์ใหม่ ย้ายค่าย เปลี่ยนเติมเงินเป็นรายเดือน', true],
    ['BestBuy', 'ลูกค้า AIS ปัจจุบัน', true],
    ['นิติบุคคล', 'ทุนจดทะเบียนไม่เกิน 200 ล้าน', true]
  ]);
  const p = ss.getSheetByName(SH.PROD);
  if (p.getLastRow() < 2) {
    const caps = '256GB, 512GB, 1TB';
    const cols = 'Natural Titanium, Black Titanium, White Titanium, Blue Titanium';
    p.getRange(2, 1, 4, 4).setValues([
      ['iPhone 17 Pro Max', caps, cols, true],
      ['iPhone 17 Pro', caps, cols, true],
      ['iPhone 17', caps, cols, true],
      ['iPhone 17 Air', caps, cols, true]
    ]);
  }
  const c = ss.getSheetByName(SH.CFG);
  if (c.getLastRow() < 2) c.getRange(2, 1, 6, 3).setValues([
    ['เก็บมัดจำ', 'true', 'เปิดใช้ช่องมัดจำและเลขบิล'],
    ['ล็อกซัพ', 'true', 'เปิดใช้ตัวเลือกล็อกเครื่อง AIS'],
    ['เปิดใช้ตัวเลือกเครื่องทางเลือก', 'true', 'ให้ลูกค้าและพนักงานระบุสีหรือความจุอื่นที่รับแทนได้'],
    ['วันครบกำหนดเริ่มต้น', '5', 'จำนวนวันตั้งต้นตอนของมาแล้ว'],
    ['วันรอนาน', '14', 'จำนวนวันที่ถือว่ารอนาน'],
    ['ครั้งโทรไม่ติดแล้วเตือน', '3', 'จำนวนครั้งที่โทรไม่ติดแล้วขึ้นเตือน']
  ]);
  const currentKeys = c.getLastRow() < 2 ? [] : c.getRange(2, 1, c.getLastRow() - 1, 1).getValues().flat();
  if (currentKeys.indexOf('วันครบกำหนดหลังนัด') === -1) {
    c.appendRow(['วันครบกำหนดหลังนัด', '3', 'จำนวนวันที่ให้ลูกค้ารับสินค้าได้หลังวันนัดรับ']);
  }
}

/** เปลี่ยนชื่อกลุ่มเดิมเป็น Walk-in เพียงครั้งเดียว พร้อมคงประวัติการจองเดิมไว้ */
function migrateWalkInGroup_() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('walk_in_group_migrated_v1') === 'true') return;
  const targets = [
    { sheet: SH.GROUP, column: 1 },
    { sheet: SH.CUST, column: 6 },
    { sheet: SH.RES, column: 5 }
  ];
  targets.forEach(function (target) {
    const sh = sh_(target.sheet);
    const last = sh.getLastRow();
    if (last < 2) return;
    const range = sh.getRange(2, target.column, last - 1, 1);
    const values = range.getValues();
    let changed = false;
    values.forEach(function (row) {
      if (String(row[0] || '').trim() === LEGACY_WALK_IN_GROUP) {
        row[0] = WALK_IN_GROUP;
        changed = true;
      }
    });
    if (changed) range.setValues(values);
  });
  props.setProperty('walk_in_group_migrated_v1', 'true');
  invalidateBootstrapCache_();
}

/** เติมค่าระบบใหม่โดยไม่แก้ไขค่าที่สาขาตั้งไว้แล้ว */
function ensureConfigDefaults_() {
  const c = sh_(SH.CFG);
  const keys = c.getLastRow() < 2 ? [] : c.getRange(2, 1, c.getLastRow() - 1, 1).getValues().flat();
  if (keys.indexOf('วันครบกำหนดหลังนัด') === -1) {
    c.appendRow(['วันครบกำหนดหลังนัด', '3', 'จำนวนวันที่ให้ลูกค้ารับสินค้าได้หลังวันนัดรับ']);
  }
  if (keys.indexOf('เปิดใช้ตัวเลือกเครื่องทางเลือก') === -1) {
    c.appendRow(['เปิดใช้ตัวเลือกเครื่องทางเลือก', 'true', 'ให้ลูกค้าและพนักงานระบุสีหรือความจุอื่นที่รับแทนได้']);
  }
  if (keys.indexOf('โครงการ AIS เฉพาะภาษาไทย') === -1) {
    c.appendRow(['โครงการ AIS เฉพาะภาษาไทย', 'false', 'หน้าลงทะเบียน: แสดงตัวเลือกเครื่องโครงการ AIS เฉพาะลูกค้าที่เลือกภาษาไทย (ปิด = ทุกภาษาเห็น)']);
  }
  if (keys.indexOf('แสดงกลุ่มลูกค้าในข้อมูลสำหรับลูกค้า') === -1) {
    c.appendRow(['แสดงกลุ่มลูกค้าในข้อมูลสำหรับลูกค้า', 'false', 'แสดงกลุ่มในหน้าลูกค้าสแกน QR และใบจองสินค้าทุกขนาด (ไม่กระทบใบแปะเครื่อง หน้าพนักงาน และรายงาน)']);
  }
  if (keys.indexOf('แสดง QR ลงทะเบียนหน้า Welcome') === -1) {
    c.appendRow(['แสดง QR ลงทะเบียนหน้า Welcome', 'true', 'แสดง QR Code หน้า Welcome เพื่อให้ลูกค้าสแกนเข้าสู่หน้าลงทะเบียนโดยตรง']);
  }
}

/** เพิ่มคอลัมน์ราคาให้ชีตรุ่นสินค้าโดยไม่กระทบข้อมูลเดิม (เรียกก่อนอ่าน/เขียนชีตรุ่นสินค้าด้วยความกว้างใหม่) */
function ensureProductColumns_() {
  const sh = sh_(SH.PROD), head = HEAD[SH.PROD];
  if (sh.getMaxColumns() < head.length) sh.insertColumnsAfter(sh.getMaxColumns(), head.length - sh.getMaxColumns());
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
}

/** เพิ่มคอลัมน์ค่าเริ่มต้น/ลำดับให้ชีตเดิม และรับประกันว่ามีกลุ่มเริ่มต้นที่เปิดใช้งานเพียงหนึ่งกลุ่ม */
function ensureGroupSettingsSchema_() {
  const sh = sh_(SH.GROUP), head = HEAD[SH.GROUP];
  if (sh.getMaxColumns() < head.length) sh.insertColumnsAfter(sh.getMaxColumns(), head.length - sh.getMaxColumns());
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
  const count = sh.getLastRow() - 1;
  if (count < 1) return;
  const range = sh.getRange(2, 1, count, head.length), values = range.getValues();
  let changed = false;
  values.forEach(function (row, i) {
    const order = Number(row[5]);
    if (!Number.isFinite(order) || order < 1) { row[5] = i + 1; changed = true; }
  });
  const enabled = values.map(function (row, i) { return { row: row, i: i }; })
    .filter(function (x) { return isEnabled_(x.row[1]); })
    .sort(function (a, b) { return Number(a.row[5]) - Number(b.row[5]) || a.i - b.i; });
  let selected = enabled.filter(function (x) { return isEnabled_(x.row[4]); })[0];
  const defaultIndex = selected ? selected.i : (enabled[0] ? enabled[0].i : -1);
  values.forEach(function (row, i) {
    const shouldDefault = i === defaultIndex;
    if (isEnabled_(row[4]) !== shouldDefault) { row[4] = shouldDefault; changed = true; }
  });
  if (changed) range.setValues(values);
}

function orderedEnabledGroups_() {
  ensureGroupSettingsSchema_();
  return readAll_(SH.GROUP).filter(function (g) { return isEnabled_(g['เปิดใช้']); })
    .sort(function (a, b) {
      return (Number(a['ลำดับแสดงผล']) || 999999) - (Number(b['ลำดับแสดงผล']) || 999999) || a._row - b._row;
    });
}

function defaultGroupName_() {
  const groups = orderedEnabledGroups_();
  const selected = groups.filter(function (g) { return isEnabled_(g['ค่าเริ่มต้น']); })[0];
  return selected ? String(selected['ชื่อกลุ่ม']) : (groups[0] ? String(groups[0]['ชื่อกลุ่ม']) : WALK_IN_GROUP);
}

/* ============================================================
 * ติดตั้งครั้งแรกผ่านเว็บแอป (ไม่ต้องเปิด Apps Script editor)
 * ==========================================================*/

function isInstalled(_tok) {
  return !!SpreadsheetApp.getActive().getSheetByName(SH.RES);
}
/* ============================================================
 * เซสชันพนักงาน — ด่าน Location Code จริงฝั่ง server (HMAC stateless)
 * รหัสถูกต้อง → ออก token เซ็นด้วย secret + เวลาหมดอายุ; ทุกฟังก์ชันพนักงาน
 * เรียก assertStaff_(token) ก่อน จึงเรียกจาก console โดยไม่รู้รหัสไม่ได้
 * ==========================================================*/
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;       // อายุเซสชัน 8 ชั่วโมง
const LOCATION_MAX_FAILS = 5;
const LOCATION_LOCK_SEC = 180;

function scriptProps_() { return PropertiesService.getScriptProperties(); }

/** รหัส Location ปัจจุบัน — ต้องตั้งใน Script Properties ผ่าน setLocationCode() จาก Editor */
function currentLocationCode_() {
  const code = scriptProps_().getProperty('LOCATION_CODE');
  if (!code) throw new Error('ยังไม่ได้ตั้งรหัส Location · เปิด Google Sheets แล้วเลือกเมนู “ระบบคิวจอง > ตั้งรหัส Location” ก่อน');
  return code;
}

/** ตั้งรหัส Location ใหม่ — รันครั้งเดียวจาก Apps Script editor เพื่อย้ายรหัสออกจากซอร์สโค้ด */
function setLocationCode(plain) {
  assertEditorExecution_();
  let v = String(plain || '').trim();
  if (!v) {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt('ตั้งรหัส Location', 'กรอกรหัสตัวเลข 4–12 หลัก', ui.ButtonSet.OK_CANCEL);
    if (response.getSelectedButton() !== ui.Button.OK) return 'ยกเลิกการตั้งรหัส';
    v = String(response.getResponseText() || '').trim();
  }
  if (!/^\d{4,12}$/.test(v)) throw new Error('รหัสต้องเป็นตัวเลข 4–12 หลัก');
  scriptProps_().setProperty('LOCATION_CODE', v);
  CacheService.getScriptCache().remove('location_login_failures');
  CacheService.getScriptCache().remove('location_login_locked_until');
  return 'ตั้งรหัส Location ใหม่เรียบร้อยแล้ว';
}

/** secret สำหรับเซ็นเซสชัน (สร้างอัตโนมัติครั้งแรก เก็บใน Script Properties) */
function sessionSecret_() {
  const props = scriptProps_();
  let s = props.getProperty('SESSION_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); props.setProperty('SESSION_SECRET', s); }
  return s;
}
function signSession_(expMs) {
  const sig = Utilities.computeHmacSha256Signature(String(expMs), sessionSecret_());
  return String(expMs) + '.' + Utilities.base64EncodeWebSafe(sig);
}
function issueSessionToken_() { return signSession_(Date.now() + SESSION_TTL_MS); }
function isValidSession_(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return false;
  const expMs = Number(parts[0]);
  if (!isFinite(expMs) || Date.now() > expMs) return false;
  return signSession_(expMs) === token;
}
/** ตรวจสิทธิ์พนักงาน — โยน error ถ้า token ไม่ถูกต้อง/หมดอายุ (เรียกต้นทางทุกฟังก์ชันพนักงาน) */
function assertStaff_(token) {
  if (!isValidSession_(token)) {
    throw new Error('เซสชันหมดอายุหรือยังไม่ได้ยืนยันสาขา · กรุณากรอกรหัส Location ใหม่');
  }
}

/** ตรวจรหัส Location ก่อนเปิดหน้าใช้งาน — ถูกต้องจึงออก session token */
function validateLocationCode(_tok, code) {
  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock(); lock.waitLock(5000);
  try {
    const now = Date.now();
    const lockedUntil = Number(cache.get('location_login_locked_until') || 0);
    if (lockedUntil > now) return { ok: false, locked: true, retryAfterSec: Math.ceil((lockedUntil - now) / 1000) };
    if (String(code || '').trim() !== currentLocationCode_()) {
      const failures = Number(cache.get('location_login_failures') || 0) + 1;
      if (failures >= LOCATION_MAX_FAILS) {
        cache.remove('location_login_failures');
        cache.put('location_login_locked_until', String(now + LOCATION_LOCK_SEC * 1000), LOCATION_LOCK_SEC);
        return { ok: false, locked: true, retryAfterSec: LOCATION_LOCK_SEC };
      }
      cache.put('location_login_failures', String(failures), LOCATION_LOCK_SEC);
      return { ok: false, locked: false, remaining: LOCATION_MAX_FAILS - failures };
    }
    cache.remove('location_login_failures');
    cache.remove('location_login_locked_until');
    return { ok: true, token: issueSessionToken_(), ttlMs: SESSION_TTL_MS };
  } finally { lock.releaseLock(); }
}
function runSetupFromWeb(token) {
  assertStaff_(token);
  if (isInstalled()) throw new Error('ระบบติดตั้งแล้ว หากต้องการซ่อมโครงสร้างให้รัน setup() จาก Apps Script Editor');
  setup_();
  return true;
}

/* ============================================================
 * ตั้งค่าทั่วไปผ่านเว็บแอป — CRUD ทั่วไปจำกัดเฉพาะชีตตั้งค่า
 * ==========================================================*/

const ADMIN_SHEETS = [SH.PROD, SH.GROUP, SH.SUPPLY, SH.PROMO, SH.CFG];
function assertAdminSheet_(name) {
  if (ADMIN_SHEETS.indexOf(name) === -1) throw new Error('ไม่อนุญาตให้แก้ชีตนี้ผ่านหน้าตั้งค่า');
}

function assertAdminRow_(sh, row) {
  const n = Number(row);
  if (!Number.isInteger(n) || n < 2 || n > sh.getLastRow()) throw new Error('ตำแหน่งรายการตั้งค่าไม่ถูกต้อง กรุณารีเฟรชหน้าแล้วลองใหม่');
  return n;
}

function sameSettingValues_(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every(function (value, i) { return String(value == null ? '' : value) === String(b[i] == null ? '' : b[i]); });
}

function validateAdminValues_(sheetName, values) {
  const width = HEAD[sheetName].length;
  if (!Array.isArray(values) || values.length !== width) throw new Error('ข้อมูลตั้งค่าไม่สมบูรณ์');
  const first = String(values[0] == null ? '' : values[0]).trim();
  if (!first || first.length > 120) throw new Error('ชื่อรายการตั้งค่าต้องมีความยาว 1–120 ตัวอักษร');
  if (sheetName === SH.GROUP) {
    if (!/^#[0-9a-fA-F]{6}$/.test(String(values[2] || ''))) throw new Error('สีป้ายกลุ่มต้องเป็นรหัสสี Hex เช่น #0F6E56');
    const order = Number(values[5]);
    if (!Number.isInteger(order) || order < 1 || order > 999) throw new Error('ลำดับกลุ่มต้องเป็นเลขจำนวนเต็ม 1–999');
  }
  if (sheetName === SH.PROD) {
    if (!String(values[1] || '').trim() || !String(values[2] || '').trim()) throw new Error('รุ่นสินค้าต้องมีความจุและสีอย่างน้อยหนึ่งค่า');
    // ราคา (คอลัมน์ที่ 5): รูปแบบ "ความจุ=ราคา, ..." ราคาเป็นจำนวนเต็ม ≥ 0 และความจุต้องอยู่ในรายการความจุของรุ่น
    const priceText = String(values[4] == null ? '' : values[4]).trim();
    if (priceText) {
      const caps = {};
      String(values[1] || '').split(',').forEach(function (c) { const v = c.trim(); if (v) caps[v] = true; });
      priceText.split(',').forEach(function (part) {
        if (!part.trim()) return;
        const eq = part.indexOf('=');
        if (eq === -1) throw new Error('รูปแบบราคาไม่ถูกต้อง ต้องเป็น "ความจุ=ราคา" เช่น 256GB=42900');
        const cap = part.slice(0, eq).trim();
        const price = part.slice(eq + 1).replace(/[, ]/g, '').trim();
        if (!cap || !caps[cap]) throw new Error('ราคามีความจุ "' + cap + '" ที่ไม่อยู่ในรายการความจุของรุ่นนี้');
        if (!/^\d+$/.test(price)) throw new Error('ราคาของ ' + cap + ' ต้องเป็นตัวเลขจำนวนเต็ม');
      });
    }
  }
  return values;
}

function assertFinalGroupSettings_(rows) {
  const names = {};
  const enabled = rows.filter(function (row) {
    const name = String(row[0] || '').trim();
    if (!name) throw new Error('ชื่อกลุ่มลูกค้าห้ามเว้นว่าง');
    const key = name.toLowerCase();
    if (names[key]) throw new Error('ชื่อกลุ่มลูกค้าซ้ำ: ' + name);
    names[key] = true;
    return isEnabled_(row[1]);
  });
  if (!enabled.length) throw new Error('ต้องเปิดใช้งานกลุ่มลูกค้าอย่างน้อยหนึ่งกลุ่ม');
  const defaults = rows.filter(function (row) { return isEnabled_(row[4]); });
  if (defaults.length !== 1) throw new Error('ต้องกำหนดกลุ่มเริ่มต้นเพียงหนึ่งกลุ่ม');
  if (!isEnabled_(defaults[0][1])) throw new Error('กลุ่มเริ่มต้นต้องเป็นกลุ่มที่เปิดใช้งาน');
}

function adminList(token, sheetName) {
  assertStaff_(token);
  assertAdminSheet_(sheetName);
  if (sheetName === SH.CFG) ensureConfigDefaults_();
  if (sheetName === SH.GROUP) ensureGroupSettingsSchema_();
  if (sheetName === SH.PROD) ensureProductColumns_();
  return { head: HEAD[sheetName], rows: readAll_(sheetName) };
}

function adminAdd_(token, sheetName, values) {
  assertStaff_(token);
  assertAdminSheet_(sheetName);
  validateAdminValues_(sheetName, values);
  if (sheetName === SH.GROUP) ensureGroupSettingsSchema_();
  sh_(sheetName).appendRow(values);
  if (sheetName === SH.GROUP) ensureGroupSettingsSchema_();
  invalidateBootstrapCache_();
  return true;
}

function adminUpdate_(token, sheetName, row, values) {
  assertStaff_(token);
  assertAdminSheet_(sheetName);
  validateAdminValues_(sheetName, values);
  if (sheetName === SH.GROUP) ensureGroupSettingsSchema_();
  const sh = sh_(sheetName), safeRow = assertAdminRow_(sh, row);
  sh.getRange(safeRow, 1, 1, values.length).setValues([values]);
  if (sheetName === SH.GROUP) ensureGroupSettingsSchema_();
  invalidateBootstrapCache_();
  return true;
}

function adminDelete_(token, sheetName, row) {
  assertStaff_(token);
  assertAdminSheet_(sheetName);
  const sh = sh_(sheetName), safeRow = assertAdminRow_(sh, row);
  if (sheetName === SH.GROUP) {
    const remaining = sh.getRange(2, 1, Math.max(0, sh.getLastRow() - 1), HEAD[SH.GROUP].length).getValues().filter(function (_, i) { return i + 2 !== safeRow; });
    assertFinalGroupSettings_(remaining);
  }
  sh.deleteRow(safeRow);
  if (sheetName === SH.GROUP) ensureGroupSettingsSchema_();
  invalidateBootstrapCache_();
  return true;
}

/** บันทึกการตั้งค่าหลายส่วนเป็นชุดเดียว เพื่อให้หน้าจอรีเฟรชเพียงครั้งเดียว */
function adminSaveBatch(token, batch) {
  assertStaff_(token);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (!batch || typeof batch !== 'object') throw new Error('ไม่พบข้อมูลการตั้งค่าที่จะบันทึก');
    if (batch[SH.GROUP]) ensureGroupSettingsSchema_();
    if (batch[SH.PROD]) ensureProductColumns_();
    const plans = Object.keys(batch).map(function (sheetName) {
      assertAdminSheet_(sheetName);
      const change = batch[sheetName] || {}, sh = sh_(sheetName), width = HEAD[sheetName].length;
      const touched = {};
      (change.updates || []).forEach(function (item) {
        if (!item) throw new Error('ข้อมูลตั้งค่าไม่สมบูรณ์');
        const row = assertAdminRow_(sh, item.row);
        if (touched[row]) throw new Error('พบรายการตั้งค่าซ้ำในคำขอเดียวกัน');
        touched[row] = true;
        validateAdminValues_(sheetName, item.values);
        const current = sh.getRange(row, 1, 1, width).getValues()[0];
        if (!sameSettingValues_(current, item.before)) throw new Error('การตั้งค่าถูกแก้ไขจากหน้าจออื่นแล้ว กรุณารีเฟรชก่อนบันทึกอีกครั้ง');
      });
      (change.adds || []).forEach(function (values) {
        validateAdminValues_(sheetName, values);
      });
      const deletes = (change.deletes || []).map(function (item) {
        if (!item || typeof item !== 'object') throw new Error('ข้อมูลรายการที่จะลบไม่สมบูรณ์');
        const row = assertAdminRow_(sh, item.row);
        if (touched[row]) throw new Error('พบรายการตั้งค่าซ้ำในคำขอเดียวกัน');
        touched[row] = true;
        const current = sh.getRange(row, 1, 1, width).getValues()[0];
        if (!sameSettingValues_(current, item.before)) throw new Error('การตั้งค่าถูกแก้ไขจากหน้าจออื่นแล้ว กรุณารีเฟรชก่อนบันทึกอีกครั้ง');
        return row;
      });
      if (sheetName === SH.GROUP) {
        const updateMap = {};
        (change.updates || []).forEach(function (item) { updateMap[Number(item.row)] = item.values; });
        const deleteMap = {}; deletes.forEach(function (row) { deleteMap[row] = true; });
        const finalGroups = sh.getRange(2, 1, Math.max(0, sh.getLastRow() - 1), width).getValues().map(function (values, i) {
          return updateMap[i + 2] || values;
        }).filter(function (_, i) { return !deleteMap[i + 2]; }).concat(change.adds || []);
        assertFinalGroupSettings_(finalGroups);
      }
      return { sheetName: sheetName, sh: sh, width: width, change: change, deletes: deletes };
    });
    // ตรวจทุกชีตและทุกแถวให้ผ่านก่อนเริ่มเขียน เพื่อไม่ให้เกิดการบันทึกเพียงบางหมวด
    plans.forEach(function (plan) {
      const sh = plan.sh, width = plan.width, change = plan.change;
      (change.updates || []).forEach(function (item) { sh.getRange(Number(item.row), 1, 1, width).setValues([item.values]); });
      (change.adds || []).forEach(function (values) { sh.appendRow(values); });
      // ลบจากล่างขึ้นบน เพื่อไม่ให้หมายเลขแถวของรายการอื่นเปลี่ยนก่อนลบ
      plan.deletes.sort(function (a, b) { return b - a; }).forEach(function (row) { sh.deleteRow(row); });
    });
    SpreadsheetApp.flush();
    if (batch[SH.GROUP]) { ensureGroupSettingsSchema_(); SpreadsheetApp.flush(); }
    invalidateBootstrapCache_();
    return true;
  } finally { lock.releaseLock(); }
}

/* ============================================================
 * Web app entry
 * ==========================================================*/

function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) || 'welcome';
  let file = 'Welcome';
  if (page === 'staff') file = 'Index';
  if (page === 'signup') file = 'Signup';
  if (page === 'check') file = 'Check';
  const tmpl = HtmlService.createTemplateFromFile(file);
  // ส่งพารามิเตอร์ URL เข้าไปในหน้า HTML โดยตรง เพราะใน web app iframe
  // ตัว window.location.search ฝั่ง client จะว่าง อ่าน ?t= เองไม่ได้
  tmpl.qToken = (e && e.parameter && e.parameter.t) ? e.parameter.t : '';
  tmpl.appUrl = ScriptApp.getService().getUrl();
  tmpl.showWelcomeQr = true;
  if (file === 'Welcome') {
    // หน้า Welcome เปิดได้ก่อนติดตั้งระบบ จึงใช้ค่าเริ่มต้นเป็นเปิดเมื่อยังไม่มีชีตค่าระบบ
    const configSheet = SpreadsheetApp.getActive().getSheetByName(SH.CFG);
    tmpl.showWelcomeQr = configSheet
      ? isEnabled_(cfg_('แสดง QR ลงทะเบียนหน้า Welcome', 'true'))
      : true;
  }
  return tmpl.evaluate()
    .setTitle('ระบบคิวจอง iPhone')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/** ฝัง partial HTML เพื่อแยกส่วนหน้าจอที่แก้ไขบ่อยออกจาก Index.html */
function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ============================================================
 * ตัวช่วย
 * ==========================================================*/

function sh_(name) {
  const s = SpreadsheetApp.getActive().getSheetByName(name);
  if (!s) throw new Error('ไม่พบชีต "' + name + '" — สั่งติดตั้งระบบก่อน');
  return s;
}
function readAll_(name) {
  const sh = sh_(name), head = HEAD[name];
  if (sh.getLastRow() < 2) return [];
  // ระหว่างอัปเกรด schema ชีตเดิมอาจยังมีคอลัมน์น้อยกว่า HEAD ใหม่
  // อ่านเท่าที่มีจริงก่อน เพื่อให้หน้าเก่ายังเปิดได้ แล้วค่อยเพิ่มคอลัมน์ตอนบันทึกรายการใหม่/setup
  const width = Math.min(sh.getMaxColumns(), head.length);
  const values = sh.getRange(2, 1, sh.getLastRow() - 1, width).getValues();
  return values.map(function (r, i) {
    const o = { _row: i + 2 };
    head.forEach(function (h, c) { o[h] = r[c]; });
    return o;
  });
}
function fmtDate_(d) {
  if (!d) return '';
  if (Object.prototype.toString.call(d) !== '[object Date]') return String(d);
  return Utilities.formatDate(d, TZ, 'dd/MM/yyyy HH:mm');
}
function fmtDay_(d) {
  if (!d) return '';
  if (Object.prototype.toString.call(d) !== '[object Date]') return String(d);
  return Utilities.formatDate(d, TZ, 'dd/MM/yyyy');
}
function daysBetween_(a, b) { return Math.floor((b - a) / 86400000); }
function normPhone_(p) { return String(p || '').replace(/\D/g, ''); }
function user_() { return Session.getActiveUser().getEmail() || 'ไม่ระบุ'; }
function genToken_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 12); }

/**
 * สร้างรหัสจองอ่านง่าย: RYYMMDD-1234 เช่น R260831-4827
 * เลขท้ายสุ่ม 4 หลักและตรวจไม่ให้ซ้ำในวันเดียวกัน
 */
function genShortId_(existingIds, createdAt) {
  const prefix = 'R' + Utilities.formatDate(createdAt || new Date(), TZ, 'yyMMdd') + '-';
  let id;
  do {
    id = prefix + String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  } while (existingIds.indexOf(id) > -1);
  return id;
}

/**
 * ใช้เฉพาะช่วงทดสอบ: เปลี่ยนรหัสจองและรหัสอ้างอิงในโน้ตทั้งหมดเป็น RYYMMDD-4digits
 * ไม่เปลี่ยน token QR หรือข้อมูลลูกค้า จึงไม่กระทบลิงก์ QR ที่พิมพ์/ส่งไปแล้ว
 */
function migrateTestReservationIds() {
  assertEditorExecution_();
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const reservations = readAll_(SH.RES);
    const existing = [];
    const mapping = {};
    reservations.forEach(function (r) {
      const next = genShortId_(existing, r['วันเวลาที่จอง'] || new Date());
      existing.push(next);
      mapping[r['รหัสจอง']] = next;
      sh_(SH.RES).getRange(r._row, 1).setValue(next);
    });
    const notes = readAll_(SH.NOTE);
    notes.forEach(function (n) {
      if (mapping[n['รหัสจอง']]) sh_(SH.NOTE).getRange(n._row, 1).setValue(mapping[n['รหัสจอง']]);
    });
    SpreadsheetApp.getActive().toast('เปลี่ยนรหัสรายการแล้ว ' + reservations.length + ' รายการ', 'ระบบคิวจอง', 5);
    return { count: reservations.length, mapping: mapping };
  } finally { lock.releaseLock(); }
}
function cfg_(key, def) {
  const rows = readAll_(SH.CFG);
  const r = rows.filter(function (x) { return x['คีย์'] === key; })[0];
  return r ? r['ค่า'] : def;
}
// Google Sheets อาจส่งค่าจากสวิตช์เป็น Boolean หรือข้อความ true/false ตามวิธีแก้ไข
function isEnabled_(value) { return value === true || String(value).trim().toLowerCase() === 'true'; }

/** แปลงสตริงราคา "256GB=42900, 512GB=46900" → { '256GB': 42900, ... } (เฉพาะราคาเป็นจำนวนเต็ม ≥ 0) */
function parsePriceMap_(text) {
  const map = {};
  String(text || '').split(',').forEach(function (part) {
    const eq = part.indexOf('=');
    if (eq === -1) return;
    const cap = part.slice(0, eq).trim();
    const price = part.slice(eq + 1).replace(/[, ]/g, '').trim();
    if (cap && /^\d+$/.test(price)) map[cap] = Number(price);
  });
  return map;
}

// Cache ลดเวลาอ่าน Google Sheets ตอนเปิดหน้าแอป โดยข้อมูลจะถูกล้างทันทีหลังแก้ไข
const CACHE_BOOTSTRAP = 'queue_bootstrap_v5';
const CACHE_PRICE_MAP = 'queue_price_map_v1';
const CACHE_LIST_VERSION = 'queue_list_version_v1';
// v2 แยกจาก cache รุ่นก่อน เพื่อไม่ให้ข้อมูลรูปแบบเก่าปะปนหลังเปลี่ยนโครงสร้างหน้า Detail
const CACHE_DETAIL_PREFIX = 'queue_detail_v2_';
const CACHE_NOTES_PREFIX = 'queue_notes_v2_';
function invalidateBootstrapCache_() {
  // ราคาใช้ cache แยกในหน้า Check/พิมพ์ จึงต้องล้างพร้อม bootstrap ทุกครั้งที่บันทึกการตั้งค่า
  CacheService.getScriptCache().removeAll([CACHE_BOOTSTRAP, CACHE_PRICE_MAP]);
}
function invalidateListCache_() { CacheService.getScriptCache().put(CACHE_LIST_VERSION, String(Date.now()), 21600); }
function invalidateReservationCache_(id) {
  if (!id) return;
  const cache = CacheService.getScriptCache();
  cache.remove(CACHE_DETAIL_PREFIX + id);
  cache.remove(CACHE_NOTES_PREFIX + id);
}
function cacheJson_(key, value, seconds) {
  const text = JSON.stringify(value);
  if (text.length < 90000) CacheService.getScriptCache().put(key, text, seconds);
}
function readCachedJson_(key) {
  const text = CacheService.getScriptCache().get(key);
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) { return null; }
}

function addNote_(resId, text, who, source) {
  sh_(SH.NOTE).appendRow([resId, new Date(), who || user_(), text, source || 'manual']);
  invalidateReservationCache_(resId);
}

/* ============================================================
 * Bootstrap
 * ==========================================================*/

function safeGroupColor_(value, fallback) {
  const color = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : (fallback || '#444441');
}

function getBootstrap(token, forceRefresh) {
  assertStaff_(token);
  migrateWalkInGroup_();
  ensureGroupSettingsSchema_();
  ensureConfigDefaults_();
  ensureProductColumns_();
  return getBootstrap_(forceRefresh);
}

function getBootstrap_(forceRefresh) {
  const cached = readCachedJson_(CACHE_BOOTSTRAP);
  if (cached && !forceRefresh) {
    cached.user = user_(); // ผู้ใช้เป็นข้อมูลเฉพาะคน จึงไม่เก็บใน shared cache
    return cached;
  }
  ensureProductColumns_(); // การันตีว่ามีคอลัมน์ราคาก่อนอ่านชีตรุ่นสินค้าด้วยความกว้างใหม่
  const prods = readAll_(SH.PROD).filter(function (p) { return isEnabled_(p['เปิดรับจอง']); });
  const productList = prods.map(function (p) {
    return {
      row: p._row,
      model: String(p['รุ่น']).trim(),
      capacities: String(p['ความจุ'] || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      colors: String(p['สี'] || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      prices: parsePriceMap_(p['ราคา']) // { ความจุ: ราคา } — ความจุที่ไม่มีราคาจะไม่มีคีย์
    };
  });
  const groups = orderedEnabledGroups_()
    .map(function (g, i) { return { name: g['ชื่อกลุ่ม'], color: safeGroupColor_(g['สีป้าย'], GROUP_PALETTE[i % GROUP_PALETTE.length]), needsRef: isEnabled_(g['ต้องกรอกเลขอ้างอิง']), isDefault: isEnabled_(g['ค่าเริ่มต้น']), order: Number(g['ลำดับแสดงผล']) || i + 1 }; });
  const defaultGroup = groups.filter(function (g) { return g.isDefault; })[0] || groups[0] || null;
  const supplies = readAll_(SH.SUPPLY).filter(function (s) { return isEnabled_(s['เปิดใช้']); }).map(function (s) { return s['ชื่อซัพพลายเออร์']; });
  const promos = readAll_(SH.PROMO).filter(function (p) { return isEnabled_(p['เปิดใช้']); })
    .map(function (p) { return { name: p['ชื่อโครงการ'], desc: p['คำอธิบาย'] }; });
  const result = {
    products: productList, groups: groups, defaultGroup: defaultGroup ? defaultGroup.name : WALK_IN_GROUP, supplies: supplies, promos: promos,
    statuses: [STATUS.PENDING, STATUS.WAIT, STATUS.ARR, STATUS.APPT, STATUS.DONE, STATUS.CANCEL],
    depositEnabled: isEnabled_(cfg_('เก็บมัดจำ', 'true')),
    supplierLockEnabled: isEnabled_(cfg_('ล็อกซัพ', 'true')),
    alternativeOptionsEnabled: isEnabled_(cfg_('เปิดใช้ตัวเลือกเครื่องทางเลือก', 'true')),
    aisThaiOnly: isEnabled_(cfg_('โครงการ AIS เฉพาะภาษาไทย', 'false')),
    showCustomerGroup: isEnabled_(cfg_('แสดงกลุ่มลูกค้าในข้อมูลสำหรับลูกค้า', 'false')),
    defaultDueDays: Number(cfg_('วันครบกำหนดเริ่มต้น', 5))
  };
  cacheJson_(CACHE_BOOTSTRAP, result, 300);
  result.user = user_();
  return result;
}

/** ราคาของสเปก (รุ่น+ความจุ) จากชีตรุ่นสินค้า — สำหรับฝั่งที่ไม่มี bootstrap (Check/พิมพ์) · cache สั้น */
function productPriceMap_() {
  const cached = readCachedJson_(CACHE_PRICE_MAP);
  if (cached) return cached;
  ensureProductColumns_();
  const map = {};
  readAll_(SH.PROD).forEach(function (p) {
    const model = String(p['รุ่น'] || '').trim();
    if (!model) return;
    map[model] = parsePriceMap_(p['ราคา']);
  });
  cacheJson_(CACHE_PRICE_MAP, map, 300);
  return map;
}
function productPrice_(model, capacity) {
  const byModel = productPriceMap_()[String(model || '').trim()];
  if (!byModel) return null;
  const price = byModel[String(capacity || '').trim()];
  return (price == null) ? null : Number(price);
}

/** ใช้ราคาที่บันทึกไว้ตอนจอง; รายการเก่าที่ยังไม่มี snapshot ให้ย้อนกลับไปใช้ราคาปัจจุบัน */
function reservationPrice_(r) {
  const stored = r && r['ราคาขณะจอง'];
  if (stored !== '' && stored != null) {
    const value = Number(stored);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  return productPrice_(r && r['รุ่น'], r && r['ความจุ']);
}

/* ============================================================
 * แปลงข้อมูลแถวจองเป็นรูปแบบส่งกลับ client
 * ==========================================================*/

function toClient_(r, now) {
  now = now || new Date();
  const due = r['วันครบกำหนดรับ'] ? new Date(r['วันครบกำหนดรับ']) : null;
  const created = r['วันเวลาที่จอง'] ? new Date(r['วันเวลาที่จอง']) : null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let dueLabel = '';
  let dueRemainingDays = null;
  const appointmentStage = appointmentStage_(r, now);
  const displayStatus = appointmentStage === 'overdue' ? 'เลยกำหนดวันนัด' : appointmentStage === 'today' ? 'นัดรับวันนี้' : r['สถานะ'];
  if (due) {
    const d = daysBetween_(new Date(now.getFullYear(), now.getMonth(), now.getDate()), new Date(due.getFullYear(), due.getMonth(), due.getDate()));
    dueRemainingDays = d;
    if (r['สถานะ'] === STATUS.ARR) {
      dueLabel = d < 0 ? ('เลย ' + Math.abs(d) + ' วัน') : d === 0 ? 'ครบกำหนดวันนี้' : ('เหลือ ' + d + ' วัน');
    }
  }
  return {
    id: r['รหัสจอง'], token: r['โทเคน'], phone: String(r['เบอร์โทร'] || ''), name: r['ชื่อลูกค้า'],
    group: r['กลุ่มลูกค้า'], preBooking: r['เลขPreBooking'], preOrder: r['เลขPreOrder'] || '', additionalNote: r['ข้อมูลเพิ่มเติม'] || '', batchId: r['รหัสชุดการจอง'] || '',
    model: r['รุ่น'], capacity: r['ความจุ'], color: r['สี'],
    price: reservationPrice_(r),
    altColors: r['สีสำรอง'], altCaps: r['ความจุสำรอง'],
    supplierLock: !!r['ล็อกซัพ'], promo: r['โครงการ'],
    deposit: Number(r['มัดจำ']) || 0, billNo: r['เลขบิลมัดจำ'],
    status: r['สถานะ'], displayStatus: displayStatus, appointmentStage: appointmentStage,
    createdAt: fmtDate_(r['วันเวลาที่จอง']), createdRaw: created ? created.getTime() : 0,
    waitDays: created ? Math.max(0, daysBetween_(new Date(created.getFullYear(), created.getMonth(), created.getDate()), today)) : 0,
    dueDate: fmtDay_(r['วันครบกำหนดรับ']), dueLabel: dueLabel, dueRemainingDays: dueRemainingDays,
    appt: fmtDate_(r['วันนัดรับ']), extendCount: Number(r['จำนวนครั้งที่เลื่อน']) || 0,
    staff: r['พนักงานที่รับเรื่อง'], labeled: !!r['แปะใบแล้ว'], source: r['ที่มา'],
    callCount: Number(r['จำนวนครั้งที่โทร']) || 0, updatedAt: fmtDate_(r['อัปเดตล่าสุด']),
    urgent: !!r['เร่งด่วน'], urgentReason: r['เหตุผลเร่งด่วน'] || '',
    callDaysAgo: (function () {
      if (!(Number(r['จำนวนครั้งที่โทร']) || 0)) return null;
      const raw = r['วันที่โทรล่าสุด'] || r['อัปเดตล่าสุด'];
      if (!raw) return null;
      const dt = new Date(raw);
      if (isNaN(dt.getTime())) return null;
      return daysBetween_(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()), today);
    })()
  };
}

/* ============================================================
 * ลูกค้า
 * ==========================================================*/

function lookupCustomer_(phone) {
  const rows = readAll_(SH.CUST);
  return rows.filter(function (c) { return normPhone_(c['เบอร์โทร']) === phone; })[0];
}

function lookupPhone(token, phone) {
  assertStaff_(token);
  const ph = normPhone_(phone);
  if (ph.length < 8) return null;
  const cust = lookupCustomer_(ph);
  const res = readAll_(SH.RES).filter(function (r) { return normPhone_(r['เบอร์โทร']) === ph && r['สถานะ'] !== STATUS.CANCEL; }).map(function(r){return toClient_(r);});
  if (!cust && !res.length) return null;
  return {
    customer: cust ? { name: cust['ชื่อ-นามสกุล'], channel: cust['ช่องทางติดต่อ'], contactId: cust['ไอดี/อีเมล'] } : null,
    reservations: res
  };
}

function upsertCustomer_(p, phone, now) {
  const sh = sh_(SH.CUST);
  const found = lookupCustomer_(phone);
  if (found) {
    const rows = readAll_(SH.CUST);
    const row = rows.filter(function (c) { return normPhone_(c['เบอร์โทร']) === phone; })[0]._row;
    sh.getRange(row, 2).setValue(p.name);
    if (p.channel) sh.getRange(row, 3).setValue(p.channel);
    if (p.contactId) sh.getRange(row, 4).setValue(p.contactId);
    if (p.lang) sh.getRange(row, 5).setValue(p.lang);
    if (p.group) sh.getRange(row, 6).setValue(p.group);
  } else {
    sh.appendRow(["'" + phone, p.name, p.channel || '', p.contactId || '', p.lang || 'ไทย', p.group || '', now]);
  }
}

/* ============================================================
 * บันทึกการจอง (พนักงาน) — devices: array ของเครื่อง
 * ==========================================================*/

/** โยน error ถ้าเลขบิลมัดจำซ้ำกับรายการอื่นที่ยังไม่ยกเลิก (excludeId = รหัสจองของตัวเองตอนแก้ไข) */
function assertBillNoUnique_(billNo, excludeId, allRes, allowedBatchId) {
  const bn = String(billNo || '').trim();
  if (!bn) return;
  const rows = allRes || readAll_(SH.RES);
  const dup = rows.filter(function (x) {
    const sameAllowedBatch = allowedBatchId && String(x['รหัสชุดการจอง'] || '') === String(allowedBatchId);
    return x['รหัสจอง'] !== excludeId && !sameAllowedBatch && x['เลขบิลมัดจำ'] && String(x['เลขบิลมัดจำ']) === bn && x['สถานะ'] !== STATUS.CANCEL;
  })[0];
  if (dup) throw new Error('เลขบิลมัดจำ ' + bn + ' ซ้ำกับรายการของ ' + dup['ชื่อลูกค้า']);
}

const MAX_RESERVATION_DEVICES = 10;
function boundedText_(value, label, maxLength, required) {
  const text = String(value == null ? '' : value).trim();
  if (required && !text) throw new Error('กรุณาระบุ' + label);
  if (text.length > maxLength) throw new Error(label + 'ยาวเกิน ' + maxLength + ' ตัวอักษร');
  return text;
}
function exactList_(value) {
  return (Array.isArray(value) ? value : String(value || '').split(',')).map(function (x) { return String(x || '').trim(); }).filter(Boolean);
}
function enabledProductMap_() {
  const map = {};
  readAll_(SH.PROD).filter(function (row) { return isEnabled_(row['เปิดรับจอง']); }).forEach(function (row) {
    const model = String(row['รุ่น'] || '').trim();
    if (!model) return;
    if (!map[model]) map[model] = { capacities: {}, colors: {} };
    exactList_(row['ความจุ']).forEach(function (value) { map[model].capacities[value] = true; });
    exactList_(row['สี']).forEach(function (value) { map[model].colors[value] = true; });
  });
  return map;
}
function assertProductSelection_(model, capacity, color, productMap) {
  const spec = productMap[model];
  if (!spec || !spec.capacities[capacity] || !spec.colors[color]) throw new Error('รุ่น ความจุ หรือสีไม่อยู่ในรายการสินค้าที่เปิดรับจอง');
}

/** entry สำหรับพนักงาน (ผ่าน callApi) — ตรวจสิทธิ์ก่อน แล้วเรียก core */
function saveReservation(token, p) {
  assertStaff_(token);
  p = p && typeof p === 'object' ? p : {};
  p.source = 'staff';
  return saveReservation_(p);
}
/** core: บันทึกการจอง — เรียกได้ทั้งจากพนักงาน (ผ่าน wrapper) และจาก submitSignup ของลูกค้า */
function saveReservation_(p) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (!p || typeof p !== 'object') throw new Error('ข้อมูลการจองไม่ถูกต้อง');
    ensureReservationColumns_();
    ensureProductColumns_();
    const phone = normPhone_(p.phone);
    p.name = boundedText_(p.name, 'ชื่อลูกค้า', 120, true);
    p.channel = boundedText_(p.channel, 'ช่องทางติดต่อ', 80, false);
    p.contactId = boundedText_(p.contactId, 'ไอดีหรืออีเมล', 160, false);
    p.preOrder = boundedText_(p.preOrder, 'เลข Pre-Order', 120, false);
    p.preBooking = boundedText_(p.preBooking, 'เลข Pre-Booking', 120, false);
    p.note = boundedText_(p.note, 'ข้อมูลเพิ่มเติม', 1000, false);
    if (phone.length < 9 || phone.length > 15) throw new Error('เบอร์โทรไม่ถูกต้อง');
    if (!Array.isArray(p.devices) || !p.devices.length) throw new Error('กรุณาเพิ่มอย่างน้อยหนึ่งเครื่อง');
    if (p.devices.length > MAX_RESERVATION_DEVICES) throw new Error('บันทึกได้สูงสุด ' + MAX_RESERVATION_DEVICES + ' เครื่องต่อครั้ง');
    const allRes = readAll_(SH.RES);
    // ยืนยันซ้ำภายใน ScriptLock เพื่อปิดช่องว่างกรณีมีรายการสเปกเดียวกันถูกสร้างพร้อมกัน
    if (p.source === 'customer' && hasExactActiveSignupDuplicate_(phone, p.devices, allRes) && p.confirmDuplicate !== true) {
      throw new Error('DUPLICATE_CONFIRM_REQUIRED');
    }
    const enabledGroups = orderedEnabledGroups_();
    if (!enabledGroups.length) throw new Error('ระบบยังไม่มีกลุ่มลูกค้าที่เปิดใช้งาน กรุณาติดต่อพนักงาน');
    const enabledGroupNames = enabledGroups.map(function (g) { return String(g['ชื่อกลุ่ม']); });
    const configuredDefault = enabledGroups.filter(function (g) { return isEnabled_(g['ค่าเริ่มต้น']); })[0] || enabledGroups[0];
    const requestedGroup = String(p.group || '');
    if (p.source === 'customer') p.group = configuredDefault ? String(configuredDefault['ชื่อกลุ่ม']) : WALK_IN_GROUP;
    else if (enabledGroupNames.indexOf(requestedGroup) === -1) throw new Error('กลุ่มลูกค้าไม่ได้เปิดใช้งาน กรุณารีเฟรชหน้าแล้วเลือกใหม่');
    else p.group = requestedGroup;
    const depositEnabled = isEnabled_(cfg_('เก็บมัดจำ', 'true'));
    const supplierLockEnabled = isEnabled_(cfg_('ล็อกซัพ', 'true'));
    const alternativeOptionsEnabled = isEnabled_(cfg_('เปิดใช้ตัวเลือกเครื่องทางเลือก', 'true'));
    const productMap = enabledProductMap_();
    const promoNames = readAll_(SH.PROMO).filter(function (row) { return isEnabled_(row['เปิดใช้']); }).map(function (row) { return String(row['ชื่อโครงการ']); });
    const depositPlan = applyDepositPlan_(p, depositEnabled);
    // ป้องกันการบันทึกค่าจากหน้าจอเก่า/คำขอที่ถูกแก้ไข เมื่อฟีเจอร์ถูกปิดในตั้งค่าแล้ว
    if (enabledGroupNames.indexOf('Pre-Order') === -1) p.preOrder = '';
    if (enabledGroupNames.indexOf('Pre-Booking') === -1 || !supplierLockEnabled) p.preBooking = '';
    if (p.source !== 'customer' && p.group === 'Pre-Order' && !p.preOrder) throw new Error('กรุณาระบุเลข Pre-Order');
    p.devices.forEach(function (d) {
      if (!d || typeof d !== 'object') throw new Error('ข้อมูลเครื่องไม่ถูกต้อง');
      d.model = boundedText_(d.model, 'รุ่นสินค้า', 120, true);
      d.capacity = boundedText_(d.capacity, 'ความจุ', 60, true);
      d.color = boundedText_(d.color, 'สี', 80, true);
      assertProductSelection_(d.model, d.capacity, d.color, productMap);
      d.altColors = alternativeOptionsEnabled ? exactList_(d.altColors).filter(function (value) { return value !== d.color; }) : [];
      d.altCaps = alternativeOptionsEnabled ? exactList_(d.altCaps).filter(function (value) { return value !== d.capacity; }) : [];
      if (d.altColors.some(function (value) { return !productMap[d.model].colors[value]; }) || d.altCaps.some(function (value) { return !productMap[d.model].capacities[value]; })) {
        throw new Error('ตัวเลือกสีหรือความจุสำรองไม่อยู่ในรายการสินค้าที่เปิดรับจอง');
      }
      d.promo = boundedText_(d.promo, 'ชื่อโครงการ', 120, false);
      d.billNo = boundedText_(d.billNo, 'เลขบิลมัดจำ', 120, false);
      if (!supplierLockEnabled) { d.supplierLock = false; d.supplier = ''; d.promo = ''; }
      else {
        if (d.promo && promoNames.indexOf(d.promo) === -1) throw new Error('โครงการ AIS ไม่ได้เปิดใช้งาน กรุณารีเฟรชหน้าแล้วเลือกใหม่');
        d.supplierLock = !!d.supplierLock || !!d.promo;
        d.supplier = d.supplierLock ? AIS_SUPPLIER : '';
      }
      if (!depositEnabled) { d.deposit = 0; d.billNo = ''; }
      else {
        const deposit = Number(d.deposit || 0);
        if (!Number.isFinite(deposit) || deposit < 0 || deposit > 10000000) throw new Error('ยอดมัดจำไม่ถูกต้อง');
        d.deposit = deposit;
        if (deposit > 0 && !d.billNo) throw new Error('กรุณาระบุเลขบิลมัดจำ');
        if (!deposit) d.billNo = '';
      }
      // โปรโมชัน = โปรแกรม AIS เสมอ → บังคับล็อกซัพเป็น AIS ให้สอดคล้อง (กันข้อมูลที่ทำให้จับคู่ผิดกฎ)
      if (d.promo) { d.supplierLock = true; d.supplier = AIS_SUPPLIER; }
      // อ่านจากฝั่งเซิร์ฟเวอร์เท่านั้น ไม่รับราคาจาก client เพื่อป้องกันการแก้ไขคำขอ
      d.priceAtBooking = productPrice_(d.model, d.capacity);
    });
    if (p.preBooking && p.devices.some(function (d) { return !d.supplierLock || String(d.supplier) !== AIS_SUPPLIER; })) {
      throw new Error('Pre-Booking AIS ต้องใช้เครื่องจากซัพ AIS เท่านั้น');
    }
    if (depositPlan.billNo) assertBillNoUnique_(depositPlan.billNo, null, allRes, null);

    const now = new Date();
    const sh = sh_(SH.RES);
    const created = [];
    const bookingBatchId = Utilities.getUuid();
    const existingIds = allRes.map(function (r) { return r['รหัสจอง']; });
    p.devices.forEach(function (d, idx) {
      const id = genShortId_(existingIds, now);
      existingIds.push(id); // กันซ้ำภายในรอบเดียวกัน
      const token = genToken_();
      sh.appendRow([
        id, token, "'" + phone, p.name, p.group || '', p.preBooking || '',
        d.model, d.capacity || '', d.color || '', alternativeOptionsEnabled ? (d.altColors || []).join(', ') : '', alternativeOptionsEnabled ? (d.altCaps || []).join(', ') : '',
        supplierLockEnabled && !!d.supplierLock, supplierLockEnabled ? (d.supplier || '') : '', supplierLockEnabled ? (d.promo || '') : '',
        depositEnabled ? (Number(d.deposit) || 0) : 0, depositEnabled ? (d.billNo || '') : '', depositEnabled && d.billNo ? now : '',
        p.source === 'customer' ? STATUS.PENDING : STATUS.WAIT,
        now, '', '', 0, user_(), false, p.source || 'staff', 0, now, user_(), p.preOrder || '', p.note || '', '', false, '',
        d.priceAtBooking == null ? '' : d.priceAtBooking, bookingBatchId
      ]);
      addNote_(id, p.source === 'customer' ? 'ลงชื่อสนใจสินค้า (ลูกค้ากรอกเอง รอตรวจสอบ)' : ('ลงชื่อสนใจสินค้า · ' + (p.group || '') + (d.deposit ? (' · มัดจำ ' + d.deposit) : '')), user_(), 'auto');
      if (p.note) addNote_(id, 'ข้อมูลเพิ่มเติม: ' + p.note, user_(), 'manual');
      created.push({ id: id, token: token, model: d.model, capacity: d.capacity, color: d.color });
    });

    upsertCustomer_({ name: p.name, channel: p.channel, contactId: p.contactId, lang: p.lang, group: p.group }, phone, now);
    invalidateListCache_();
    // เขียนข้อมูลทั้งหมดให้เสร็จก่อนปล่อย ScriptLock เพื่อกันเลขบิล/รหัสจองชนกันจากคำขอพร้อมกัน
    SpreadsheetApp.flush();
    return { ok: true, devices: created, count: created.length };
  } finally { lock.releaseLock(); }
}

/** เพิ่มคอลัมน์ใหม่โดยไม่เลื่อนข้อมูลรายการเดิม */
function ensureReservationColumns_() {
  const sh = sh_(SH.RES);
  const head = HEAD[SH.RES];
  if (sh.getMaxColumns() < head.length) sh.insertColumnsAfter(sh.getMaxColumns(), head.length - sh.getMaxColumns());
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
}

/* ============================================================
 * รายการจอง — สองแกนฟิลเตอร์ + ค้นหา
 * ==========================================================*/

function dayOffset_(value, now) {
  if (!value) return null;
  const d = new Date(value), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (isNaN(d.getTime())) return null;
  return daysBetween_(today, new Date(d.getFullYear(), d.getMonth(), d.getDate()));
}

function appointmentStage_(r, now) {
  if (r['สถานะ'] !== STATUS.APPT || !r['วันนัดรับ']) return '';
  const raw = r['วันนัดรับ'], appointment = new Date(raw);
  if (isNaN(appointment.getTime())) return '';
  const offset = dayOffset_(appointment, now);
  const dateOnlyText = typeof raw === 'string' && /^\s*\d{4}-\d{2}-\d{2}\s*$/.test(raw);
  const hasTime = !dateOnlyText && Utilities.formatDate(appointment, TZ, 'HH:mm:ss') !== '00:00:00';
  if (offset < 0 || (offset === 0 && hasTime && now.getTime() > appointment.getTime())) return 'overdue';
  if (offset === 0) return 'today';
  return 'scheduled';
}

function workFocusKey_(r, key, now, callThreshold) {
  const status = r['สถานะ'], calls = Number(r['จำนวนครั้งที่โทร']) || 0;
  const dueOffset = dayOffset_(r['วันครบกำหนดรับ'], now);
  const appointmentStage = appointmentStage_(r, now);
  if (key === 'overdue') return (status === STATUS.ARR && dueOffset !== null && dueOffset < 0) || appointmentStage === 'overdue';
  if (key === 'today') return appointmentStage === 'today';
  if (key === 'noCall') return status === STATUS.ARR && calls === 0;
  if (key === 'failed') return (status === STATUS.ARR || appointmentStage === 'overdue') && calls >= callThreshold;
  if (key === 'pending') return status === STATUS.PENDING;
  return false;
}

function sortableTime_(value) {
  const time = value ? new Date(value).getTime() : NaN;
  return isNaN(time) ? 8640000000000000 : time;
}

function workPriority_(r, now, callThreshold) {
  if (workFocusKey_(r, 'overdue', now, callThreshold)) return 1;
  if (workFocusKey_(r, 'today', now, callThreshold)) return 2;
  if (workFocusKey_(r, 'noCall', now, callThreshold)) return 3;
  if (workFocusKey_(r, 'failed', now, callThreshold)) return 4;
  if (r['สถานะ'] === STATUS.ARR) return 5;
  if (r['สถานะ'] === STATUS.PENDING) return 6;
  if (r['สถานะ'] === STATUS.APPT) return 7;
  if (r['สถานะ'] === STATUS.WAIT) return 8;
  return 9;
}

const AUTO_CANCEL_AUDIT_PREFIX = 'ระบบขึ้นสถานะยกเลิกอัตโนมัติ';

/**
 * สถานะ "ยกเลิกอัตโนมัติ" ใน UI เป็นค่าคำนวณ ไม่ได้ปิดรายการจริง
 * คืนข้อความ Audit เฉพาะรายการที่เคยได้รับสินค้าแล้ว/นัดรับแล้ว และเกินวันครบกำหนดรับ
 */
function autoCancelAuditText_(r, now) {
  const status = r['สถานะ'];
  if (status !== STATUS.ARR && status !== STATUS.APPT) return '';
  const dueRaw = r['วันครบกำหนดรับ'];
  const dueOffset = dayOffset_(dueRaw, now || new Date());
  if (dueOffset === null || dueOffset >= 0) return '';
  return AUTO_CANCEL_AUDIT_PREFIX + ' · เกินกำหนดรับ ' + fmtDay_(new Date(dueRaw));
}

function addAutoCancelAuditIfNeeded_(r, now, notes) {
  const text = autoCancelAuditText_(r, now);
  if (!text) return false;
  const id = r['รหัสจอง'];
  const exists = (notes || []).some(function (n) {
    return n['รหัสจอง'] === id && String(n['ข้อความ'] || '') === text;
  });
  if (exists) return false;
  addNote_(id, text, 'ระบบ', 'auto');
  notes.push({ 'รหัสจอง': id, 'ข้อความ': text });
  return true;
}

/** บันทึก Audit แบบ best-effort ระหว่าง Refresh หน้าตามด่วน โดยใช้ Lock กันโน้ตซ้ำจากหลายหน้าจอ */
function syncAutoCancelAudits_(rows, now) {
  const cache = CacheService.getScriptCache();
  const candidates = (rows || []).map(function (r) {
    const text = autoCancelAuditText_(r, now);
    if (!text) return null;
    const dueKey = fmtDay_(new Date(r['วันครบกำหนดรับ'])).replace(/\D/g, '');
    return { row: r, key: 'auto_cancel_audit_v1_' + r['รหัสจอง'] + '_' + dueKey };
  }).filter(function (x) { return !!x; });
  if (!candidates.length) return;
  const known = cache.getAll(candidates.map(function (x) { return x.key; }));
  const pending = candidates.filter(function (x) { return !known[x.key]; });
  if (!pending.length) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const notes = readAll_(SH.NOTE) || [];
    const markers = {};
    pending.forEach(function (x) {
      addAutoCancelAuditIfNeeded_(x.row, now, notes);
      markers[x.key] = '1';
    });
    cache.putAll(markers, 21600);
  } finally { lock.releaseLock(); }
}

function listReservations(token, filter) {
  assertStaff_(token);
  filter = filter || {};
  const allowedStatuses = [STATUS.PENDING, STATUS.WAIT, STATUS.ARR, STATUS.APPT, STATUS.DONE, STATUS.CANCEL];
  const allowedFocus = ['overdue', 'today', 'noCall', 'failed', 'pending'];
  const requestedStatus = String(filter.status || '');
  const requestedFocus = String(filter.focus || '');
  const requestedLimit = Math.floor(Number(filter.limit) || 300);
  const appliedFilter = {
    q: String(filter.q || '').slice(0, 160),
    group: String(filter.group || '').slice(0, 120),
    status: allowedStatuses.indexOf(requestedStatus) > -1 ? requestedStatus : '',
    focus: allowedFocus.indexOf(requestedFocus) > -1 ? requestedFocus : '',
    includeClosed: !!filter.includeClosed,
    aisOnly: !!filter.aisOnly,
    limit: Math.max(1, Math.min(500, requestedLimit))
  };
  const cache = CacheService.getScriptCache();
  const version = cache.get(CACHE_LIST_VERSION) || '0';
  // ใช้ cache เฉพาะรายชื่อเริ่มต้น ตัวกรองที่ผู้ใช้กดต้องอ่านข้อมูลสดตั้งแต่คลิกแรก
  const cacheable = !appliedFilter.q && !appliedFilter.group && !appliedFilter.status && !appliedFilter.focus && !appliedFilter.includeClosed && !appliedFilter.aisOnly;
  const cacheKey = 'queue_list_v3_' + version + '_' + Utilities.base64EncodeWebSafe(JSON.stringify(appliedFilter));
  const cached = cacheable ? readCachedJson_(cacheKey) : null;
  if (cached && cached.appliedFilter && JSON.stringify(cached.appliedFilter) === JSON.stringify(appliedFilter)) return cached;
  const now = new Date();
  const callThreshold = Number(cfg_('ครั้งโทรไม่ติดแล้วเตือน', 3)) || 3;
  const q = appliedFilter.q.trim().toLowerCase();
  const qDigits = normPhone_(appliedFilter.q);
  let rows = readAll_(SH.RES);
  const activeRows = rows.filter(function (r) { return r['สถานะ'] !== STATUS.DONE && r['สถานะ'] !== STATUS.CANCEL; });
  const focus = {
    overdue: activeRows.filter(function (r) { return workFocusKey_(r, 'overdue', now, callThreshold); }).length,
    today: activeRows.filter(function (r) { return workFocusKey_(r, 'today', now, callThreshold); }).length,
    noCall: activeRows.filter(function (r) { return workFocusKey_(r, 'noCall', now, callThreshold); }).length,
    failed: activeRows.filter(function (r) { return workFocusKey_(r, 'failed', now, callThreshold); }).length,
    pending: activeRows.filter(function (r) { return workFocusKey_(r, 'pending', now, callThreshold); }).length
  };

  // หน้า "ดูรายการปิดแล้ว" ต้องแสดงเฉพาะรายการที่จบจริง ไม่ใช่รายการทั้งหมด
  const isClosed = function (r) { return r['สถานะ'] === STATUS.DONE || r['สถานะ'] === STATUS.CANCEL; };
  if (appliedFilter.status) {
    // เมื่อเลือกสถานะโดยตรง ให้ค่านี้เป็น source of truth ไม่ผสมกับโหมดรายการปิด
    rows = rows.filter(function (r) { return r['สถานะ'] === appliedFilter.status; });
  } else if (appliedFilter.includeClosed) {
    rows = rows.filter(isClosed);
  } else {
    rows = rows.filter(function (r) { return !isClosed(r); });
  }
  if (appliedFilter.group) rows = rows.filter(function (r) { return r['กลุ่มลูกค้า'] === appliedFilter.group; });
  if (appliedFilter.focus) rows = rows.filter(function (r) { return workFocusKey_(r, appliedFilter.focus, now, callThreshold); });
  if (appliedFilter.aisOnly) rows = rows.filter(function (r) { return !!r['ล็อกซัพ']; });
  if (q) {
    rows = rows.filter(function (r) {
      return String(r['ชื่อลูกค้า']).toLowerCase().indexOf(q) > -1 ||
        (qDigits && String(r['เบอร์โทร']).indexOf(qDigits) > -1) ||
        String(r['เลขบิลมัดจำ']).toLowerCase().indexOf(q) > -1 ||
        String(r['เลขPreBooking']).toLowerCase().indexOf(q) > -1 ||
        String(r['รหัสจอง']).toLowerCase().indexOf(q) > -1 ||
        String(r['รุ่น']).toLowerCase().indexOf(q) > -1 ||
        String(r['โครงการ']).toLowerCase().indexOf(q) > -1;
    });
  }
  rows.sort(function (a, b) {
    const s = workPriority_(a, now, callThreshold) - workPriority_(b, now, callThreshold);
    if (s !== 0) return s;
    const aActionDate = sortableTime_(a['สถานะ'] === STATUS.APPT ? a['วันนัดรับ'] : a['วันครบกำหนดรับ']);
    const bActionDate = sortableTime_(b['สถานะ'] === STATUS.APPT ? b['วันนัดรับ'] : b['วันครบกำหนดรับ']);
    if (aActionDate !== bActionDate) return aActionDate - bActionDate;
    return sortableTime_(a['วันเวลาที่จอง']) - sortableTime_(b['วันเวลาที่จอง']);
  });
  const result = {
    items: rows.slice(0, appliedFilter.limit).map(function (r) { return toClient_(r, now); }),
    total: rows.length,
    focus: focus,
    appliedFilter: appliedFilter
  };
  if (cacheable) cacheJson_(cacheKey, result, 30);
  return result;
}

function getReservation(token, id) {
  assertStaff_(token);
  const cache = CacheService.getScriptCache();
  const cacheKey = CACHE_DETAIL_PREFIX + id;
  const cached = readCachedJson_(cacheKey);
  if (cached) return cached;
  // อ่านชีตรายการจองเพียงครั้งเดียว: ใช้ทั้งหารายการหลักและรายการอื่นของลูกค้าคนเดียวกัน
  const allReservations = readAll_(SH.RES) || [];
  const r = allReservations.filter(function (x) { return x['รหัสจอง'] === id; })[0];
  if (!r) throw new Error('ไม่พบรายการ ' + id);
  const client = toClient_(r);
  if (client.batchId) {
    const batchRows = allReservations.filter(function (x) { return String(x['รหัสชุดการจอง'] || '') === String(client.batchId); });
    client.depositBatchCount = batchRows.length;
    client.depositBatchTotal = batchRows.reduce(function (sum, x) { return sum + (Number(x['มัดจำ']) || 0); }, 0);
  }
  const siblings = [];
  allReservations.forEach(function (x) {
    if (normPhone_(x['เบอร์โทร']) === normPhone_(r['เบอร์โทร']) && x['รหัสจอง'] !== id) siblings.push(toClient_(x));
  });
  client.siblings = siblings;
  cacheJson_(cacheKey, client, 60);
  return client;
}

/** โหลดประวัติแยกจากข้อมูลหลัก เพื่อให้หน้ารายละเอียดแสดงทันที */
function getReservationNotes(token, id) {
  assertStaff_(token);
  const cache = CacheService.getScriptCache();
  const cacheKey = CACHE_NOTES_PREFIX + id;
  const cached = readCachedJson_(cacheKey);
  if (cached) return cached;
  const notes = (readAll_(SH.NOTE) || []).filter(function (n) { return n['รหัสจอง'] === id; })
    .sort(function (a, b) { return new Date(b['วันเวลา']) - new Date(a['วันเวลา']); })
    .map(function (n) { return { at: fmtDate_(n['วันเวลา']), by: n['ผู้เขียน'], text: n['ข้อความ'], auto: n['ที่มา'] === 'auto', urgent: n['ที่มา'] === 'urgent' }; });
  cacheJson_(cacheKey, notes, 60);
  return notes;
}

function getCustomerNotes_(phone) {
  const ph = normPhone_(phone);
  const ids = readAll_(SH.RES).filter(function (r) { return normPhone_(r['เบอร์โทร']) === ph; }).map(function (r) { return r['รหัสจอง']; });
  return readAll_(SH.NOTE).filter(function (n) { return ids.indexOf(n['รหัสจอง']) > -1; })
    .sort(function (a, b) { return new Date(b['วันเวลา']) - new Date(a['วันเวลา']); })
    .map(function (n) { return { at: fmtDate_(n['วันเวลา']), by: n['ผู้เขียน'], text: n['ข้อความ'], auto: n['ที่มา'] === 'auto' }; });
}

function addManualNote(token, id, text) {
  assertStaff_(token);
  text = boundedText_(text, 'ข้อความ', 1000, true);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const r = findRow_(id);
    assertReservationStatus_(r, [STATUS.PENDING, STATUS.WAIT, STATUS.ARR, STATUS.APPT], 'เพิ่มโน้ต');
    addNote_(id, text, user_(), 'manual');
    SpreadsheetApp.flush();
    return true;
  } finally { lock.releaseLock(); }
}

/* ============================================================
 * อัปเดตสถานะ / วันนัด / วันครบกำหนด
 * ==========================================================*/

function findRow_(id) {
  const rows = readAll_(SH.RES);
  const r = rows.filter(function (x) { return x['รหัสจอง'] === id; })[0];
  if (!r) throw new Error('ไม่พบรายการ ' + id);
  return r;
}
function touch_(sh, row, id) {
  sh.getRange(row, 27).setValue(new Date());
  sh.getRange(row, 28).setValue(user_());
  invalidateListCache_();
  invalidateReservationCache_(id);
}

function assertReservationStatus_(reservation, allowed, actionLabel) {
  const current = String(reservation['สถานะ'] || 'ไม่ระบุ');
  if (allowed.indexOf(current) === -1) {
    throw new Error((actionLabel || 'ดำเนินการ') + 'ไม่ได้ เนื่องจากสถานะปัจจุบันคือ “' + current + '” กรุณารีเฟรชข้อมูล');
  }
}

function markArrived_(id, dueDate) {
  // ต้องเรียกภายใต้ ScriptLock ที่ถืออยู่แล้วเท่านั้น (ตัวห่อ public จะจัดการ lock/flush ให้)
  const r = findRow_(id); const sh = sh_(SH.RES);
  // กันจัดสรร/บันทึกสินค้าเข้าซ้ำรายการเดียวกัน: อนุญาตเฉพาะรายการที่ยัง "รอสินค้า"
  // ตรวจใต้ lock หลัง findRow_ อ่านค่าล่าสุด เพื่อกันพนักงานสองคน/ดับเบิลคลิกทำรายการเดียวกันพร้อมกัน
  if (r['สถานะ'] !== STATUS.WAIT) {
    throw new Error('รายการนี้ถูกดำเนินการไปแล้ว (สถานะปัจจุบัน: ' + r['สถานะ'] + ') กรุณารีเฟรชแล้วลองใหม่');
  }
  const due = dueDate ? new Date(dueDate) : null;
  if (due && isNaN(due.getTime())) throw new Error('วันครบกำหนดรับไม่ถูกต้อง');
  sh.getRange(r._row, 18).setValue(STATUS.ARR);
  if (due) sh.getRange(r._row, 20).setValue(due);
  touch_(sh, r._row, id);
  addNote_(id, 'เปลี่ยนเป็น ของมาแล้ว' + (due ? (' · ครบกำหนด ' + fmtDay_(due)) : ''), user_(), 'auto');
  return true;
}

function markArrived(token, id, dueDate) {
  assertStaff_(token);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const out = markArrived_(id, dueDate);
    // commit ก่อนปล่อย lock เพื่อให้คำขอถัดไป (พนักงานอีกคน) เห็นสถานะล่าสุด ไม่จัดสรรซ้ำ
    SpreadsheetApp.flush();
    return out;
  } finally { lock.releaseLock(); }
}

/** entry สำหรับพนักงาน (ผ่าน callApi) */
function getAppointmentSlot(token, dt, ignoreId) {
  assertStaff_(token);
  return getAppointmentSlot_(dt, ignoreId);
}
/** core: ตรวจจำนวนคิวที่นัดรับตรงวันและเวลาเดียวกัน โดยไม่นับรายการที่ปิดแล้ว (เรียกภายในได้) */
function getAppointmentSlot_(dt, ignoreId) {
  const when = new Date(dt);
  if (isNaN(when.getTime())) throw new Error('วันเวลานัดรับไม่ถูกต้อง');
  const key = Utilities.formatDate(when, TZ, 'yyyy-MM-dd HH:mm');
  const count = readAll_(SH.RES).filter(function (r) {
    if (r['รหัสจอง'] === ignoreId || r['สถานะ'] === STATUS.DONE || r['สถานะ'] === STATUS.CANCEL || !r['วันนัดรับ']) return false;
    return Utilities.formatDate(new Date(r['วันนัดรับ']), TZ, 'yyyy-MM-dd HH:mm') === key;
  }).length;
  return { count: count, limit: 3, isBusy: count >= 3, label: fmtDate_(when) };
}

function assertAppointmentTime_(dt) {
  const when = new Date(dt);
  if (isNaN(when.getTime())) throw new Error('วันเวลานัดรับไม่ถูกต้อง');
  if (when.getTime() < Date.now() - 60000) throw new Error('วันเวลานัดรับต้องไม่เป็นเวลาในอดีต');
  const hhmm = Utilities.formatDate(when, TZ, 'HH:mm');
  if (hhmm < '11:00' || hhmm > '20:00') throw new Error('นัดรับได้เฉพาะเวลา 11:00–20:00 น.');
  return when;
}

function setAppointment(token, id, dt, forceBusySlot) {
  assertStaff_(token);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const when = assertAppointmentTime_(dt);
    const r = findRow_(id); const sh = sh_(SH.RES);
    assertReservationStatus_(r, [STATUS.ARR, STATUS.APPT], 'บันทึกวันนัดรับ');
    const slot = getAppointmentSlot_(when, id);
    if (slot.isBusy && !forceBusySlot) return { needsConfirm: true, slot: slot };
    // เก็บหลักฐานก่อนเขียนวันใหม่ เพราะหลังเลื่อนนัดจะไม่สามารถระบุได้แล้วว่าเคยเกินกำหนดเดิม
    addAutoCancelAuditIfNeeded_(r, new Date(), readAll_(SH.NOTE) || []);
    sh.getRange(r._row, 18).setValue(STATUS.APPT);
    sh.getRange(r._row, 21).setValue(when);
    const due = new Date(when);
    due.setDate(due.getDate() + Number(cfg_('วันครบกำหนดหลังนัด', 3)));
    sh.getRange(r._row, 20).setValue(due);
    if (r['สถานะ'] === STATUS.APPT && r['วันนัดรับ']) {
      sh.getRange(r._row, 22).setValue((Number(r['จำนวนครั้งที่เลื่อน']) || 0) + 1);
    }
    touch_(sh, r._row, id);
    addNote_(id, 'นัดรับวันที่ ' + fmtDate_(when) + ' · ครบกำหนดรับ ' + fmtDay_(due), user_(), 'auto');
    SpreadsheetApp.flush();
    return { ok: true, slot: slot, dueDate: fmtDay_(due) };
  } finally { lock.releaseLock(); }
}

function logCallResult(token, id, result, note) {
  assertStaff_(token);
  if (['ok', 'busy', 'cancel', 'อื่นๆ'].indexOf(String(result || '')) === -1) throw new Error('ผลการติดต่อไม่ถูกต้อง');
  note = boundedText_(note, 'รายละเอียดการติดต่อ', 500, false);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const r = findRow_(id); const sh = sh_(SH.RES);
    assertReservationStatus_(r, [STATUS.APPT], 'บันทึกผลการโทร');
    ensureReservationColumns_();
    sh.getRange(r._row, 26).setValue((Number(r['จำนวนครั้งที่โทร']) || 0) + 1);
    sh.getRange(r._row, 31).setValue(new Date()); // วันที่โทรล่าสุด
    touch_(sh, r._row, id);
    const label = { ok: 'คุยได้ นัดวันใหม่', busy: 'ติดต่อไม่ได้', cancel: 'ลูกค้าขอยกเลิก' }[result] || result;
    addNote_(id, 'บันทึกผลการโทร: ' + label + (note ? (' · ' + note) : ''), user_(), 'auto');
    if (result === 'cancel') cancelWithReason_(id, 'customer', 'ลูกค้ายกเลิกการจอง', 'แจ้งผ่านการโทร');
    SpreadsheetApp.flush();
    return true;
  } finally { lock.releaseLock(); }
}

function cancelWithReason_(id, type, reason, other) {
  const allowed = type === 'customer'
    ? ['ลูกค้ายกเลิกการจอง', 'ได้สินค้าจากที่อื่นแล้ว', 'ไม่มีรุ่นที่ต้องการ', 'อื่นๆ']
    : ['ข้อมูลการจองซ้ำ', 'ลูกค้าขอยกเลิก', 'เกินกำหนดรับ', 'อื่นๆ'];
  if (allowed.indexOf(reason) === -1) throw new Error('เหตุผลการยกเลิกไม่ถูกต้อง');
  other = boundedText_(other, 'เหตุผลเพิ่มเติม', 500, false);
  if (reason === 'อื่นๆ' && !other) throw new Error('กรุณาระบุเหตุผลเพิ่มเติม');
  const label = type === 'customer' ? 'ลูกค้ายกเลิกการจอง' : 'ยกเลิกสิทธิ์ · เครื่องพร้อมขาย';
  const detail = reason + (reason === 'อื่นๆ' ? (': ' + other) : '');
  const r = findRow_(id); const sh = sh_(SH.RES);
  assertReservationStatus_(r, [STATUS.PENDING, STATUS.WAIT, STATUS.ARR, STATUS.APPT], 'ยกเลิกรายการ');
  sh.getRange(r._row, 18).setValue(STATUS.CANCEL);
  touch_(sh, r._row, id);
  addNote_(id, label + ' · ' + detail, user_(), 'auto');
  SpreadsheetApp.flush();
  return true;
}

function cancelByCustomer(token, id, reason, other) {
  assertStaff_(token);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try { return cancelWithReason_(id, 'customer', reason, other); }
  finally { lock.releaseLock(); }
}

function releaseReservation(token, id, reason, other) {
  assertStaff_(token);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    return cancelWithReason_(id, 'release', reason || 'อื่นๆ', other || 'ไม่ระบุ');
  } finally { lock.releaseLock(); }
}

// รองรับปุ่มเดิมในหน้าเก่า โดยบันทึกเป็นการยกเลิกสิทธิ์
function cancelReservation(token, id, reason) { return releaseReservation(token, id, 'อื่นๆ', reason || 'ไม่ระบุ'); }

function markDone(token, id) {
  assertStaff_(token);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const r = findRow_(id); const sh = sh_(SH.RES);
    assertReservationStatus_(r, [STATUS.APPT], 'ปิดรายการเป็นรับของแล้ว');
    sh.getRange(r._row, 18).setValue(STATUS.DONE);
    touch_(sh, r._row, id);
    addNote_(id, 'รับสินค้าแล้ว · ปิดรายการ', user_(), 'auto');
    SpreadsheetApp.flush();
    return true;
  } finally { lock.releaseLock(); }
}

function markLabeled(token, id) {
  assertStaff_(token);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const r = findRow_(id); const sh = sh_(SH.RES);
    assertReservationStatus_(r, [STATUS.ARR, STATUS.APPT], 'บันทึกการพิมพ์ใบแปะ');
    if (r['แปะใบแล้ว']) return { changed: false };
    sh.getRange(r._row, 24).setValue(true);
    touch_(sh, r._row, id);
    addNote_(id, 'พิมพ์ใบแปะเครื่องแล้ว', user_(), 'auto');
    SpreadsheetApp.flush();
    return { changed: true };
  } finally { lock.releaseLock(); }
}

/** ตั้งรายการเป็นเคสเร่งด่วน พร้อมเหตุผล — บันทึกประวัติเป็นโน้ตชนิด urgent (แสดงสีแดง) */
function markUrgent(token, id, reason) {
  assertStaff_(token);
  const rsn = boundedText_(reason, 'เหตุผลของเคสเร่งด่วน', 500, true);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    ensureReservationColumns_();
    const r = findRow_(id); const sh = sh_(SH.RES);
    assertReservationStatus_(r, [STATUS.PENDING, STATUS.WAIT, STATUS.ARR, STATUS.APPT], 'ตั้งเป็นเคสเร่งด่วน');
    sh.getRange(r._row, 32).setValue(true);
    sh.getRange(r._row, 33).setValue(rsn);
    touch_(sh, r._row, id);
    addNote_(id, '⚠ ตั้งเป็นเคสเร่งด่วน · ' + rsn, user_(), 'urgent');
    SpreadsheetApp.flush();
    return true;
  } finally { lock.releaseLock(); }
}

/** ยกเลิกสถานะเคสเร่งด่วน */
function clearUrgent(token, id) {
  assertStaff_(token);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    ensureReservationColumns_();
    const r = findRow_(id); const sh = sh_(SH.RES);
    assertReservationStatus_(r, [STATUS.PENDING, STATUS.WAIT, STATUS.ARR, STATUS.APPT], 'ยกเลิกเคสเร่งด่วน');
    sh.getRange(r._row, 32).setValue(false);
    sh.getRange(r._row, 33).setValue('');
    touch_(sh, r._row, id);
    addNote_(id, 'ยกเลิกสถานะเคสเร่งด่วน', user_(), 'auto');
    SpreadsheetApp.flush();
    return true;
  } finally { lock.releaseLock(); }
}

/** บันทึกว่าพิมพ์ใบแปะแล้วหลายรายการในครั้งเดียว (อ่าน/เขียน/บันทึกโน้ตแบบรวบ) — เร็วกว่าเรียกทีละใบมาก */
function markLabeledBatch(token, ids) {
  assertStaff_(token);
  if (!Array.isArray(ids) || !ids.length) return { count: 0 };
  const seen = {};
  ids = ids.map(String).filter(function (id) { if (!id || seen[id]) return false; seen[id] = true; return true; });
  if (ids.length > 50) throw new Error('บันทึกการพิมพ์ได้สูงสุดครั้งละ 50 รายการ');
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const sh = sh_(SH.RES);
    const want = {}; ids.forEach(function (x) { want[String(x)] = true; });
    const targets = readAll_(SH.RES).filter(function (r) { return want[String(r['รหัสจอง'])]; });
    targets.forEach(function (r) { assertReservationStatus_(r, [STATUS.ARR, STATUS.APPT], 'บันทึกการพิมพ์ใบแปะ'); });
    const changed = targets.filter(function (r) { return !r['แปะใบแล้ว']; });
    changed.forEach(function (r) { sh.getRange(r._row, 24).setValue(true); });
    const count = changed.length, changedIds = changed.map(function (r) { return String(r['รหัสจอง']); });
    // บันทึกประวัติทุกใบด้วยการเขียนรวบครั้งเดียว (ไม่ appendRow ทีละแถว)
    const noteSh = sh_(SH.NOTE);
    const now = new Date(), who = user_();
    const noteRows = changedIds.map(function (id) { return [id, now, who, 'พิมพ์ใบแปะเครื่องแล้ว', 'auto']; });
    if (noteRows.length) noteSh.getRange(noteSh.getLastRow() + 1, 1, noteRows.length, HEAD[SH.NOTE].length).setValues(noteRows);
    ids.forEach(function (id) { invalidateReservationCache_(id); });
    invalidateListCache_();
    SpreadsheetApp.flush();
    return { count: count };
  } finally { lock.releaseLock(); }
}

function approveCustomerSignup(token, id, group, deposit, billNo, preOrder) {
  assertStaff_(token);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const r = findRow_(id); const sh = sh_(SH.RES);
    assertReservationStatus_(r, [STATUS.PENDING], 'ยืนยันเข้าคิว');
    const enabledGroups = orderedEnabledGroups_().map(function (item) { return String(item['ชื่อกลุ่ม']); });
    const approvedGroup = String(group || r['กลุ่มลูกค้า']);
    if (enabledGroups.indexOf(approvedGroup) === -1) throw new Error('กลุ่มลูกค้าไม่ได้เปิดใช้งาน กรุณารีเฟรชแล้วเลือกใหม่');
    preOrder = boundedText_(preOrder !== undefined ? preOrder : r['เลขPreOrder'], 'เลข Pre-Order', 120, false);
    if (approvedGroup === 'Pre-Order' && !preOrder) throw new Error('กรุณาระบุเลข Pre-Order ก่อนยืนยันเข้าคิว');
    if (approvedGroup !== 'Pre-Order') preOrder = '';
    const depositValue = Number(deposit || 0);
    if (!Number.isFinite(depositValue) || depositValue < 0 || depositValue > 10000000) throw new Error('ยอดมัดจำไม่ถูกต้อง');
    const depositEnabled = isEnabled_(cfg_('เก็บมัดจำ', 'true'));
    if (depositEnabled && depositValue) {
      billNo = boundedText_(billNo, 'เลขบิลมัดจำ', 120, true);
      assertBillNoUnique_(billNo, id, null);
    }
    sh.getRange(r._row, 5).setValue(approvedGroup);
    sh.getRange(r._row, 29).setValue(preOrder);
    if (depositEnabled && depositValue) {
      sh.getRange(r._row, 15).setValue(depositValue); sh.getRange(r._row, 16).setValue(billNo); sh.getRange(r._row, 17).setValue(new Date());
    }
    sh.getRange(r._row, 18).setValue(STATUS.WAIT);
    touch_(sh, r._row, id);
    addNote_(id, 'ตรวจสอบแล้ว เข้าคิวเป็น ' + approvedGroup, user_(), 'auto');
    SpreadsheetApp.flush();
    return true;
  } finally { lock.releaseLock(); }
}

/** จำนวนรายการที่ลูกค้ากรอกเองและยังรอการตรวจสอบ */
function getPendingApprovalCount(token) {
  assertStaff_(token);
  return readAll_(SH.RES).filter(function (r) { return r['สถานะ'] === STATUS.PENDING; }).length;
}

/**
 * อนุมัติรายการรอตรวจสอบทั้งหมดเข้าคิวรอสินค้า
 * อ่านสถานะซ้ำใต้ Lock เพื่อไม่เปลี่ยนรายการที่พนักงานคนอื่นดำเนินการไปแล้ว
 */
function approveAllPending(token) {
  assertStaff_(token);
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const pending = readAll_(SH.RES).filter(function (r) { return r['สถานะ'] === STATUS.PENDING; });
    if (!pending.length) return { count: 0 };
    const sh = sh_(SH.RES);
    const now = new Date(), who = user_();
    const groups = orderedEnabledGroups_();
    if (!groups.length) throw new Error('ไม่มีกลุ่มลูกค้าที่เปิดใช้งาน');
    const groupNames = groups.map(function (g) { return String(g['ชื่อกลุ่ม']); });
    const fallbackGroup = defaultGroupName_();
    const missingPreOrder = pending.filter(function (r) {
      const finalGroup = groupNames.indexOf(String(r['กลุ่มลูกค้า'])) > -1 ? String(r['กลุ่มลูกค้า']) : fallbackGroup;
      return finalGroup === 'Pre-Order' && !String(r['เลขPreOrder'] || '').trim();
    });
    if (missingPreOrder.length) throw new Error('มี ' + missingPreOrder.length + ' รายการที่เป็นกลุ่ม Pre-Order แต่ยังไม่มีเลข Pre-Order กรุณาตรวจสอบทีละรายการก่อน');
    pending.forEach(function (r) {
      if (groupNames.indexOf(String(r['กลุ่มลูกค้า'])) === -1) sh.getRange(r._row, 5).setValue(fallbackGroup);
    });
    sh.getRangeList(pending.map(function (r) { return 'R' + r._row; })).setValue(STATUS.WAIT);
    sh.getRangeList(pending.map(function (r) { return 'AA' + r._row; })).setValue(now);
    sh.getRangeList(pending.map(function (r) { return 'AB' + r._row; })).setValue(who);

    const noteRows = pending.map(function (r) {
      const group = groupNames.indexOf(String(r['กลุ่มลูกค้า'])) > -1 ? r['กลุ่มลูกค้า'] : fallbackGroup;
      return [r['รหัสจอง'], now, who, 'อนุมัติเข้าคิวทั้งหมด · เปลี่ยนเป็น รอสินค้า · กลุ่ม ' + group, 'auto'];
    });
    const noteSh = sh_(SH.NOTE);
    noteSh.getRange(noteSh.getLastRow() + 1, 1, noteRows.length, HEAD[SH.NOTE].length).setValues(noteRows);
    pending.forEach(function (r) { invalidateReservationCache_(r['รหัสจอง']); });
    invalidateListCache_();
    SpreadsheetApp.flush();
    return { count: pending.length };
  } finally { lock.releaseLock(); }
}

/* ============================================================
 * ล็อตของเข้า — ตัวนับกลางกันจ่ายเกินจำนวน (ใช้ร่วมกันทุกพนักงาน)
 * ==========================================================*/

/** สร้างชีตล็อตแบบ lazy ถ้ายังไม่มี เพื่อให้ใช้ได้โดยไม่ต้องรัน setup() ใหม่ */
function ensureLotSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SH.LOT);
  if (!sh) {
    sh = ss.insertSheet(SH.LOT);
    sh.getRange(1, 1, 1, HEAD[SH.LOT].length).setValues([HEAD[SH.LOT]]).setFontWeight('bold').setBackground('#262624').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  } else if (sh.getMaxColumns() < HEAD[SH.LOT].length) {
    sh.insertColumnsAfter(sh.getMaxColumns(), HEAD[SH.LOT].length - sh.getMaxColumns());
    sh.getRange(1, 1, 1, HEAD[SH.LOT].length).setValues([HEAD[SH.LOT]]).setFontWeight('bold');
  }
  return sh;
}
function lotKey_(supplier, model, capacity, color) {
  return [String(supplier || '').trim(), String(model || '').trim(), String(capacity || '').trim(), String(color || '').trim()].join('|');
}
function getLot_(key) {
  ensureLotSheet_();
  return readAll_(SH.LOT).filter(function (l) { return String(l['คีย์']) === key; })[0] || null;
}
function lotRemaining_(lot) {
  if (!lot) return null;
  return Math.max(0, (Number(lot['จำนวนเข้า']) || 0) - (Number(lot['จัดสรรแล้ว']) || 0));
}
function assertStockInput_(supplier, model, capacity, color, qty) {
  supplier = boundedText_(supplier, 'ซัพพลายเออร์', 120, true);
  model = boundedText_(model, 'รุ่นสินค้า', 120, true);
  capacity = boundedText_(capacity, 'ความจุ', 60, true);
  color = boundedText_(color, 'สี', 80, true);
  assertProductSelection_(model, capacity, color, enabledProductMap_());
  const enabledSuppliers = readAll_(SH.SUPPLY).filter(function (row) { return isEnabled_(row['เปิดใช้']); }).map(function (row) { return String(row['ชื่อซัพพลายเออร์']); });
  if (enabledSuppliers.indexOf(supplier) === -1) throw new Error('ซัพพลายเออร์ไม่ได้เปิดใช้งาน กรุณารีเฟรชแล้วเลือกใหม่');
  const quantity = Number(qty);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) throw new Error('จำนวนเครื่องต้องเป็นเลขจำนวนเต็ม 1–1,000');
  return { supplier: supplier, model: model, capacity: capacity, color: color, qty: quantity };
}
function reservationAcceptsStock_(reservation, supplier, model, capacity, color) {
  if (reservation['สถานะ'] !== STATUS.WAIT || reservation['รุ่น'] !== model) return false;
  if (reservation['ล็อกซัพ'] && supplier !== AIS_SUPPLIER) return false;
  if (reservation['ความจุ'] === capacity && reservation['สี'] === color) return true;
  return (reservation['ความจุ'] === capacity && exactList_(reservation['สีสำรอง']).indexOf(color) > -1) ||
    (reservation['สี'] === color && exactList_(reservation['ความจุสำรอง']).indexOf(capacity) > -1);
}
/**
 * ตั้ง/ปรับ "จำนวนเข้า" ของสเปกหนึ่ง โดยคงยอด "จัดสรรแล้ว" เดิมไว้เสมอ (สร้างใหม่ถ้ายังไม่มี)
 * เรียกใต้ ScriptLock เท่านั้น แล้วคืนสรุปยอดล่าสุดของกองกลาง
 */
/**
 * คืนยอดกองกลางปัจจุบันของสเปก — ถ้ายังไม่มีล็อต สร้างใหม่ด้วยจำนวนที่กรอก
 * ถ้ามีอยู่แล้ว "ไม่แตะ" จำนวนเข้า/จัดสรรแล้ว (กันการค้นหาซ้ำไป inflate ยอดข้ามพนักงาน)
 * การตั้งจำนวนใหม่/รีเซ็ตล็อตให้ใช้ resetStockLot แทน
 */
function ensureLotRemaining_(supplier, model, capacity, color, declaredQty) {
  const sh = ensureLotSheet_();
  const key = lotKey_(supplier, model, capacity, color);
  const lot = getLot_(key);
  if (lot) {
    return { key: key, declared: Number(lot['จำนวนเข้า']) || 0, allocated: Number(lot['จัดสรรแล้ว']) || 0, remaining: lotRemaining_(lot) };
  }
  const qty = Math.max(0, Number(declaredQty) || 0);
  sh.appendRow([key, model, capacity, color, supplier, qty, 0, new Date(), user_()]);
  SpreadsheetApp.flush();
  return { key: key, declared: qty, allocated: 0, remaining: qty };
}

/** ตั้งจำนวนใหม่ให้กองกลาง (ล็อตใหม่/ทดสอบ): จำนวนเข้า = qty, จัดสรรแล้ว = 0 */
function resetStockLot(token, supplier, model, capacity, color, qty) {
  assertStaff_(token);
  const input = assertStockInput_(supplier, model, capacity, color, qty);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const sh = ensureLotSheet_();
    const key = lotKey_(input.supplier, input.model, input.capacity, input.color);
    const q = input.qty;
    const lot = getLot_(key);
    if (lot) {
      sh.getRange(lot._row, 6).setValue(q);   // จำนวนเข้า
      sh.getRange(lot._row, 7).setValue(0);    // จัดสรรแล้ว = 0 (เริ่มล็อตใหม่)
      sh.getRange(lot._row, 8).setValue(new Date());
      sh.getRange(lot._row, 9).setValue(user_());
    } else {
      sh.appendRow([key, input.model, input.capacity, input.color, input.supplier, q, 0, new Date(), user_()]);
    }
    SpreadsheetApp.flush();
    return { key: key, declared: q, allocated: 0, remaining: q };
  } finally { lock.releaseLock(); }
}

/* ============================================================
 * หน้าจับคู่ของเข้า
 * ==========================================================*/

function matchStock(token, p) {
  assertStaff_(token);
  if (!p || typeof p !== 'object') throw new Error('ข้อมูลของเข้าไม่ถูกต้อง');
  const input = assertStockInput_(p.supplier, p.model, p.capacity, p.color, p.qty);
  const now = new Date();
  const model = input.model, capacity = input.capacity, color = input.color;
  const supplierIsAIS = input.supplier === AIS_SUPPLIER;
  if (p.group) {
    const enabledGroups = orderedEnabledGroups_().map(function (row) { return String(row['ชื่อกลุ่ม']); });
    if (enabledGroups.indexOf(String(p.group)) === -1) throw new Error('กลุ่มลูกค้าไม่ได้เปิดใช้งาน กรุณารีเฟรชแล้วเลือกใหม่');
  }
  const allWaiting = readAll_(SH.RES).filter(function (r) { return r['สถานะ'] === STATUS.WAIT; });
  let rows = allWaiting;
  if (p.group) rows = rows.filter(function (r) { return r['กลุ่มลูกค้า'] === p.group; });
  const beforeSupplierFilter = rows.length;
  if (!supplierIsAIS) rows = rows.filter(function (r) { return !r['ล็อกซัพ']; });
  const cutForSupplier = beforeSupplierFilter - rows.length;

  const exact = [], alt = [];
  rows.forEach(function (r) {
    const client = toClient_(r, now);
    if (r['รุ่น'] === model && r['ความจุ'] === capacity && r['สี'] === color && (!r['ล็อกซัพ'] || supplierIsAIS)) exact.push(client);
    else if (reservationAcceptsStock_(r, input.supplier, model, capacity, color)) {
      client.altReason = r['สี'] !== color ? ('อยากได้สี ' + r['สี']) : ('อยากได้ ' + r['ความจุ']);
      alt.push(client);
    }
  });
  const bySort = function (a, b) { return a.createdRaw - b.createdRaw; };
  exact.sort(bySort); alt.sort(bySort);

  // กองกลาง: ตั้ง/ปรับจำนวนของที่เข้าตามที่พนักงานกรอก แล้วคืน "เหลือจัดสรร" ที่ใช้ร่วมกันทุกเครื่อง
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  let lot;
  try { lot = ensureLotRemaining_(input.supplier, model, capacity, color, input.qty); }
  finally { lock.releaseLock(); }

  return {
    exact: exact, alt: alt,
    qty: lot.declared, remaining: lot.remaining, allocated: lot.allocated, lotKey: lot.key,
    totalBefore: allWaiting.length, cutForSupplier: cutForSupplier
  };
}

function allocateToCustomer(token, id, dueDate, lotKey) {
  assertStaff_(token);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    // ตรวจกองกลางก่อน: ถ้าของสเปกนี้ถูกจัดสรรครบแล้ว ห้ามจ่ายเกิน (กันพนักงานหลายคนจ่ายเกินจำนวน)
    if (!lotKey) throw new Error('ไม่พบล็อตของเข้า กรุณาค้นหาและเลือกใหม่');
    const lot = getLot_(String(lotKey));
    if (!lot) throw new Error('ไม่พบล็อตของเข้า กรุณาค้นหาและเลือกใหม่');
    if (lotRemaining_(lot) <= 0) {
      throw new Error('ของสเปกนี้ถูกจัดสรรครบจำนวนแล้ว (เข้า ' + (Number(lot['จำนวนเข้า']) || 0) + ' · จัดสรรแล้ว ' + (Number(lot['จัดสรรแล้ว']) || 0) + ') กรุณารีเฟรช');
    }
    const reservation = findRow_(id);
    if (!reservationAcceptsStock_(reservation, String(lot['ซัพ']), String(lot['รุ่น']), String(lot['ความจุ']), String(lot['สี']))) {
      throw new Error('รายการนี้ไม่ตรงกับสเปกของล็อตหรือถูกเปลี่ยนสถานะแล้ว กรุณารีเฟรชและจับคู่ใหม่');
    }
    // เปลี่ยนสถานะรายการ — มี CAS กันจัดสรรซ้ำรายการเดียวกันในตัว (โยน error ถ้าไม่ใช่ "รอสินค้า")
    markArrived_(id, dueDate);
    // หักกองกลางเฉพาะเมื่อเปลี่ยนสถานะสำเร็จ
    const sh = sh_(SH.LOT);
    sh.getRange(lot._row, 7).setValue((Number(lot['จัดสรรแล้ว']) || 0) + 1);
    sh.getRange(lot._row, 8).setValue(new Date());
    sh.getRange(lot._row, 9).setValue(user_());
    addNote_(id, 'จัดสรรจากหน้าจับคู่ของเข้า', user_(), 'auto');
    SpreadsheetApp.flush();
    return true;
  } finally { lock.releaseLock(); }
}

/* ============================================================
 * บริบทคิว (ตอบคำถามลูกค้า)
 * ==========================================================*/

/** ข้อมูลไทม์ไลน์/ระยะเวลารอ สำหรับแผงรายละเอียด (วันของเข้าดึงจากโน้ต) */
function getDurationInfo(token, id) {
  assertStaff_(token);
  const r = findRow_(id);
  const status = r['สถานะ'];
  const notes = readAll_(SH.NOTE).filter(function (n) { return n['รหัสจอง'] === id; });
  const arrNote = notes.filter(function (n) { return String(n['ข้อความ']).indexOf('เปลี่ยนเป็น ของมาแล้ว') > -1; });
  const created = r['วันเวลาที่จอง'] ? new Date(r['วันเวลาที่จอง']) : null;
  const arrived = arrNote.length ? new Date(arrNote[0]['วันเวลา']) : null;
  const hasArrived = status === STATUS.ARR || status === STATUS.APPT || status === STATUS.DONE;
  var totalWaitDays = null;
  if (created && arrived) totalWaitDays = daysBetween_(created, arrived);
  var aheadCount = null;
  if (!hasArrived && status !== STATUS.CANCEL) aheadCount = getQueueContext_(id).aheadCount;
  return {
    createdAt: fmtDate_(r['วันเวลาที่จอง']),
    arrivedAt: arrived ? fmtDate_(arrived) : '',
    appt: fmtDate_(r['วันนัดรับ']),
    dueDate: fmtDay_(r['วันครบกำหนดรับ']),
    hasArrived: hasArrived,
    totalWaitDays: totalWaitDays,
    aheadCount: aheadCount
  };
}

function getQueueContext_(id) {
  const r = findRow_(id);
  const all = readAll_(SH.RES);
  const notesById = {};
  readAll_(SH.NOTE).forEach(function (note) {
    const noteId = String(note['รหัสจอง'] || '');
    if (!notesById[noteId]) notesById[noteId] = [];
    notesById[noteId].push(note);
  });
  const sameSpec = all.filter(function (x) {
    return x['รุ่น'] === r['รุ่น'] && x['ความจุ'] === r['ความจุ'] && x['สี'] === r['สี'] &&
      (!!x['ล็อกซัพ']) === (!!r['ล็อกซัพ']);
  });
  const ahead = sameSpec.filter(function (x) {
    return x['สถานะ'] === STATUS.WAIT && new Date(x['วันเวลาที่จอง']) < new Date(r['วันเวลาที่จอง']);
  }).length;

  const arrivedSame = sameSpec.filter(function (x) { return x['สถานะ'] !== STATUS.WAIT && x['สถานะ'] !== STATUS.PENDING; });
  const waitDays = arrivedSame.map(function (x) {
    if (!x['วันเวลาที่จอง']) return null;
    const notes = (notesById[String(x['รหัสจอง'])] || []).filter(function (n) { return String(n['ข้อความ']).indexOf('เปลี่ยนเป็น ของมาแล้ว') > -1; });
    if (!notes.length) return null;
    return daysBetween_(new Date(x['วันเวลาที่จอง']), new Date(notes[0]['วันเวลา']));
  }).filter(function (d) { return d !== null && d >= 0; });
  const avgWait = waitDays.length ? Math.round(waitDays.reduce(function (a, b) { return a + b; }, 0) / waitDays.length) : null;

  return { aheadCount: ahead, avgWaitDays: avgWait, sampleSize: waitDays.length };
}

/* ============================================================
 * หน้าต้องตามด่วน
 * ==========================================================*/

function getFollowUpList(token) {
  assertStaff_(token);
  const now = new Date();
  const allRows = readAll_(SH.RES);
  // Refresh เบื้องหลังจะสร้าง Audit เมื่อรายการเลยวันครบกำหนดครั้งแรก
  syncAutoCancelAudits_(allRows, now);
  const rows = allRows.filter(function (r) { return r['สถานะ'] !== STATUS.DONE && r['สถานะ'] !== STATUS.CANCEL; });
  const waitLongDays = Number(cfg_('วันรอนาน', 14));
  const callThreshold = Number(cfg_('ครั้งโทรไม่ติดแล้วเตือน', 3)) || 3;

  const overdue = [], dueToday = [], pending = [], waitLong = [], noCall = [], manyFails = [];
  let heldNotDelivered = 0;

  rows.forEach(function (r) {
    const c = toClient_(r, now);
    // ใช้เกณฑ์เดียวกับหน้ารายชื่อ (workFocusKey_) เพื่อให้ตัวเลขตรงกันทั้งสองหน้า
    // overdue รวมทั้ง "ของมาแล้วเลยกำหนดรับ" และ "เลยกำหนดวันนัด"
    if (workFocusKey_(r, 'overdue', now, callThreshold)) overdue.push(c);
    if (workFocusKey_(r, 'today', now, callThreshold)) dueToday.push(c);
    if (workFocusKey_(r, 'noCall', now, callThreshold)) noCall.push(c);
    if (workFocusKey_(r, 'failed', now, callThreshold)) manyFails.push(c);
    if (workFocusKey_(r, 'pending', now, callThreshold)) pending.push(c);
    if (r['สถานะ'] === STATUS.ARR || r['สถานะ'] === STATUS.APPT) heldNotDelivered++;
    if (r['สถานะ'] === STATUS.WAIT && r['วันเวลาที่จอง'] && daysBetween_(new Date(r['วันเวลาที่จอง']), now) >= waitLongDays) waitLong.push(c);
  });
  [overdue, dueToday, pending, waitLong, noCall, manyFails].forEach(function (a) { a.sort(function (x, y) { return x.createdRaw - y.createdRaw; }); });

  return { overdue: overdue, dueToday: dueToday, soon: [], pending: pending, waitLong: waitLong, noCall: noCall, manyFails: manyFails, heldNotDelivered: heldNotDelivered, overdueCount: overdue.length };
}

/**
 * แก้ไขข้อมูลหลักของการจอง (รุ่น ความจุ สี ล็อกซัพ โครงการ มัดจำ เลขบิล)
 * ใช้กับปุ่มดินสอในหน้ารายละเอียด — บันทึกทุกการเปลี่ยนแปลงลงประวัติ
 */
function editReservation(token, id, patch) {
  assertStaff_(token);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (!patch || typeof patch !== 'object') throw new Error('ไม่พบข้อมูลที่ต้องการแก้ไข');
    const r = findRow_(id); const sh = sh_(SH.RES);
    assertReservationStatus_(r, [STATUS.PENDING, STATUS.WAIT, STATUS.ARR, STATUS.APPT], 'แก้ไขรายการ');
    // การปิดฟีเจอร์มีผลกับการสร้าง/แก้ไขข้อมูลใหม่ แต่ยังคงแสดงข้อมูลเดิมได้
    const enabledGroupNames = readAll_(SH.GROUP).filter(function (g) { return isEnabled_(g['เปิดใช้']); }).map(function (g) { return String(g['ชื่อกลุ่ม']); });
    if (patch.group !== undefined && enabledGroupNames.indexOf(String(patch.group)) === -1) throw new Error('กลุ่มลูกค้าไม่ได้เปิดใช้งาน กรุณารีเฟรชแล้วเลือกใหม่');
    ['model', 'capacity', 'color'].forEach(function (key) {
      if (patch[key] !== undefined) patch[key] = boundedText_(patch[key], { model: 'รุ่นสินค้า', capacity: 'ความจุ', color: 'สี' }[key], { model: 120, capacity: 60, color: 80 }[key], true);
    });
    assertProductSelection_(patch.model !== undefined ? patch.model : String(r['รุ่น']), patch.capacity !== undefined ? patch.capacity : String(r['ความจุ']), patch.color !== undefined ? patch.color : String(r['สี']), enabledProductMap_());
    if (enabledGroupNames.indexOf('Pre-Order') === -1) delete patch.preOrder;
    if (enabledGroupNames.indexOf('Pre-Booking') === -1) delete patch.preBooking;
    if (patch.preOrder !== undefined) patch.preOrder = boundedText_(patch.preOrder, 'เลข Pre-Order', 120, false);
    if (patch.preBooking !== undefined) patch.preBooking = boundedText_(patch.preBooking, 'เลข Pre-Booking', 120, false);
    const depositEnabled = isEnabled_(cfg_('เก็บมัดจำ', 'true'));
    const supplierLockEnabled = isEnabled_(cfg_('ล็อกซัพ', 'true'));
    if (!depositEnabled) { delete patch.deposit; delete patch.billNo; }
    else {
      if (patch.deposit !== undefined) {
        patch.deposit = Number(patch.deposit || 0);
        if (!Number.isFinite(patch.deposit) || patch.deposit < 0 || patch.deposit > 10000000) throw new Error('ยอดมัดจำไม่ถูกต้อง');
      }
      if (patch.billNo !== undefined) patch.billNo = boundedText_(patch.billNo, 'เลขบิลมัดจำ', 120, false);
      const resultingDeposit = patch.deposit !== undefined ? patch.deposit : Number(r['มัดจำ']) || 0;
      if (!resultingDeposit) patch.billNo = '';
      else if (!(patch.billNo !== undefined ? patch.billNo : String(r['เลขบิลมัดจำ'] || ''))) throw new Error('กรุณาระบุเลขบิลมัดจำ');
    }
    if (!supplierLockEnabled) { delete patch.supplierLock; delete patch.promo; delete patch.preBooking; }
    else if (patch.promo !== undefined) {
      patch.promo = boundedText_(patch.promo, 'ชื่อโครงการ', 120, false);
      const enabledPromos = readAll_(SH.PROMO).filter(function (item) { return isEnabled_(item['เปิดใช้']); }).map(function (item) { return String(item['ชื่อโครงการ']); });
      if (patch.promo && enabledPromos.indexOf(patch.promo) === -1) throw new Error('โครงการ AIS ไม่ได้เปิดใช้งาน กรุณารีเฟรชแล้วเลือกใหม่');
    }
    const resultingGroup = patch.group !== undefined ? String(patch.group) : String(r['กลุ่มลูกค้า']);
    if (resultingGroup === 'Pre-Order') {
      const resultingPreOrder = patch.preOrder !== undefined ? patch.preOrder : String(r['เลขPreOrder'] || '').trim();
      if (!resultingPreOrder) throw new Error('กรุณาระบุเลข Pre-Order');
    } else {
      // เลขอ้างอิงเก่ายังคงอยู่ในประวัติ แต่ไม่ควรค้างในข้อมูลหลักเมื่อออกจากกลุ่ม Pre-Order
      patch.preOrder = '';
    }
    // เลขบิลมัดจำห้ามซ้ำข้ามชุดการจอง แต่ใช้ร่วมกันภายในชุดเดียวกันได้
    if (patch.billNo !== undefined && String(patch.billNo) !== String(r['เลขบิลมัดจำ'])) {
      assertBillNoUnique_(patch.billNo, id, null, r['รหัสชุดการจอง']);
    }
    // โปรโมชัน = โปรแกรม AIS → บังคับล็อกซัพเป็น AIS ให้สอดคล้อง (ฟอร์มแก้ไขไม่มีช่องซัพ จึงเซ็ตอัตโนมัติ)
    const resultingPromo = supplierLockEnabled ? (patch.promo !== undefined ? patch.promo : r['โครงการ']) : '';
    const resultingPreBooking = supplierLockEnabled ? (patch.preBooking !== undefined ? patch.preBooking : r['เลขPreBooking']) : '';
    if (supplierLockEnabled && (resultingPromo || resultingPreBooking)) patch.supplierLock = true;
    const changes = [];
    function set(col, key, label) {
      if (patch[key] !== undefined && String(patch[key]) !== String(r[HEAD[SH.RES][col - 1]])) {
        changes.push(label + ': ' + (r[HEAD[SH.RES][col - 1]] || '-') + ' → ' + (patch[key] || '-'));
        sh.getRange(r._row, col).setValue(patch[key]);
      }
    }
    set(7, 'model', 'รุ่น'); set(8, 'capacity', 'ความจุ'); set(9, 'color', 'สี');
    set(6, 'preBooking', 'เลข Pre-Booking'); set(29, 'preOrder', 'เลข Pre-Order'); set(14, 'promo', 'โครงการ');
    set(15, 'deposit', 'มัดจำ'); set(16, 'billNo', 'เลขบิล'); set(5, 'group', 'กลุ่มลูกค้า');
    if (supplierLockEnabled && patch.supplierLock !== undefined && !!patch.supplierLock !== !!r['ล็อกซัพ']) {
      changes.push('ล็อกซัพ: ' + (r['ล็อกซัพ'] ? 'ใช่' : 'ไม่') + ' → ' + (patch.supplierLock ? 'ใช่' : 'ไม่'));
      sh.getRange(r._row, 12).setValue(!!patch.supplierLock);
    }
    if (supplierLockEnabled && (patch.supplierLock !== undefined || patch.promo !== undefined)) {
      const resultingLock = !!(patch.supplierLock !== undefined ? patch.supplierLock : r['ล็อกซัพ']) || !!resultingPromo || !!resultingPreBooking;
      const supplier = resultingLock ? AIS_SUPPLIER : '';
      if (String(r['ซัพที่ระบุ'] || '') !== supplier) {
        changes.push('ซัพที่ระบุ: ' + (r['ซัพที่ระบุ'] || '-') + ' → ' + (supplier || '-'));
        sh.getRange(r._row, 13).setValue(supplier);
      }
    }
    if (changes.length) {
      touch_(sh, r._row, id);
      addNote_(id, 'แก้ไขข้อมูล: ' + changes.join(' · '), user_(), 'auto');
      SpreadsheetApp.flush();
    }
    return { changed: changes.length > 0 };
  } finally { lock.releaseLock(); }
}

/**
 * เปลี่ยนวันครบกำหนดรับใหม่ (ต่างจาก markArrived ตรงที่บันทึกว่าเป็นการเปลี่ยน)
 */
function changeDueDate(token, id, dueDate) {
  assertStaff_(token);
  const lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    const r = findRow_(id); const sh = sh_(SH.RES);
    assertReservationStatus_(r, [STATUS.ARR, STATUS.APPT], 'เปลี่ยนวันครบกำหนดรับ');
    const next = new Date(dueDate);
    if (isNaN(next.getTime())) throw new Error('วันครบกำหนดรับไม่ถูกต้อง');
    const old = r['วันครบกำหนดรับ'] ? fmtDay_(new Date(r['วันครบกำหนดรับ'])) : '-';
    sh.getRange(r._row, 20).setValue(next);
    touch_(sh, r._row, id);
    addNote_(id, 'เปลี่ยนวันครบกำหนด: ' + old + ' → ' + fmtDay_(next), user_(), 'auto');
    SpreadsheetApp.flush();
    return true;
  } finally { lock.releaseLock(); }
}

/**
 * เปิดแก้ไขรายการที่ปิดแล้ว — บันทึกประวัติว่าใครเปิดแก้
 */
function unlockClosedRecord_(id) {
  throw new Error('รายการที่ปิดแล้วไม่สามารถแก้ไขได้');
}

/**
 * ดึงข้อมูลสำหรับพิมพ์ใบแปะเครื่อง / ใบจองสินค้า
 * คืน URL สำหรับสร้าง QR (หน้าเช็กสถานะลูกค้า) และสตริงบาร์โค้ด (รหัสจอง)
 */
function printWebUrl_() {
  // ใช้ getUrl() แล้วบังคับเป็น /exec เสมอ (บาง deployment คืน /dev ที่ลูกค้าเปิดไม่ได้)
  return String(ScriptApp.getService().getUrl()).replace(/\/dev$/, '/exec');
}
function buildPrintData_(r, webUrl, options) {
  options = options || { showCustomerGroup: isEnabled_(cfg_('แสดงกลุ่มลูกค้าในข้อมูลสำหรับลูกค้า', 'false')) };
  const checkUrl = webUrl + '?page=check&t=' + r['โทเคน'];
  return {
    id: r['รหัสจอง'], name: r['ชื่อลูกค้า'], phone: String(r['เบอร์โทร'] || ''),
    maskedName: maskName_(r['ชื่อลูกค้า']), maskedPhone: maskPhone_(r['เบอร์โทร']),
    group: String(r['กลุ่มลูกค้า'] || '').trim() || 'ไม่ระบุกลุ่ม', model: r['รุ่น'], capacity: r['ความจุ'], color: r['สี'],
    price: reservationPrice_(r),
    supplierLock: !!r['ล็อกซัพ'], promo: r['โครงการ'], preBooking: r['เลขPreBooking'], preOrder: r['เลขPreOrder'] || '', additionalNote: r['ข้อมูลเพิ่มเติม'] || '',
    deposit: Number(r['มัดจำ']) || 0, billNo: r['เลขบิลมัดจำ'],
    appt: fmtDate_(r['วันนัดรับ']), dueDate: fmtDay_(r['วันครบกำหนดรับ']),
    checkUrl: checkUrl, storeName: STORE_NAME, showCustomerGroup: !!options.showCustomerGroup
  };
}
function getPrintData(token, id) {
  assertStaff_(token);
  const options = { showCustomerGroup: isEnabled_(cfg_('แสดงกลุ่มลูกค้าในข้อมูลสำหรับลูกค้า', 'false')) };
  return buildPrintData_(findRow_(id), printWebUrl_(), options);
}
/** ดึงข้อมูลพิมพ์หลายรายการในครั้งเดียว (อ่านชีตรอบเดียว) — ใช้พิมพ์ใบแปะแบบ batch ให้เร็ว */
function getPrintDataBatch(token, ids) {
  assertStaff_(token);
  if (!Array.isArray(ids)) throw new Error('รายการสำหรับพิมพ์ไม่ถูกต้อง');
  const uniqueIds = [], want = {};
  ids.forEach(function (x) {
    const id = String(x || '').trim().slice(0, 120);
    if (id && !want[id]) { want[id] = true; uniqueIds.push(id); }
  });
  if (uniqueIds.length > 50) throw new Error('พิมพ์ได้สูงสุดครั้งละ 50 รายการ');
  const web = printWebUrl_();
  const options = { showCustomerGroup: isEnabled_(cfg_('แสดงกลุ่มลูกค้าในข้อมูลสำหรับลูกค้า', 'false')) };
  const byId = {};
  readAll_(SH.RES).forEach(function (r) { if (want[String(r['รหัสจอง'])]) byId[String(r['รหัสจอง'])] = r; });
  return uniqueIds.map(function (id) { return byId[id] ? buildPrintData_(byId[id], web, options) : null; }).filter(Boolean);
}

/* ============================================================
 * ลูกค้ากรอกเอง — Signup.html
 * ==========================================================*/

function getSignupBootstrap() {
  if (!isInstalled()) throw new Error('ระบบยังไม่ได้ติดตั้ง กรุณาติดต่อพนักงาน');
  const b = getBootstrap_(false);
  const a = Math.floor(Math.random() * 30) + 10;
  const bnum = Math.floor(Math.random() * 20) + 5;
  const sid = Utilities.getUuid();
  CacheService.getScriptCache().put('captcha_' + sid, String(a + bnum), 600);
  return {
    products: b.products,
    promos: b.promos,
    defaultGroup: b.defaultGroup,
    supplierLockEnabled: b.supplierLockEnabled,
    aisThaiOnly: b.aisThaiOnly,
    alternativeOptionsEnabled: b.alternativeOptionsEnabled,
    captcha: { a: a, b: bnum, sid: sid }
  };
}

/** รายการที่ยังอยู่ระหว่างดำเนินการของเบอร์โทร — ไม่รวมรายการปิดหรือยกเลิก */
function signupActiveReservations_(phone) {
  const active = {};
  [STATUS.PENDING, STATUS.WAIT, STATUS.ARR, STATUS.APPT].forEach(function (status) { active[status] = true; });
  return readAll_(SH.RES).filter(function (row) {
    return normPhone_(row['เบอร์โทร']) === phone && !!active[String(row['สถานะ'] || '')];
  });
}

/** ตรวจว่ามีอย่างน้อยหนึ่งสเปกซ้ำกับรายการที่ยังดำเนินการอยู่หรือไม่ */
function hasExactActiveSignupDuplicate_(phone, devices, reservationRows) {
  if (!Array.isArray(devices) || !devices.length) return false;
  const wanted = {};
  devices.forEach(function (device) {
    if (!device || typeof device !== 'object') return;
    const model = String(device.model || '').trim();
    const capacity = String(device.capacity || '').trim();
    const color = String(device.color || '').trim();
    if (model && capacity && color) wanted[model + '\u0001' + capacity + '\u0001' + color] = true;
  });
  if (!Object.keys(wanted).length) return false;
  const active = {};
  [STATUS.PENDING, STATUS.WAIT, STATUS.ARR, STATUS.APPT].forEach(function (status) { active[status] = true; });
  const rows = Array.isArray(reservationRows) ? reservationRows : signupActiveReservations_(phone);
  return rows.some(function (row) {
    if (normPhone_(row['เบอร์โทร']) !== phone || !active[String(row['สถานะ'] || '')]) return false;
    return !!wanted[String(row['รุ่น'] || '').trim() + '\u0001' + String(row['ความจุ'] || '').trim() + '\u0001' + String(row['สี'] || '').trim()];
  });
}

/**
 * ตรวจเบอร์แบบไม่เปิดเผยข้อมูลส่วนบุคคลสำหรับหน้า Signup
 * ผูกกับ CAPTCHA session และจำกัดจำนวนครั้ง เพื่อลดการไล่สุ่มตรวจฐานลูกค้า
 */
function checkSignupPhone(captchaSid, rawPhone) {
  const cache = CacheService.getScriptCache();
  const sid = String(captchaSid || '').trim().slice(0, 80);
  if (!sid || !cache.get('captcha_' + sid)) return { state: 'unavailable' };
  const countKey = 'signup_phone_checks_' + sid;
  const count = Number(cache.get(countKey) || 0);
  if (count >= 20) return { state: 'unavailable' };
  cache.put(countKey, String(count + 1), 600);
  const phone = normPhone_(rawPhone);
  if (phone.length < 9 || phone.length > 15) return { state: 'invalid' };
  const hasCustomer = !!lookupCustomer_(phone);
  const hasActive = signupActiveReservations_(phone).length > 0;
  // คืนเพียงสถานะกว้าง ๆ ไม่คืนชื่อ ช่องทางติดต่อ สินค้า รหัสจอง หรือจำนวนรายการ
  return { state: hasActive ? 'active' : (hasCustomer ? 'known' : 'new') };
}

function submitSignup(p) {
  if (!p || typeof p !== 'object') throw new Error('ข้อมูลลงทะเบียนไม่ถูกต้อง');
  const cache = CacheService.getScriptCache();
  const captchaSid = String(p.captchaSid || '').trim().slice(0, 80);
  const captchaKey = 'captcha_' + captchaSid;
  const expected = captchaSid ? cache.get(captchaKey) : null;
  // คำตอบผิดให้ใช้ SID นี้ไม่ได้อีก ป้องกันการเดาคำตอบซ้ำ
  if (!expected || String(p.captchaAnswer) !== expected) {
    if (captchaSid) cache.remove(captchaKey);
    throw new Error('คำตอบไม่ถูกต้อง กรุณาลองใหม่');
  }
  p.source = 'customer';
  // ใช้กลุ่มเริ่มต้นชุดเดียวกับหน้าพนักงาน เพื่อให้การจัดคิวสอดคล้องกันทั้งระบบ
  p.group = defaultGroupName_();
  const phone = normPhone_(p.phone);
  if (phone.length < 9 || phone.length > 15) throw new Error('เบอร์โทรไม่ถูกต้อง');
  const rateKey = 'signup_rate_' + phone;
  if (phone && cache.get(rateKey)) throw new Error('เพิ่งส่งรายการจากเบอร์นี้ กรุณารอสักครู่ก่อนส่งอีกครั้ง');
  // ตรวจซ้ำฝั่งเซิร์ฟเวอร์เสมอ หน้าจออย่างเดียวไม่ถือเป็นแหล่งข้อมูลที่เชื่อถือได้
  if (hasExactActiveSignupDuplicate_(phone, p.devices) && p.confirmDuplicate !== true) {
    throw new Error('DUPLICATE_CONFIRM_REQUIRED');
  }
  // ผ่านทุกเงื่อนไขก่อนจึงใช้ CAPTCHA ครั้งเดียว เพื่อให้ลูกค้ายืนยันเครื่องเพิ่มได้โดยไม่ต้องตอบใหม่
  if (captchaSid) cache.remove(captchaKey);
  const result = saveReservation_(p);
  if (phone) cache.put(rateKey, '1', 30);
  return result;
}

/* ============================================================
 * ตรวจสอบสถานะโดยลูกค้า — Check.html (ปิดบังข้อมูล + ยืนยันตัวตน)
 * ==========================================================*/

function maskName_(name) {
  const parts = String(name || '').trim().split(/\s+/);
  if (parts.length < 2) {
    const only = parts[0] || '';
    return only.length > 3 ? (only.slice(0, 3) + 'XXXXX') : only;
  }
  const last = parts[parts.length - 1];
  const first = parts.slice(0, parts.length - 1).join(' ');
  const maskedLast = last.length > 3 ? (last.slice(0, 3) + 'XXXXX') : (last.charAt(0) + 'XXXX');
  return first + ' ' + maskedLast;
}
function maskPhone_(phone) {
  const p = String(phone || '').replace(/\D/g, '');
  if (p.length < 7) return p;
  return p.slice(0, 3) + Array(Math.max(1, p.length - 5) + 1).join('X') + p.slice(-2);
}

function checkByToken(token) {
  token = String(token || '').trim().slice(0, 120);
  if (!token) throw new Error('ไม่พบข้อมูลการจอง');
  const r = readAll_(SH.RES).filter(function (x) { return x['โทเคน'] === token; })[0];
  if (!r) throw new Error('ไม่พบข้อมูลการจอง');
  return {
    id: r['รหัสจอง'], maskedName: maskName_(r['ชื่อลูกค้า']), maskedPhone: maskPhone_(r['เบอร์โทร']),
    model: r['รุ่น'], capacity: r['ความจุ'], color: r['สี'], status: r['สถานะ'],
    price: reservationPrice_(r), showCustomerGroup: isEnabled_(cfg_('แสดงกลุ่มลูกค้าในข้อมูลสำหรับลูกค้า', 'false'))
  };
}

function verifyAndReveal(token, phone) {
  token = String(token || '').trim().slice(0, 120);
  if (!token) throw new Error('ไม่พบข้อมูลการจอง');
  const cache = CacheService.getScriptCache();
  const failKey = 'fail_' + token, lockKey = 'lock_' + token;
  const MAX_FAILS = 5, LOCK_SEC = 180;   // ล็อก 3 นาทีหลังผิดครบ 5 ครั้ง
  const now = Date.now();
  const verifyLock = LockService.getScriptLock(); verifyLock.waitLock(5000);
  try {

    // ถ้ากำลังถูกล็อกอยู่ → คืนเวลาที่เหลือ
    const lockUntil = Number(cache.get(lockKey) || 0);
    if (lockUntil > now) {
      return { ok: false, locked: true, remaining: 0, lockedSec: Math.ceil((lockUntil - now) / 1000) };
    }

    const r = readAll_(SH.RES).filter(function (x) { return x['โทเคน'] === token; })[0];
    if (!r) throw new Error('ไม่พบข้อมูลการจอง');

    if (normPhone_(phone) !== normPhone_(r['เบอร์โทร'])) {
      const fails = Number(cache.get(failKey) || 0) + 1;
      addNote_(r['รหัสจอง'], 'ลูกค้าพยายามยืนยันตัวตนแต่เบอร์ไม่ตรง', 'ระบบ', 'auto');
      SpreadsheetApp.flush();
      if (fails >= MAX_FAILS) {
        cache.put(lockKey, String(now + LOCK_SEC * 1000), LOCK_SEC);
        cache.remove(failKey);
        return { ok: false, locked: true, remaining: 0, lockedSec: LOCK_SEC };
      }
      cache.put(failKey, String(fails), LOCK_SEC * 2);
      return { ok: false, locked: false, remaining: MAX_FAILS - fails, lockedSec: 0 };
    }

    cache.remove(failKey); cache.remove(lockKey);
    const client = toClient_(r);
    client.price = reservationPrice_(r);
    client.showCustomerGroup = isEnabled_(cfg_('แสดงกลุ่มลูกค้าในข้อมูลสำหรับลูกค้า', 'false'));
    if (!client.showCustomerGroup) client.group = '';
    const ctx = getQueueContext_(r['รหัสจอง']);
    client.aheadCount = ctx.aheadCount;
    client.avgWaitDays = ctx.avgWaitDays;
    return { ok: true, data: client };
  } finally { verifyLock.releaseLock(); }
}
