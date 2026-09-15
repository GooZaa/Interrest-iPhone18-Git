# HANDOFF — ระบบติดตามคิวจอง iPhone

> เอกสารส่งต่องานฉบับหลัก (Source of Truth สำหรับผู้รับช่วง)  
> อ้างอิงไฟล์ใน Workspace ณ วันที่ 14 กันยายน 2026  
> โฟลเดอร์: `/Users/goozaa/Documents/ระบบจองคิว iPhone`  
> Apps Script ID: `1bjdYAKVkYBy2Cz-U_0IuWhwSaVDGJEXtyqoCaYC3rCkVqRxl_RWVFRVj`

### สถานะ Source และ Deployment ล่าสุด

- วันที่ 12 กันยายน 2026 เวลา 16:58 น. อัปโหลด source สำเร็จ 16 ไฟล์ด้วย `npx @google/clasp push --force`
- Version `82`: `เพิ่มสถานะกำลังบันทึก Signup และเลือกพิมพ์ A6/Thermal หลังบันทึก`
- ตรวจวันที่ 14 กันยายน 2026: production deployment หลักอยู่ที่ `@83` แต่ version 83 ไม่มีคำอธิบาย
- Production deployment ID: `AKfycbxF_FV6PRLYDcbro9YOuhdC8jsDAY6g2esQJpo9nMoEqNGNEx9SkC_Bcl3spILuUd2C`
- Production URL: `https://script.google.com/macros/s/AKfycbxF_FV6PRLYDcbro9YOuhdC8jsDAY6g2esQJpo9nMoEqNGNEx9SkC_Bcl3spILuUd2C/exec`
- `@HEAD` deployment ID: `AKfycbw3_Bk40VEB8bRXYulcID-cAwEo5jS139Q0ART0UmQ`
- ยังไม่ได้ดึง version 83 มา diff กับ Workspace ในการเขียนเอกสารครั้งนี้ ผู้รับช่วงต้องตรวจความตรงกันก่อนแก้/อัปโหลดครั้งถัดไป
- ต้องตั้ง Script Property `LOCATION_CODE` ผ่านเมนู Google Sheets ก่อนทดสอบหน้า Staff

## 1. อ่านก่อนเริ่มงาน

ระบบนี้เป็น Google Apps Script Web App ที่ใช้ Google Sheets เป็นฐานข้อมูล มีหน้าสำหรับพนักงาน ลูกค้าลงทะเบียนความสนใจ ลูกค้าตรวจสอบคิว งานพิมพ์หลายรายการ และรายงาน

กติกาสำคัญ:

1. ตรวจโค้ดจริงก่อนเชื่อเอกสารเสมอ เพราะ Apps Script source, deployment version และ URL ที่ใช้งานจริงอาจไม่ตรงกัน
2. ห้ามสลับ/ลบคอลัมน์ในชีต `การจอง` โดยไม่ตรวจ `HEAD`, `toClient_()` และทุก `getRange(row, column)`
3. ห้ามเรียก `setup()` บนไฟล์จริงโดยไม่สำรองข้อมูล เพราะฟังก์ชันปรับ schema และลบคอลัมน์ที่เกินจาก `HEAD`
4. การอัปโหลดเป็น external write ต้องได้รับคำสั่งชัดเจนจากผู้ใช้ก่อนทุกครั้ง
5. `clasp push` อัปโหลด source แต่ไม่รับประกันว่า Web App URL แบบ versioned deployment จะเปลี่ยนตาม ต้องตรวจ Manage deployments
6. โฟลเดอร์นี้ไม่มี Git history ให้สำรอง source/Spreadsheet ก่อนแก้โครงสร้างหรือกฎธุรกิจขนาดใหญ่
7. ห้ามนำ Location Code กลับไป hard-code ใน source
8. หน้า Report ต้องเป็น read-only; การแก้รายการให้เปิด workflow เดิมจากหน้ารายละเอียด

## 2. ภาพรวมระบบ

### 2.1 เทคโนโลยี

- Backend: Google Apps Script V8
- Database: Google Sheets ที่ผูกกับ Apps Script
- Frontend: HTML, CSS, Vanilla JavaScript
- Client/server bridge: `google.script.run`
- Session พนักงาน: HMAC token อายุ 8 ชั่วโมง
- Local sync: `.clasp.json` + `clasp`
- Time zone: `Asia/Bangkok` ทั้ง `Code.gs` และ `appsscript.json`
- QR/Barcode: สร้างใน browser จากโค้ดที่ฝังในโปรเจกต์

### 2.2 Routes

| URL | หน้า | ไฟล์หลัก |
|---|---|---|
| ไม่ระบุ `page` | Welcome | `Welcome.html` |
| `?page=staff` | ระบบพนักงาน | `Index.html` |
| `?page=signup` | ลูกค้าลงทะเบียนความสนใจ | `Signup.html` |
| `?page=check&t=<token>` | ลูกค้าตรวจสอบสถานะ | `Check.html` |

