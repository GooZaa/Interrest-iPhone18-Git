const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadApi(client) {
  const window = { supabaseClient: client, location: { href: 'https://example.test/staff', origin: 'https://example.test' } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/api.js'), 'utf8'), {
    window, Date, Intl, console, setTimeout, clearTimeout
  });
  return window.api;
}

test('bulk workspace pages past the first 500 reservations', async () => {
  const calls = [];
  const rows = Array.from({ length: 501 }, (_, i) => ({
    id: `R${i}`, phone: `080000${String(i).padStart(4, '0')}`,
    customer_name: `Customer ${i}`, customer_group: 'Walk-in',
    model: 'iPhone 18 Pro', capacity: '256GB', color: 'Black',
    status: 'รอสินค้า', source: 'staff', booked_at: '2026-09-20T00:00:00Z'
  }));
  const client = { from(table) {
    assert.equal(table, 'reservations');
    return {
      select() { return this; },
      order() { return this; },
      range(start, end) {
        calls.push([start, end]);
        return Promise.resolve({ data: rows.slice(start, end + 1), error: null });
      }
    };
  } };

  const result = await loadApi(client).getBulkWorkspace();
  assert.equal(result.items.length, 501);
  assert.equal(result.items.at(-1).id, 'R500');
  assert.deepEqual(calls, [[0, 499], [500, 999]]);
});

test('confirmed intentional duplicates carry acknowledgement to the database', async () => {
  let inserted;
  const client = { from(table) {
    if (table === 'customers') return { upsert: async () => ({ error: null }) };
    if (table === 'notes') return { insert: async () => ({ error: null }) };
    assert.equal(table, 'reservations');
    return {
      select() { return this; },
      eq() { return this; },
      in() { return this; },
      order() { return Promise.resolve({ data: [], error: null }); },
      then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); },
      insert(rows) { inserted = rows; return Promise.resolve({ error: null }); }
    };
  } };
  const api = loadApi(client);
  const result = await api.submitSignup({
    name: 'Test User', phone: '0812345675',
    submissionId: '12345678-1234-4123-8123-123456789abc',
    confirmDuplicate: true,
    devices: [{ model: 'iPhone 18 Pro', capacity: '256GB', color: 'Black' }]
  });
  assert.equal(result.ok, true);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].duplicate_confirmed, true);
});

test('an unconfirmed existing device still requests customer review', async () => {
  let inserted = false;
  const client = { from(table) {
    assert.equal(table, 'reservations');
    return {
      select() { return this; },
      eq() { return this; },
      in() { return Promise.resolve({ data: [{ model: 'iPhone 18 Pro', capacity: '256GB', color: 'Black' }], error: null }); },
      order() { return Promise.resolve({ data: [], error: null }); },
      insert() { inserted = true; return Promise.resolve({ error: null }); }
    };
  } };
  await assert.rejects(loadApi(client).submitSignup({
    name: 'Test User', phone: '0812345675',
    submissionId: '12345678-1234-4123-8123-123456789abc',
    devices: [{ model: 'iPhone 18 Pro', capacity: '256GB', color: 'Black' }]
  }), /DUPLICATE_CONFIRM_REQUIRED/);
  assert.equal(inserted, false);
});

test('signup remains usable before the duplicate guard column is deployed', async () => {
  const insertAttempts = [];
  const client = { from(table) {
    if (table === 'customers') return { upsert: async () => ({ error: null }) };
    if (table === 'notes') return { insert: async () => ({ error: null }) };
    assert.equal(table, 'reservations');
    return {
      select() { return this; },
      eq() { return this; },
      in() { return Promise.resolve({ data: [], error: null }); },
      order() { return Promise.resolve({ data: [], error: null }); },
      insert(rows) {
        insertAttempts.push(rows);
        return Promise.resolve(insertAttempts.length === 1
          ? { error: { message: 'column reservations.duplicate_confirmed does not exist' } }
          : { error: null });
      }
    };
  } };
  const result = await loadApi(client).submitSignup({
    name: 'Test User', phone: '0812345675',
    submissionId: '12345678-1234-4123-8123-123456789abc',
    devices: [{ model: 'iPhone 18 Pro', capacity: '256GB', color: 'Black' }]
  });
  assert.equal(result.ok, true);
  assert.equal(insertAttempts.length, 2);
  assert.equal(insertAttempts[0][0].duplicate_confirmed, false);
  assert.equal('duplicate_confirmed' in insertAttempts[1][0], false);
});

test('bulk appointment uses shared picker and call inputs remain populated', () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/bulk-manager.js'), 'utf8')
    .replace(/\}\)\(\);\s*$/, ';window.__bulkTest={BM,formHtml};})();');
  const window = {};
  const document = { getElementById() { return null; } };
  vm.runInNewContext(source, { window, document, crypto: { randomUUID: () => 'test' } });
  const { BM, formHtml } = window.__bulkTest;
  BM.action = 'appointment';
  BM.payload = { _input: '2026-09-20T14:30' };
  assert.match(formHtml(), /id="bm-appt-picker"/);
  assert.equal(BM.payload._input, '2026-09-20T14:30');
  BM.action = 'call';
  BM.payload = { call_result: 'no_answer', note: 'โทรอีกครั้งช่วงบ่าย' };
  assert.match(formHtml(), /value="no_answer" selected/);
  assert.match(formHtml(), /โทรอีกครั้งช่วงบ่าย/);
});
