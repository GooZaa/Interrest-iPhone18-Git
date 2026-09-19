(function (window) {
  'use strict';

  var zone = 'Asia/Bangkok';
  var weekdays = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
  var slots = [];
  for (var hour = 11; hour <= 20; hour++) {
    slots.push(String(hour).padStart(2, '0') + ':00');
    if (hour < 20) slots.push(String(hour).padStart(2, '0') + ':30');
  }

  function parts(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return null;
    var year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    var date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return { year: year, month: month, day: day };
  }

  function key(year, month, day) {
    return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }

  function bangkokToday(now) {
    var values = {};
    new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now || new Date()).forEach(function (part) { values[part.type] = part.value; });
    return key(values.year, values.month, values.day);
  }

  function addDays(dateKey, days) {
    var date = parts(dateKey);
    if (!date) return '';
    return new Date(Date.UTC(date.year, date.month - 1, date.day + Number(days || 0))).toISOString().slice(0, 10);
  }

  function toIso(value) {
    var match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(String(value || ''));
    if (!match || !parts(match[1]) || slots.indexOf(match[2]) < 0) return '';
    var date = new Date(match[1] + 'T' + match[2] + ':00+07:00');
    return isNaN(date.getTime()) ? '' : date.toISOString();
  }

  function isFuture(value, now) {
    var iso = toIso(value);
    return !!iso && new Date(iso).getTime() > (now || new Date()).getTime();
  }

  function fromIso(value) {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(value || ''))) return value;
    var date = new Date(value);
    if (isNaN(date.getTime())) return '';
    var values = {};
    new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).forEach(function (part) { values[part.type] = part.value; });
    return key(values.year, values.month, values.day) + 'T' + values.hour + ':' + values.minute;
  }

  function dateLabel(dateKey) {
    var date = parts(dateKey);
    if (!date) return '';
    return new Intl.DateTimeFormat('th-TH', {
      timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(new Date(Date.UTC(date.year, date.month - 1, date.day)));
  }

  function monthLabel(year, month) {
    return new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', month: 'long', year: 'numeric' })
      .format(new Date(Date.UTC(year, month - 1, 1)));
  }

  function mount(target, options) {
    var root = typeof target === 'string' ? document.getElementById(target) : target;
    if (!root) return null;
    var initial = fromIso(options && options.value);
    var initialParts = initial && parts(initial.slice(0, 10));
    var today = bangkokToday();
    var current = parts(today);
    var state = {
      date: initialParts && isFuture(initial) ? initial.slice(0, 10) : '',
      time: initialParts && isFuture(initial) ? initial.slice(11) : '',
      year: initialParts && isFuture(initial) ? initialParts.year : current.year,
      month: initialParts && isFuture(initial) ? initialParts.month : current.month
    };

    function available(dateKey, time) { return isFuture(dateKey + 'T' + time); }
    function selectable(dateKey) { return dateKey >= bangkokToday() && slots.some(function (time) { return available(dateKey, time); }); }
    function render() {
      today = bangkokToday();
      var firstWeekday = (new Date(Date.UTC(state.year, state.month - 1, 1)).getUTCDay() + 6) % 7;
      var daysInMonth = new Date(Date.UTC(state.year, state.month, 0)).getUTCDate();
      var cells = '';
      for (var blank = 0; blank < firstWeekday; blank++) cells += '<span class="ap-date-empty" aria-hidden="true"></span>';
      for (var day = 1; day <= daysInMonth; day++) {
        var dateKey = key(state.year, state.month, day);
        var disabled = !selectable(dateKey);
        cells += '<button type="button" class="ap-date' + (dateKey === today ? ' today' : '') + (dateKey === state.date ? ' selected' : '') +
          '" data-ap-date="' + dateKey + '" aria-label="' + dateLabel(dateKey) + '" aria-pressed="' + (dateKey === state.date) + '"' +
          (disabled ? ' disabled' : '') + '>' + day + '</button>';
      }
      var thisMonth = key(state.year, state.month, 1) <= today.slice(0, 7) + '-01';
      var quick = [{ days: 0, label: 'วันนี้' }, { days: 1, label: 'พรุ่งนี้' }, { days: 3, label: 'อีก 3 วัน' },
        { days: 5, label: 'อีก 5 วัน' }, { days: 7, label: 'อีก 7 วัน' }].map(function (item) {
        var dateKey = addDays(today, item.days);
        return '<button type="button" class="ap-quick' + (state.date === dateKey ? ' selected' : '') + '" data-ap-quick="' +
          dateKey + '"' + (!selectable(dateKey) ? ' disabled' : '') + '>' + item.label + '</button>';
      }).join('');
      var times = slots.map(function (time) {
        return '<button type="button" class="ap-time' + (state.time === time ? ' selected' : '') + '" data-ap-time="' + time +
          '" aria-pressed="' + (state.time === time) + '"' + (!state.date || !available(state.date, time) ? ' disabled' : '') +
          '>' + time + '</button>';
      }).join('');
      root.innerHTML = '<div class="ap-shell"><div class="ap-top"><span class="ap-icon" aria-hidden="true">▦</span><div><b>เลือกวันนัดรับ</b><small>เลือกวันที่ แล้วเลือกช่วงเวลาที่สะดวก</small></div></div>' +
        '<div class="ap-calendar"><div class="ap-month"><b>' + monthLabel(state.year, state.month) + '</b><div class="ap-month-nav"><button type="button" data-ap-nav="-1" aria-label="เดือนก่อน"' +
        (thisMonth ? ' disabled' : '') + '>‹</button><button type="button" data-ap-nav="1" aria-label="เดือนถัดไป">›</button></div></div>' +
        '<div class="ap-weekdays">' + weekdays.map(function (dayName) { return '<span>' + dayName + '</span>'; }).join('') +
        '</div><div class="ap-days">' + cells + '</div></div><div class="ap-quick-row">' + quick + '</div>' +
        '<div class="ap-time-head"><b>เวลาเข้ารับสินค้า</b><small>11:00–20:00 น. · ทุก 30 นาที</small></div><div class="ap-times" role="group" aria-label="เลือกเวลาเข้ารับสินค้า">' + times +
        '</div><div class="ap-result" aria-live="polite"><span class="ap-result-icon" aria-hidden="true">✓</span><div><small>นัดรับสินค้า</small><b>' +
        (state.date && state.time ? dateLabel(state.date) + ' · ' + state.time + ' น.' : 'กรุณาเลือกวันและเวลา') + '</b></div></div></div>';
    }

    root.onclick = function (event) {
      var button = event.target.closest('button');
      if (!button || !root.contains(button) || button.disabled) return;
      if (button.dataset.apNav) {
        var next = new Date(Date.UTC(state.year, state.month - 1 + Number(button.dataset.apNav), 1));
        state.year = next.getUTCFullYear();
        state.month = next.getUTCMonth() + 1;
      } else if (button.dataset.apQuick || button.dataset.apDate) {
        state.date = button.dataset.apQuick || button.dataset.apDate;
        var date = parts(state.date);
        state.year = date.year;
        state.month = date.month;
        if (state.time && !available(state.date, state.time)) state.time = '';
      } else if (button.dataset.apTime) {
        state.time = button.dataset.apTime;
      }
      render();
      if (options && typeof options.onChange === 'function') options.onChange(controller.getValue());
    };

    var controller = {
      getValue: function () { return state.date && state.time ? state.date + 'T' + state.time : ''; },
      getIso: function () { var value = this.getValue(); return isFuture(value) ? toIso(value) : ''; },
      setDate: function (dateKey) {
        if (!parts(dateKey) || !selectable(dateKey)) return false;
        state.date = dateKey;
        var date = parts(dateKey);
        state.year = date.year;
        state.month = date.month;
        if (state.time && !available(dateKey, state.time)) state.time = '';
        render();
        return true;
      }
    };
    render();
    return controller;
  }

  window.AppointmentPicker = { mount: mount, slots: slots.slice(), todayKey: bangkokToday, addDays: addDays, toIso: toIso, isFuture: isFuture, fromIso: fromIso };
})(window);