`doGet(e)` อยู่ใน `Code.gs` และส่งค่าที่จำเป็นเข้า HTML template โดยตรง

### 2.3 Data flow

```text
Browser
  -> google.script.run
  -> public server API ตรวจ token/validate input
  -> private helper อ่าน/เขียน Google Sheets
  -> ScriptLock ป้องกันงานเขียนชนกัน
  -> CacheService ลดการอ่านซ้ำ
  -> ชีต “โน้ต” เก็บ audit trail
```

## 3. โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `Code.gs` | Routing, setup, auth, CRUD, state machine, stock allocation, customer signup/check และ API งานพิมพ์เดี่ยว |
| `Code.Deposit.gs` | กฎยอดมัดจำรวม การแบ่งยอดราย Order และ backward compatibility สำหรับหน้าจอเก่า |
| `Code.BatchPrint.gs` | Backend งานพิมพ์หลายรายการ, validation, print job และ audit แบบ idempotent |
| `Code.Report.gs` | Backend รายงานแบบ read-only และ product analytics |
| `Index.html` | Shell ระบบพนักงาน, navigation, รายชื่อ, จองใหม่, ของเข้า, ตามด่วน, ตั้งค่า และ CSS หลัก |
| `Index.DetailActions.html` | Event handlers และ modal ของหน้ารายละเอียด |
| `Index.Print.html` | Template เอกสารเดี่ยว, QR/Barcode, A4/A6/Thermal และหน้าพิมพ์ |
| `Index.BatchPrint.html` | UI เลือก/กรอง/จัดหน้า/พิมพ์หลายรายการ |
| `Index.Report.html` | Markup + scoped CSS ของหน้า Report |
| `Index.Report.Script.html` | State, render และ events ของ Report |
| `Signup.html` | แบบฟอร์มลูกค้า 5 ภาษา + CAPTCHA |
| `Check.html` | เช็กสถานะผ่าน QR, PDPA masking และยืนยันเบอร์โทร |
| `Welcome.html` | หน้าเริ่มต้นและเลือกภาษา |
| `QR.Core.html` | QR generator แบบ local ใช้ร่วมกัน ไม่เรียก CDN ภายนอก |
| `appsscript.json` | Manifest: V8, Asia/Bangkok, Web App |
| `.clasp.json` | Apps Script project ID |
| `HANDOFF.md` | เอกสารฉบับนี้ |
| `HANDOFF2.md` | เอกสารรุ่นเก่า ใช้อ้างอิงประวัติเท่านั้น ไม่ใช่ source of truth |

## 4. โครงสร้าง Google Sheets

ชื่อชีตและหัวคอลัมน์กำหนดใน `SH` และ `HEAD` ของ `Code.gs`

### 4.1 `ลูกค้า` — 7 คอลัมน์

1. เบอร์โทร
2. ชื่อ-นามสกุล
3. ช่องทางติดต่อ
4. ไอดี/อีเมล
5. ภาษา
6. กลุ่มลูกค้า
7. วันที่บันทึกครั้งแรก

### 4.2 `การจอง` — 35 คอลัมน์

| # | คอลัมน์ | ใช้งานหลัก |
|---:|---|---|
| 1 | รหัสจอง | `RYYMMDD-1234` |
| 2 | โทเคน | QR ตรวจสอบสถานะ |
| 3 | เบอร์โทร | เก็บเป็นข้อความ |
| 4 | ชื่อลูกค้า |  |
| 5 | กลุ่มลูกค้า |  |
| 6 | เลขPreBooking |  |
| 7 | รุ่น |  |
| 8 | ความจุ |  |
| 9 | สี |  |
| 10 | สีสำรอง | comma-separated |
| 11 | ความจุสำรอง | comma-separated |
| 12 | ล็อกซัพ | Boolean |
| 13 | ซัพที่ระบุ | AIS เมื่อถูกกฎล็อก |
| 14 | โครงการ | โปรโมชั่น/โครงการ AIS |
| 15 | มัดจำ | Number |
| 16 | เลขบิลมัดจำ | หนึ่งชุดหลาย Order ใช้เลขเดียวกันได้ภายใน batch เดียว แต่ห้ามชนกับ batch อื่น |
| 17 | วันที่รับมัดจำ | Date |
| 18 | สถานะ | สถานะจริง |
| 19 | วันเวลาที่จอง | ใช้ FIFO/รายงาน |
| 20 | วันครบกำหนดรับ | Date |
| 21 | วันนัดรับ | DateTime |
| 22 | จำนวนครั้งที่เลื่อน | Number |
| 23 | พนักงานที่รับเรื่อง |  |
| 24 | แปะใบแล้ว | Boolean |
| 25 | ที่มา | `staff` / `customer` |
| 26 | จำนวนครั้งที่โทร | Number |
| 27 | อัปเดตล่าสุด | DateTime |
| 28 | ผู้แก้ไขล่าสุด |  |
| 29 | เลขPreOrder |  |
| 30 | ข้อมูลเพิ่มเติม |  |
| 31 | วันที่โทรล่าสุด | DateTime |
| 32 | เร่งด่วน | Boolean |
| 33 | เหตุผลเร่งด่วน |  |
| 34 | ราคาขณะจอง | Snapshot ราคาจาก server ณ เวลาสร้าง Order |
| 35 | รหัสชุดการจอง | UUID เชื่อม Order ที่สร้างพร้อมกัน ใช้ตรวจบิลมัดจำร่วมชุด |

