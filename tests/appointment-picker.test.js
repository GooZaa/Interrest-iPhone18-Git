const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadPicker() {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/appointment-picker.js'), 'utf8'), {
    window, Date, Intl
  });
  return window.AppointmentPicker;
}

function mountPicker() {
  const window = {};
  const root = { innerHTML: '', contains: () => true };
  const document = { getElementById: () => root };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/appointment-picker.js'), 'utf8'), {
    window, document, Date, Intl
  });
  return { picker: window.AppointmentPicker, root };
}

function loadApi(client) {
  const window = { supabaseClient: client, location: { href: 'https://example.test/staff', origin: 'https://example.test' } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/api.js'), 'utf8'), {
    window, Date, Intl, console, setTimeout, clearTimeout
  });
  return window.api;
}

test('appointment slots run from 11:00 to 20:00 every 30 minutes', () => {
  const picker = loadPicker();
  assert.equal(picker.slots.length, 19);
  assert.equal(picker.slots[0], '11:00');
  assert.equal(picker.slots.at(-1), '20:00');
  assert.equal(picker.toIso('2030-09-24T13:30'), '2030-09-24T06:30:00.000Z');
  for (const time of ['10:30', '13:15', '20:30']) assert.equal(picker.toIso(`2030-09-24T${time}`), '');
  assert.equal(picker.toIso('2030-02-30T13:00'), '');
  assert.equal(picker.isFuture('2030-09-24T13:00', new Date('2030-09-24T06:31:00Z')), false);
  assert.equal(picker.addDays('2030-09-30', 3), '2030-10-03');
});

test('picker renders Thai calendar, selects date and half-hour time', () => {
  const { picker, root } = mountPicker();
  const control = picker.mount('picker');
  assert.match(root.innerHTML, /เลือกวันนัดรับ/);
  assert.match(root.innerHTML, /11:00–20:00 น./);
  const date = picker.addDays(picker.todayKey(), 3);
  root.onclick({ target: { closest: () => ({ dataset: { apQuick: date }, disabled: false }) } });
  root.onclick({ target: { closest: () => ({ dataset: { apTime: '13:30' }, disabled: false }) } });
  assert.equal(control.getValue(), `${date}T13:30`);
  assert.equal(control.getIso(), picker.toIso(`${date}T13:30`));
  assert.match(root.innerHTML, /13:30 น./);
});

test('single appointment due date follows Bangkok calendar day, not UTC day', async () => {
  let saved;
  const client = { from(table) {
    if (table === 'system_configs') return { select() { return this; }, eq() { return this; }, single: async () => ({ data: { value: '3' } }) };
    if (table === 'notes') return { insert: async () => ({ error: null }) };
    assert.equal(table, 'reservations');
    return {
      select() { return this; },
      single: async () => ({ data: { status: 'ของมาแล้ว', appointment_at: null, reschedule_count: 0 } }),
      update(value) { saved = value; return this; },
      eq() { return saved ? Promise.resolve({ error: null }) : this; }
    };
  } };
  const picker = loadPicker();
  const result = await loadApi(client).setAppointment('R2030-1', picker.toIso('2030-09-24T11:00'));
  assert.equal(saved.appointment_at, '2030-09-24T04:00:00.000Z');
  assert.equal(saved.due_date, '2030-09-27');
  assert.equal(result.dueDate, '27/09/2030');
});

test('single appointment rejects out-of-hours time before writing', async () => {
  const client = { from() { throw new Error('Database must not be called'); } };
  await assert.rejects(loadApi(client).setAppointment('R2030-1', '2030-09-24T03:30:00Z'), /11:00–20:00/);
});

test('bulk appointment rejects out-of-hours time before RPC', async () => {
  const client = { from() { throw new Error('Database must not be called'); } };
  await assert.rejects(loadApi(client).performBatchAction({
    requestId: '12345678-1234-4123-8123-123456789abc', action: 'appointment', ids: ['R2030-1'],
    payload: { appointment_at: '2030-09-24T13:15:00+07:00' }
  }), /11:00–20:00/);
});
