/*************************************************************
 * เงินมัดจำหลายรายการ
 * - ยอดที่กรอกในหน้าจองเป็นยอดรวมของบิล
 * - กระจายเป็นยอดของแต่ละ Order และตรวจยอดซ้ำฝั่ง Server
 *************************************************************/

function splitDepositAmount_(total, count) {
  const amount = Number(total || 0), size = Number(count || 0);
  if (!Number.isInteger(amount) || amount < 0 || amount > 10000000) throw new Error('ยอดมัดจำรวมไม่ถูกต้อง');
  if (!Number.isInteger(size) || size < 1 || size > MAX_RESERVATION_DEVICES) throw new Error('จำนวนรายการสำหรับแบ่งมัดจำไม่ถูกต้อง');
  const base = Math.floor(amount / size), remainder = amount % size;
  return Array.from({ length: size }, function (_, i) { return base + (i < remainder ? 1 : 0); });
}

/**
 * ตรวจและเขียนแผนมัดจำกลับเข้า devices
 * รองรับหน้าจอรุ่นเก่าด้วย: ถ้าหลายเครื่องส่งยอด/บิลเดียวกันมา จะถือเป็นยอดรวมและแบ่งใหม่
 */
function applyDepositPlan_(p, depositEnabled) {
  const devices = p.devices || [], count = devices.length;
  if (!depositEnabled) {
    devices.forEach(function (d) { d.deposit = 0; d.billNo = ''; });
    return { total: 0, billNo: '', allocations: splitDepositAmount_(0, count) };
  }

  const hasNewPlan = p.depositTotal !== undefined || p.billNo !== undefined || Array.isArray(p.depositAllocations);
  let total, billNo, allocations;
  if (hasNewPlan) {
    total = Number(p.depositTotal || 0);
    billNo = boundedText_(p.billNo, 'เลขบิลมัดจำ', 120, false);
    allocations = Array.isArray(p.depositAllocations) ? p.depositAllocations.map(Number) : splitDepositAmount_(total, count);
  } else {
    const legacyAmounts = devices.map(function (d) { return Number(d.deposit || 0); });
    const legacyBills = devices.map(function (d) { return String(d.billNo || '').trim(); });
    const sameAmount = legacyAmounts.every(function (v) { return v === legacyAmounts[0]; });
    const sameBill = legacyBills.every(function (v) { return v === legacyBills[0]; });
    if (count > 1 && sameAmount && sameBill) {
      total = legacyAmounts[0];
      billNo = boundedText_(legacyBills[0], 'เลขบิลมัดจำ', 120, false);
      allocations = splitDepositAmount_(total, count);
    } else {
      total = legacyAmounts.reduce(function (sum, value) { return sum + value; }, 0);
      billNo = boundedText_(legacyBills[0], 'เลขบิลมัดจำ', 120, false);
      if (!legacyBills.every(function (v) { return v === billNo; })) throw new Error('รายการในชุดเดียวกันต้องใช้เลขบิลมัดจำเดียวกัน');
      allocations = legacyAmounts;
    }
  }

  if (!Number.isInteger(total) || total < 0 || total > 10000000) throw new Error('ยอดมัดจำรวมไม่ถูกต้อง');
  if (allocations.length !== count) throw new Error('จำนวนรายการแบ่งมัดจำไม่ตรงกับจำนวนเครื่อง');
  allocations = allocations.map(function (value) {
    const amount = Number(value);
    if (!Number.isInteger(amount) || amount < 0 || amount > 10000000) throw new Error('ยอดมัดจำของแต่ละรายการไม่ถูกต้อง');
    return amount;
  });
  if (allocations.reduce(function (sum, value) { return sum + value; }, 0) !== total) {
    throw new Error('ยอดมัดจำที่แบ่งให้แต่ละรายการรวมกันไม่ตรงกับยอดมัดจำรวม');
  }
  if (total > 0 && !billNo) throw new Error('กรุณาระบุเลขบิลมัดจำ');
  if (!total) billNo = '';
  devices.forEach(function (d, i) { d.deposit = allocations[i]; d.billNo = billNo; });
  return { total: total, billNo: billNo, allocations: allocations };
}