ห้ามเปลี่ยนลำดับคอลัมน์นี้โดยไม่ตรวจโค้ดทุกจุด

### 4.3 `โน้ต` — Audit trail

1. รหัสจอง
2. วันเวลา
3. ผู้เขียน
4. ข้อความ
5. ที่มา (`auto` / `manual`)

### 4.4 ชีตตั้งค่า

- `รุ่นสินค้า`: รุ่น, ความจุ, สี, เปิดรับจอง, ราคา
- `กลุ่มลูกค้า`: ชื่อกลุ่ม, เปิดใช้, สีป้าย, ต้องกรอกเลขอ้างอิง, ค่าเริ่มต้น, ลำดับแสดงผล
- `ซัพพลายเออร์`: ชื่อซัพพลายเออร์, เปิดใช้
- `โครงการส่วนลด`: ชื่อโครงการ, คำอธิบาย, เปิดใช้
- `พนักงาน`: ชื่อ, อีเมล (ยังไม่ใช่ RBAC เต็มรูปแบบ)
- `ค่าระบบ`: คีย์, ค่า, คำอธิบาย

ค่าระบบที่โค้ดรู้จัก:

- `เก็บมัดจำ`
- `ล็อกซัพ`
- `เปิดใช้ตัวเลือกเครื่องทางเลือก`
- `วันครบกำหนดเริ่มต้น`
- `วันครบกำหนดหลังนัด`
- `วันรอนาน`
- `ครั้งโทรไม่ติดแล้วเตือน`
- `โครงการ AIS เฉพาะภาษาไทย`
- `แสดงกลุ่มลูกค้าในข้อมูลสำหรับลูกค้า`
- `แสดง QR ลงทะเบียนหน้า Welcome`

รูปแบบราคาในชีต `รุ่นสินค้า` เป็น mapping ตามความจุ เช่น `256GB:40900,512GB:48900` หน้า Staff/Signup ใช้ราคาเพื่อแสดงผล แต่ตอนบันทึก `saveReservation_()` จะอ่านราคาใหม่จาก server เท่านั้นและเก็บ snapshot ใน `ราคาขณะจอง` เพื่อป้องกัน client ดัดแปลงราคา

### 4.5 `ล็อตของเข้า`

คอลัมน์: คีย์, รุ่น, ความจุ, สี, ซัพ, จำนวนเข้า, จัดสรรแล้ว, อัปเดตล่าสุด, ผู้อัปเดต

`lotKey_()` สร้างคีย์จาก supplier + model + capacity + color ห้ามเปลี่ยนรูปแบบโดยไม่ทำ migration

## 5. Authentication และ Security

### 5.1 Location Code

- เก็บใน Script Property ชื่อ `LOCATION_CODE`
- ตั้งค่าจาก Google Sheets menu: `ระบบคิวจอง > ตั้งรหัส Location`
- ต้องเป็นตัวเลข 4–12 หลัก
- ไม่มี default code ใน source
- กรอกผิดครบ 5 ครั้งล็อก 180 วินาที (3 นาที)
- เมื่อล็อกอินสำเร็จ ระบบล้าง failure counter
- token พนักงานมีอายุ 8 ชั่วโมงและเซ็นด้วย HMAC secret ใน Script Properties

หลังอัปโหลด source ที่เอา hard-code ออก ต้องตั้ง `LOCATION_CODE` ก่อนทดสอบหน้า staff มิฉะนั้นล็อกอินไม่ได้

### 5.2 ขอบเขต API

- API ของพนักงานต้องเรียก `assertStaff_(token)` ก่อนอ่าน/เขียนข้อมูล
- ฟังก์ชัน setup/seed/migration/set Location ใช้ `assertEditorExecution_()` และต้องรันโดย editor จาก Sheets/Apps Script
- Helper ภายในใช้ชื่อท้าย `_` เพื่อลดพื้นผิว public API
- Customer signup/check เปิด anonymous ตามหน้าที่ แต่มี validation/rate limit และไม่คืนข้อมูลเต็มก่อนยืนยันตัวตน
- `appsscript.json` ยังใช้ `ANYONE_ANONYMOUS` เพราะหน้า signup/check เป็น public; ต้องรักษา server authorization ทุก endpoint

### 5.3 Customer verification

- CAPTCHA ใช้ครั้งเดียว ไม่ว่าตอบถูกหรือผิด
- ตรวจ token length ก่อนค้นหา
- ยืนยันเบอร์ผิดครบ 5 ครั้งล็อก 3 นาที
- ก่อนยืนยัน แสดงชื่อ/เบอร์แบบ masking
- การยืนยันผิดถูกบันทึกลง Audit note

## 6. State machine และกฎธุรกิจ

สถานะจริง:

```text
รอตรวจสอบ -> รอสินค้า -> ของมาแล้ว -> นัดรับแล้ว -> รับของแล้ว
                                \             \
                                  -> ยกเลิก <-
```

กฎสำคัญ:

- ลูกค้าส่งแบบฟอร์มเองเริ่มที่ `รอตรวจสอบ`
- พนักงานอนุมัติจึงเป็น `รอสินค้า`
- ปุ่มเข้าคิวทั้งหมดอนุมัติเฉพาะรายการ `รอตรวจสอบ` และต้องยืนยันผ่าน popup
- นัดรับได้จาก `ของมาแล้ว` หรือแก้วันนัดของ `นัดรับแล้ว`
- เวลา appointment ต้องไม่ย้อนหลังและอยู่ในช่วง 11:00–20:00 น.
- ปิดการขายได้เฉพาะ `นัดรับแล้ว`
- การโทรติดตามใช้กับ `นัดรับแล้ว`
- การยกเลิก/เร่งด่วน/แก้ไขข้อมูลถูกจำกัดตามสถานะที่ backend
- รายการปิดแล้วไม่ควรปลดล็อกผ่าน public API
- `นัดรับวันนี้` และ `เลยกำหนดวันนัด` เป็น display status ที่คำนวณ ไม่ใช่สถานะใหม่ในชีต

Validation การจอง:

- เบอร์โทรต้องเป็นตัวเลข 9–15 หลักหลัง normalize
- จำนวนเครื่องต่อรายการไม่เกิน 10
- รุ่น/ความจุ/สีต้องตรงกับสินค้าที่เปิดใช้จริง
- กลุ่ม/feature ที่ปิดใช้ต้องถูก reject หรือ sanitize ใน backend ไม่ใช่ซ่อนเฉพาะ UI
- ลูกค้ากรอกเองถูกบังคับ `source=customer` และใช้กลุ่มเริ่มต้นที่เปิดใช้
- เงินมัดจำต้องเป็นเลข finite ตั้งแต่ 0 ถึง 10,000,000
- ถ้ามัดจำมากกว่า 0 ต้องมีเลขบิล และเลขบิลต้องไม่ซ้ำตามกฎระบบ
- การจองหลายเครื่องถือยอดมัดจำที่กรอกเป็นยอดรวมของบิล ระบบแบ่งลงแต่ละ Order อัตโนมัติหรือรับยอดที่พนักงานปรับเอง โดยผลรวมต้องเท่ากับยอดบิล
- Order ที่สร้างพร้อมกันมี `รหัสชุดการจอง` เดียวกัน จึงใช้เลขบิลเดียวกันได้โดยไม่ถูกตีความว่าแต่ละ Order ได้รับยอดรวมซ้ำ
- กลุ่ม `Pre-Order` ต้องมี `เลขPreOrder` ทั้งตอนสร้าง แก้ไข และอนุมัติรายการลูกค้า; เมื่อเปลี่ยนออกจากกลุ่มต้องล้างค่าในข้อมูลหลัก
- Pre-Booking/โปรโมชั่น AIS ต้องสัมพันธ์กับ supplier lock และ AIS

การตรวจเบอร์ใน Signup:

- ตรวจเบอร์แบบ debounce ระหว่างกรอก โดยไม่หยุด flow ลูกค้า
- แสดงว่าเป็นเบอร์ใหม่, ลูกค้าเดิม หรือมีรายการกำลังดำเนินการ
- หากเบอร์เดียวกันมีรุ่น+ความจุ+สีเดียวกันที่ยัง active ต้องยืนยันว่าเป็นเครื่องเพิ่มก่อนบันทึก
- Backend ตรวจ duplicate ซ้ำอีกครั้งภายใต้ `ScriptLock`; ห้ามพึ่ง UI อย่างเดียว

## 7. การจับคู่ของเข้า

- FIFO อ้างอิง `วันเวลาที่จอง`
- จัดสรร exact spec ได้
- ทางเลือกยอมให้เปลี่ยนเพียงหนึ่งมิติ: ความจุเดิม + สีสำรอง หรือสีเดิม + ความจุสำรอง
- ห้ามเปลี่ยนทั้งสีและความจุพร้อมกัน
- ตรวจ supplier lock ทุกครั้ง
- จำนวนล็อตต้องเป็นจำนวนเต็ม 1–1,000
- ก่อน allocate ระบบตรวจ lot key, spec, supplier และจำนวนคงเหลือใหม่ภายใต้ ScriptLock
- ห้ามเชื่อ declared quantity หรือ lot key จาก client

## 8. List, Detail, Settings และ Concurrency

- `listReservations()` allowlist สถานะ/focus, จำกัดข้อความค้นหาและ limit สูงสุด 500
- Client ใช้ request sequence ทิ้ง response เก่าที่ตอบกลับช้า ป้องกันข้อมูลเดิมทับตัวกรองล่าสุด
- Queue context ทำ index โน้ตรอบเดียว ลด N+1 reads
- งานเขียนสำคัญใช้ ScriptLock และ `SpreadsheetApp.flush()` ก่อนปล่อย lock
- หน้าตั้งค่าใช้ optimistic concurrency โดยส่ง snapshot `before`; ถ้าข้อมูลถูกแก้จากที่อื่นต้องแจ้ง stale write
- Batch settings ตรวจทุก operation ก่อนเขียนจริง เพื่อลด partial update

กฎกลุ่มลูกค้า:

- ชื่อห้ามว่างและห้ามซ้ำแบบ case-insensitive
- ต้องมีอย่างน้อยหนึ่งกลุ่มเปิดใช้
- ต้องมีกลุ่มเริ่มต้นหนึ่งกลุ่มเท่านั้น และกลุ่มนั้นต้องเปิดใช้
- สีต้องเป็น hex ที่อนุญาต
- ลำดับเป็นจำนวนเต็ม 1–999

## 9. ระบบพิมพ์

### 9.1 เอกสารเดี่ยว

- ใบแปะเครื่องและใบจองสินค้า
- A4/A6 ตามชนิดเอกสาร และ Thermal 80 mm
- QR + Code39 barcode สร้างจาก template เดียวกับ batch print
- ระบบถามยืนยันหลังพิมพ์จริงก่อนบันทึก Audit/`แปะใบแล้ว`
- หลังพนักงานบันทึกการจอง ระบบให้เลือก `A6` หรือ `Thermal 80mm` ก่อน แล้วจึงเปิดตัวอย่างพิมพ์
- ปุ่ม `เลือกใหม่` ในตัวอย่างหลังบันทึกย้อนกลับไปยังตัวเลือก A6/Thermal ไม่พาไปเลือกใบแปะเครื่อง

### 9.2 พิมพ์หลายรายการ

- Server จำกัดสูงสุด 50 รายการต่องาน; candidate list จำกัด 300 รายการ
- เลือกใบแปะ, ใบจอง หรือครบชุด
- กรองคำค้น กลุ่ม สถานะ รุ่น ความจุ สี ช่วงวันนัด ประวัติเคยพิมพ์ และ AIS
- เลือกสะสมข้ามตัวกรองได้
- `prepareBatchPrintJob()` ตรวจสถานะซ้ำก่อนพิมพ์
- `confirmBatchPrintJob()` ใช้ UUID job และ idempotent marker ป้องกัน audit ซ้ำ
- metadata สำรองอยู่ใน Script Properties 12 ชั่วโมง

A4:

- Scale 100/95/90%, จัดจากมุมกระดาษ, มี crop marks และคำนวณความสูงจริงทีละแถว
- ใบแปะทั่วไปประมาณ 4 รายการ/A4, ใบจองทั่วไปประมาณ 3 รายการ/A4, ครบชุดประมาณ 2 ออเดอร์/A4
- จำนวนจริงอาจลดเมื่อเนื้อหายาว

Thermal 80 mm:

- หนึ่งเอกสารต่อหนึ่ง page break และมีเส้นตัดสำรอง
- Browser ไม่สามารถรับประกันคำสั่ง ESC/POS cutter
- Epson TM-T88V ต้องเปิด `Page Cut` / `Cut each page` ใน driver จึงจะตัดตาม page break
- ใต้ QR ไม่พิมพ์เบอร์โทรซ้ำ เพราะมีเบอร์เต็มด้านบนอยู่แล้ว

ข้อความเตือนปัจจุบัน:

> เอกสารมีข้อมูลส่วนบุคคล กรุณาแม็กติดกับใบออเดอร์ เก็บรักษาให้ปลอดภัย และห้ามทิ้งโดยเด็ดขาด

QR หน้า Welcome:

- เปิด/ปิดด้วยค่าระบบ `แสดง QR ลงทะเบียนหน้า Welcome`
- QR ชี้ไปที่ production URL เดิมพร้อม `?page=signup`; การอัปเดต version บน deployment ID เดิมไม่ทำให้ QR เปลี่ยน
- สร้างด้วย `QR.Core.html`; อย่า inject source ของ library เป็นข้อความใน HTML template เพราะเคยทำให้เกิด `Malformed HTML content`

## 10. รายงาน

ไฟล์ Report แยกจาก workflow หลัก: `Code.Report.gs`, `Index.Report.html`, `Index.Report.Script.html`

API `reportGetDashboard()` และ `reportGetDetails()` ตรวจ `assertStaff_()` และไม่มีคำสั่งเขียนชีต

มุมมองหลัก: ภาพรวม, งานที่ต้องจัดการ, สินค้า และวิเคราะห์รุ่น/ความจุ/สี

ตัวกรอง: กลุ่ม, รุ่น, วันเริ่มต้น/สิ้นสุด และ preset วันนี้/7 วัน/เดือนนี้/เดือนก่อน โดยช่วงสูงสุด 92 วันแบบ inclusive

ตัวกรองรายงานถูกจำไว้ใน browser `localStorage` (`queue_report_filter_v1`) จึงอาจเปิดกลับมาแล้วเห็นเดือนเก่า ไม่ใช่ความผิดพลาดของเวลาระบบ กด `เดือนนี้` หรือ `คืนค่าเริ่มต้น` เพื่อกลับเป็นวันที่ 1 ของเดือนปัจจุบันถึงวันนี้

นิยาม Metric:

- ความต้องการ/คอลัมน์ `ต้องการ`: จำนวนคิวใหม่ที่ `วันเวลาที่จอง` อยู่ในช่วง ไม่ใช่ยอดค้างรอปัจจุบัน
- ขายดีที่สุด: `รับของแล้ว` และวันที่อัปเดตล่าสุดอยู่ในช่วง
- ยกเลิก: `ยกเลิก` และวันที่อัปเดตล่าสุดอยู่ในช่วง
- ค้างรอ: `รอตรวจสอบ` + `รอสินค้า` ณ ปัจจุบัน ไม่จำกัดช่วงวันที่
- จัดสรรแล้ว: `ของมาแล้ว` + `นัดรับแล้ว` ณ ปัจจุบัน
- อัตราปิดสำเร็จ: รับของแล้ว / (รับของแล้ว + ยกเลิก)
- เวลารอเฉลี่ย: วันสร้างคิวถึง Audit note ที่เปลี่ยนเป็น `ของมาแล้ว`

Product Analytics มีสอง layout:

- `แยกตามรุ่น`: หนึ่งการ์ดต่อรุ่น ตัวเลขใหญ่คือ metric รวมของรุ่นนั้น, แสดงความจุอันดับ 1, สีอันดับ 1 และรายการคู่ความจุ+สีอันดับต้นภายในรุ่น
- `รวมทุกสเปก`: แสดงอันดับรุ่น/ความจุ/สี/สเปก, Top 8 และตารางรายละเอียดทุกสเปก

ข้อควรอ่าน: ความจุอันดับ 1 และสีอันดับ 1 เป็นผลรวมคนละมิติ อาจไม่ใช่คู่เดียวกัน ถ้าต้องการรู้ `รุ่น + ความจุ + สี` ที่ต้องการมากที่สุด ให้ดูรายการสเปกอันดับ 1 ภายในการ์ดหรือ `สเปกอันดับ 1` ในมุมมองรวม

กราฟปรับความละเอียดตามช่วง และหากมีกิจกรรมเพียง 1–2 วันจะแสดง summary card แทนกราฟว่างขนาดใหญ่

## 11. Cache, Lock และ Performance

- Bootstrap cache มี version ของตัวเอง
- List/Report ใช้ `CACHE_LIST_VERSION` สำหรับ invalidation
- Report cache 45 วินาที
- หน้า Report refresh background ทุก 60 วินาทีเฉพาะเมื่อเปิดแท็บ
- งานเขียน reservation/stock/settings ใช้ ScriptLock ตามความเสี่ยง
- รายการหลักยังไม่มี pagination จริง; มี server limit จึงต้องประเมินใหม่เมื่อข้อมูลโตมาก

## 12. สิ่งที่แก้ในรอบ 9–14 กันยายน 2026

- แก้ stale response ของตัวกรองสถานะ
- เพิ่มปุ่มอนุมัติรายการรอตรวจสอบทั้งหมดพร้อม popup
- เพิ่มเมนูพิมพ์หลายรายการและรองรับ A4/Thermal
- ปรับ layout A4, QR, barcode, crop marks และข้อความ PDPA จากผลพิมพ์จริง
- เพิ่ม Report แยกโมดูล พร้อมกราฟ, action dashboard และ Product Analytics
- เพิ่ม layout วิเคราะห์สินค้า `แยกตามรุ่น` / `รวมทุกสเปก` และนิยาม metric ที่อ่านได้ชัดขึ้น
- เพิ่ม validation วันที่และช่วง 92 วัน
- เพิ่ม state guards, stock integrity และ settings concurrency
- ย้าย Location Code ออกจาก sourceไป Script Properties
- จำกัด login ผิด 5 ครั้ง/ล็อก 3 นาที
- ปิด public helper ที่ไม่ควรเรียกจาก client
- แก้ setup/admin/signup/check validation และการ flush ก่อนปล่อย lock
- เพิ่มราคาแยกตามรุ่น+ความจุในหน้าตั้งค่า พร้อมแสดงใน Staff, Signup, Check และใบจอง
- เพิ่ม `ราคาขณะจอง` เพื่อรักษาราคาเดิมของ Order แม้แก้ราคาภายหลัง
- แก้มัดจำหลายเครื่องให้ยอดที่กรอกเป็นยอดรวมและแบ่งต่อ Order โดยใช้ `รหัสชุดการจอง`
- เพิ่มเลข Pre-Order แบบบังคับเมื่อเลือก/เปลี่ยนเป็นกลุ่ม Pre-Order
- เพิ่มสวิตช์เดียวสำหรับเปิด/ปิดกลุ่มลูกค้าในหน้าลูกค้าและใบจองทุกขนาด โดยไม่กระทบใบแปะ/Staff/Report
- เพิ่ม QR ลงทะเบียนหน้า Welcome พร้อมสวิตช์ตั้งค่า และวาง QR กึ่งกลางเหนือคำอธิบาย
- เพิ่มตรวจเบอร์ Signup แบบไม่ขัดจังหวะและยืนยัน exact-spec duplicate
- เพิ่ม popup `กำลังบันทึกข้อมูล` ใน Signup ป้องกันผู้ใช้คิดว่าหน้าค้างและกดซ้ำ
- หลัง Staff บันทึกสำเร็จ ให้เลือกใบจอง A6 หรือ Thermal 80mm และดูตัวอย่างก่อนพิมพ์

## 13. Known limitations / ความเสี่ยงคงเหลือ

1. ไม่มี Git repository และไม่มี local commit history
2. Google Sheets ไม่ใช่ฐานข้อมูล transaction เต็มรูปแบบ แม้ใช้ Lock/validation แล้ว
3. สิทธิ์ยังไม่ใช่ RBAC รายบุคคลเต็มรูปแบบ; Location Code เป็น shared credential
4. `ANYONE_ANONYMOUS` จำเป็นกับหน้าลูกค้า จึงต้องรักษา server authorization ทุก endpoint
5. `setup()` อาจลบคอลัมน์เกิน schema
6. Browser print ไม่สามารถบังคับ auto-cut ของ thermal ได้ ต้องพึ่ง driver
7. A4 packing ขึ้นกับฟอนต์/driver/margin ของเครื่องจริง
8. Report อ้างสถานะ/วันที่ในชีต หากแก้ชีตตรง ๆ ตัวเลขอาจไม่สอดคล้อง Audit note
9. Detail/queue history อาจหนักเมื่อชีตใหญ่มาก
10. `HANDOFF2.md` มีข้อมูลเก่าบางส่วน อย่าใช้แทนเอกสารนี้
11. Production อยู่ที่ version 83 ซึ่งไม่มี description และยังไม่ได้ diff กับ local Workspace ในรอบเขียนเอกสารนี้
12. Report จำ filter ใน `localStorage`; ผู้ใช้บางคนอาจเข้าใจว่าเดือนเก่าเป็น default ปัจจุบัน
13. รายการเก่าที่ไม่มี `ราคาขณะจอง` จะ fallback ไปใช้ราคาปัจจุบันจากตั้งค่า จึงไม่ใช่หลักฐานราคาย้อนหลังที่สมบูรณ์

## 14. Test checklist ก่อนปล่อยใช้งาน

Static/local:

- Parse `appsscript.json`
- Syntax checkโค้ด `.gs` หลังต่อไฟล์ใน scope เดียว
- Syntax check `<script>` ใน HTML ทุกไฟล์
- ตรวจ include target, static ID ซ้ำ, literal DOM references และ client/server API mapping
- ตรวจ staff guard ของ endpoint สำคัญ

Business/UI:

- Location Code ถูก/ผิด/ครบ 5 ครั้ง/ปลดล็อกหลัง 180 วินาที
- การจองผิดสเปก, จำนวน >10, มัดจำไม่มีบิล และเลขบิลซ้ำ
- หลายเครื่องหนึ่งบิล: แบ่งอัตโนมัติ, แก้ยอดราย Order, ผลรวมไม่ตรง, เศษหารไม่ลงตัว และห้ามชนบิลของ batch อื่น
- ราคาตามรุ่น+ความจุ, ราคาไม่ใช่ตัวเลข, snapshot ตอนจอง และ fallback ของรายการเก่า
- Signup ตรวจเบอร์ใหม่/ลูกค้าเดิม/มี active item และ exact-spec duplicate ทั้งยืนยัน/ย้อนกลับ
- AIS/PreBooking lock
- นัดย้อนหลัง, นอก 11:00–20:00 และ slot ชน
- state transition ทุกปุ่ม
- exact stock, alternate color/capacity, เปลี่ยนสองมิติ และ oversell
- กลุ่มซ้ำ/default/สี/ลำดับผิด
- Report วันที่ไม่จริง, from > to, เกิน 92 วัน และ unknown status
- Report จำช่วงเดือนเก่าหลัง reload, ปุ่มเดือนนี้/คืนค่าเริ่มต้น, ความต้องการตามช่วง และค้างรอแบบสถานะปัจจุบัน
- Product Analytics แยก 18 Pro/18 Pro Max, top capacity/color แบบแยกมิติ และ top exact spec
- Batch print เกิน 50, invalid IDs, retry confirm และสถานะเปลี่ยนก่อนพิมพ์
- Light/dark, desktop/mobile และสลับตัวกรองเร็ว ๆ
- Signup/Check ทุก 5 ภาษา
- สแกน QR/barcode จากกระดาษจริง
- Epson TM-T88V: 80 mm, Scale 100%, Page Cut/Cut each page

## 15. ขั้นตอน Deploy

1. สำรอง source และ Spreadsheet
2. ตรวจ static/business tests
3. อัปโหลด source ด้วย `npx @google/clasp push --force` หลังได้รับคำสั่งชัดเจนจากผู้ใช้
4. เปิด Spreadsheet แล้ว Reload ให้ `onOpen()` สร้างเมนู
5. ตั้ง Location Code ที่ `ระบบคิวจอง > ตั้งรหัส Location`
6. ถ้า schema ยังไม่ครบ ให้รัน `ติดตั้ง / ซ่อมโครงสร้างชีต` หลังสำรองเท่านั้น
7. เปิด Apps Script > Deploy > Manage deployments
8. Production หลักเป็น versioned deployment: สร้าง version ใหม่และอัปเดต deployment ID เดิม ห้ามสร้าง URL ใหม่โดยไม่จำเป็น เพราะ QR Welcome ผูกกับ URL นี้
9. ทดสอบ production URL ไม่ใช่เฉพาะ `/dev`

คำสั่งตัวอย่างหลังผู้ใช้อนุมัติ:

```bash
npx @google/clasp push --force
npx @google/clasp version "คำอธิบายการเปลี่ยนแปลง"
npx @google/clasp deploy -i AKfycbxF_FV6PRLYDcbro9YOuhdC8jsDAY6g2esQJpo9nMoEqNGNEx9SkC_Bcl3spILuUd2C -V VERSION_NUMBER -d "คำอธิบายการเปลี่ยนแปลง"
npx @google/clasp deployments
```

คำเตือน: source push สำเร็จไม่ได้แปลว่า production URL ใช้ source ล่าสุด

## 16. Definition of Done

- โค้ดผ่าน syntax/static checks และกฎ backend ที่เกี่ยวข้อง
- ไม่มี endpoint พนักงานใหม่ที่ขาด `assertStaff_()`
- UI รองรับ light/dark และ error state
- งานเขียนมี validation/lock/flush ตามความเสี่ยง
- พิมพ์จริงสแกน QR/Barcode ได้
- Report ระบุนิยาม metric และไม่สรุปเกินข้อมูล
- source ถูก push หลังได้รับอนุมัติ
- versioned deployment ถูกอัปเดตหากจำเป็น
- Handoff และผลทดสอบถูกอัปเดต

## 17. Prompt สำหรับเริ่มแชตใหม่

```text
ช่วยทำงานต่อในโปรเจกต์ Google Apps Script ระบบติดตามคิวจอง iPhone ที่
/Users/goozaa/Documents/ระบบจองคิว iPhone

ก่อนแก้ไขให้อ่าน HANDOFF.md ทั้งไฟล์ แล้วตรวจไฟล์จริงด้วย rg --files และค้นหา HEAD/SH/public APIs ใหม่ อย่าเชื่อ HANDOFF2.md แทน source ปัจจุบัน ห้ามเปลี่ยนลำดับคอลัมน์ชีตการจอง 35 คอลัมน์โดยไม่ตรวจทุกจุด ห้าม hard-code Location Code และห้ามอัปโหลดหรือแก้ deployment จนกว่าฉันจะอนุมัติชัดเจน

Production deployment หลักที่ตรวจล่าสุดคือ @83 แต่ไม่มีคำอธิบายและยังไม่ได้ diff กับ local ในรอบเขียนเอกสารนี้ ให้ตรวจความตรงกันก่อนเริ่มงาน หลังแก้ให้ตรวจ syntax ของ .gs และ script ใน HTML, include/ID/API mapping, auth guards และ business rules ที่เกี่ยวข้อง พร้อมแจ้งแยกให้ชัดว่าแก้ source, push แล้วหรือยัง และ production deployment อัปเดตแล้วหรือยัง
```
