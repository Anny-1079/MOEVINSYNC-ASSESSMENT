(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = function (n) { return Number(n).toLocaleString('en-US'); };

  /* active nav link */
  var pg = $('[data-page]');
  var page = pg ? pg.getAttribute('data-page') : '';
  $$('.top nav a').forEach(function (a) {
    if (a.getAttribute('data-page') === page) a.setAttribute('aria-current', 'page');
  });

  /* copy buttons */
  function selectText(el) {
    try {
      if (el.select) { el.focus(); el.select(); return; }
      var r = document.createRange(); r.selectNodeContents(el);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    } catch (e) {}
  }
  $$('[data-copy]').forEach(function (btn) {
    var label = btn.textContent;
    btn.addEventListener('click', function () {
      var src = document.getElementById(btn.getAttribute('data-copy'));
      if (!src) return;
      var txt = (src.value !== undefined) ? src.value : src.textContent;
      var done = function (m) { btn.textContent = m; setTimeout(function () { btn.textContent = label; }, 1800); };
      try {
        navigator.clipboard.writeText(txt).then(function () { done('Copied'); }, function () { selectText(src); done('Selected, press Ctrl+C'); });
      } catch (e) { selectText(src); done('Selected, press Ctrl+C'); }
    });
  });

  /* sensitivity bars (2,000 people, 3 days a week) */
  var sens = $('#sens');
  if (sens) {
    var base = 1200, html = '';
    [1.0, 1.1, 1.2, 1.25, 1.3, 1.4, 1.5, 1.67].forEach(function (f) {
      var seats = f > 1.66 ? 2000 : Math.round(base * f);
      html += '<div class="row' + (f === 1.25 ? ' hl' : '') + '"><span class="num">' + f.toFixed(2) + '×</span>' +
        '<div class="bar2"><i style="width:' + (seats / 2000 * 100) + '%"></i></div>' +
        '<span class="num">' + fmt(seats) + ' · ' + Math.round(seats / 20) + '%</span></div>';
    });
    sens.innerHTML = html;
  }

  /* calculator */
  if ($('#calc')) {
    var st = { names: ['India', 'UK', 'USA'], hc: [900, 600, 500], days: 3, peak: 1.25, abs: 0 };
    var seatsFor = function (hc, p) { return Math.min(hc, Math.ceil(hc * st.days / 5 * p * (1 - st.abs / 100) - 1e-9)); };
    var totalFor = function (p) { return st.hc.reduce(function (s, h) { return s + seatsFor(h, p); }, 0); };
    var totalHc = function () { return st.hc.reduce(function (s, h) { return s + h; }, 0); };
    var maxPeak = function () { return 5 / st.days; };
    var rowsEl = $('#rows');
    st.names.forEach(function (n, i) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input type="text" id="n' + i + '" value="' + n + '" aria-label="Office ' + (i + 1) + ' name" maxlength="20"></td>' +
        '<td class="r"><input type="number" id="h' + i + '" min="0" max="20000" step="10" value="' + st.hc[i] + '" aria-label="Office ' + (i + 1) + ' headcount"></td>' +
        '<td class="r num hide-s" id="a' + i + '"></td><td class="r num" id="s' + i + '"></td>';
      rowsEl.appendChild(tr);
      $('#h' + i).addEventListener('input', function (e) {
        var v = parseInt(e.target.value, 10);
        st.hc[i] = isNaN(v) || v < 0 ? 0 : Math.min(v, 20000);
        render();
      });
    });
    $('#days').addEventListener('change', function (e) { st.days = parseInt(e.target.value, 10); render(); });
    $('#abs').addEventListener('input', function (e) {
      var v = parseFloat(e.target.value); st.abs = isNaN(v) ? 0 : Math.max(0, Math.min(30, v)); render();
    });
    $('#peak').addEventListener('input', function (e) { st.peak = parseFloat(e.target.value); render(); });
    $('#reset').addEventListener('click', function () {
      st.hc = [900, 600, 500]; st.days = 3; st.peak = 1.25; st.abs = 0;
      st.hc.forEach(function (h, i) { $('#h' + i).value = h; });
      $('#days').value = 3; $('#abs').value = 0; render();
    });

    var drawGrid = function () {
      var cv = $('#seatgrid'), hc = totalHc(), seats = totalFor(st.peak), cols = 50, gap = 2;
      var avail = cv.parentElement.clientWidth || 300;
      var cell = Math.max(3, Math.floor((avail - gap * (cols - 1)) / cols));
      var rows = Math.max(1, Math.ceil(hc / cols));
      var w = cell * cols + gap * (cols - 1), h = rows * cell + gap * (rows - 1);
      var dpr = window.devicePixelRatio || 1;
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      var ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var cs = getComputedStyle(document.documentElement);
      var on = cs.getPropertyValue('--accent').trim() || '#2E5E73';
      var off = cs.getPropertyValue('--line').trim() || '#D9DFE3';
      for (var i = 0; i < hc; i++) {
        ctx.fillStyle = i < seats ? on : off;
        ctx.fillRect((i % cols) * (cell + gap), Math.floor(i / cols) * (cell + gap), cell, cell);
      }
    };

    var profiles = [
      { name: 'Spread evenly', note: 'Teams have different anchor days, so every weekday looks alike.', vals: [1200, 1200, 1200, 1200, 1200] },
      { name: 'Natural clustering', note: 'Mid-week peaks and a quiet Monday and Friday. This is the planning case.', vals: [1000, 1450, 1500, 1450, 600] },
      { name: 'Same three days', note: 'No guidance and no caps. Tuesday to Thursday are full.', vals: [0, 2000, 2000, 2000, 0] }
    ];
    var drawProfiles = function () {
      var hc = totalHc(), scale = hc / 2000, seats = totalFor(st.peak), labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], out = '';
      profiles.forEach(function (p) {
        var bars = '', lbls = '', peak = 0;
        p.vals.forEach(function (v, i) {
          var val = Math.round(v * scale); if (val > peak) peak = val;
          var pct = hc ? Math.min(100, val / hc * 100) : 0;
          bars += '<div class="bar1"><b class="' + (val > seats ? 'over' : '') + '" style="height:' + pct.toFixed(1) + '%"></b><span style="bottom:calc(' + pct.toFixed(1) + '% + 2px)">' + fmt(val) + '</span></div>';
          lbls += '<span>' + labels[i] + '</span>';
        });
        var lp = hc ? Math.min(100, seats / hc * 100) : 0;
        out += '<div class="card"><h3>' + p.name + '</h3><div class="bars">' + bars +
          '<div class="planline" style="bottom:' + lp.toFixed(1) + '%"><em>' + fmt(seats) + ' desks</em></div></div>' +
          '<div class="days">' + lbls + '</div><p class="muted">' + p.note + ' Busiest day: <span class="num">' + fmt(peak) + '</span>.</p></div>';
      });
      $('#profiles').innerHTML = out;
    };

    var render = function () {
      var mp = maxPeak();
      if (st.peak > mp) st.peak = mp;
      if (st.peak < 1) st.peak = 1;
      var hc = totalHc(), seats = totalFor(st.peak), avgTot = 0;
      st.hc.forEach(function (h, i) {
        var avg = Math.round(h * st.days / 5 * (1 - st.abs / 100));
        avgTot += avg;
        $('#a' + i).textContent = fmt(avg);
        $('#s' + i).textContent = fmt(seatsFor(h, st.peak));
      });
      $('#f-hc').textContent = fmt(hc);
      $('#f-avg').textContent = fmt(avgTot);
      $('#f-seats').textContent = fmt(seats);
      var pk = $('#peak'); pk.max = mp.toFixed(2); pk.value = st.peak;
      $('#peak-v').textContent = st.peak.toFixed(2) + '×';
      $('#abs-v').textContent = st.abs + '%';
      $('#o-min').textContent = fmt(totalFor(1));
      $('#o-seats').textContent = fmt(seats);
      $('#o-max').textContent = fmt(totalFor(mp));
      $('#o-share').textContent = hc ? Math.round(seats / hc * 100) + '%' : '0%';
      $('#o-saved').textContent = fmt(Math.max(0, hc - seats));
      $('#lg-seat').textContent = fmt(seats) + ' desks';
      $('#lg-none').textContent = fmt(Math.max(0, hc - seats)) + ' people without a desk of their own';
      drawGrid(); drawProfiles();
    };
    var t;
    window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(drawGrid, 80); });
    try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawGrid); } catch (e) {}
    try { new MutationObserver(drawGrid).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) {}
    render();
  }

  /* KPI scorecard */
  var kl = $('#kpi-list');
  if (kl) {
    var K = [
      ['space', 'Peak-day occupancy', 'Highest daily occupied desks ÷ desks, per office, per week', '80 to 90%', 'Weekly', 'Site facility lead', 'Above 95% means people are being turned away. Below 70% for weeks means desks can be released.'],
      ['space', 'Average weekday occupancy', 'Mean of the five daily occupancy figures', '55 to 70%', 'Weekly', 'Site facility lead', 'Shows how much sits empty on quiet days. Monday and Friday usually pull it down.'],
      ['space', 'Seat denial rate', 'Booking attempts that failed for lack of a desk ÷ all attempts', 'Under 3%', 'Weekly', 'Workplace manager', 'The most direct test of whether capacity is enough on the days people want to come.'],
      ['space', 'Check-in rate', 'Desks checked into ÷ desks booked', 'Above 90%', 'Weekly', 'Workplace manager', 'A low rate means booked-but-empty desks that hide free seats from colleagues.'],
      ['adoption', 'Platform adoption', 'Employees with at least one booking in the month ÷ headcount', 'Above 90%', 'Monthly', 'Workplace manager', 'Without adoption every other figure is unreliable.'],
      ['adoption', 'Attendance pattern', 'Share of employees averaging 2.5 to 3.5 office days a week', 'Above 80%', 'Monthly', 'Workplace manager', 'Tests whether the 3-day assumption is true. A drift to 4 days means a desk shortage.'],
      ['cost', 'Cost per used desk', 'Total workplace cost per month ÷ average occupied desks', 'Flat or falling each quarter', 'Monthly', 'Facilities head', 'Rent per desk hides empty seats. Cost per used desk does not.'],
      ['cost', 'Energy per occupied desk', 'kWh ÷ occupied desk-days', 'Flat or falling each quarter', 'Monthly', 'Site facility lead', 'Rewards switching off unused zones on quiet days.'],
      ['service', 'Workplace satisfaction', 'Quarterly 1 to 5 survey with comments, by office', '4.2 or higher', 'Quarterly', 'Facilities head', 'Read it next to occupancy. Rising crowding with falling scores needs a fix.'],
      ['service', 'Ticket response and resolution', 'Median time to first reply and to close facility requests', '1 hour reply, 1 working day close', 'Weekly', 'Site facility lead', 'Shows which site or vendor is slow.'],
      ['service', 'Repeat ticket rate', 'Requests raised again within 14 days ÷ all requests', 'Under 10%', 'Monthly', 'Site facility lead', 'Shows repairs that did not hold.'],
      ['service', 'Meeting room use', 'Used hours ÷ available hours, plus no-show rate', '50 to 70% used, under 10% no-show', 'Monthly', 'Workplace manager', 'Checks that the room mix matches real meeting sizes.'],
      ['safety', 'Safety compliance', 'Drills held, days over the local occupancy limit, incidents', '100% drills, 0 days over limit', 'Monthly', 'Facilities head', 'Fire and occupancy rules differ by country, so each site is tracked on its own.'],
      ['safety', 'Cleaning and facility audit score', 'Weekly floor checklist score', 'Above 90%', 'Weekly', 'Site facility lead', 'Catches hygiene and upkeep problems before employees report them.'],
      ['safety', 'Meal wastage', '(Meals prepared − meals eaten) ÷ meals prepared', 'Under 8%', 'Weekly', 'Cafeteria vendor lead', 'Tells me whether pre-booking and the attendance forecast match.']
    ];
    var G = { space: 'Space use', adoption: 'Adoption', cost: 'Cost', service: 'Service', safety: 'Safety and food' };
    var draw = function (f) {
      kl.innerHTML = K.filter(function (k) { return f === 'all' || k[0] === f; }).map(function (k) {
        return '<article class="card kpi"><div class="head"><h3>' + k[1] + '</h3><span class="tag">' + G[k[0]] + '</span></div>' +
          '<dl><dt>Measure</dt><dd>' + k[2] + '</dd><dt>Target</dt><dd><b>' + k[3] + '</b></dd><dt>Cadence</dt><dd>' + k[4] + ', ' + k[5] + '</dd><dt>Reads as</dt><dd>' + k[6] + '</dd></dl></article>';
      }).join('');
      $('#kpi-count').textContent = $$('.kpi', kl).length + ' of ' + K.length + ' KPIs shown';
    };
    $$('[data-filter]').forEach(function (c) {
      c.addEventListener('click', function () {
        $$('[data-filter]').forEach(function (o) { o.setAttribute('aria-pressed', o === c ? 'true' : 'false'); });
        draw(c.getAttribute('data-filter'));
      });
    });
    draw('all');
  }

  /* link composer */
  if ($('#composer')) {
    var join = function (ids) {
      return ids.map(function (i) { return ($('#' + i).value || '').trim(); }).filter(Boolean).join(', ');
    };
    var upd = function () {
      $('#out1').value = join(['l1', 'l2']);
      $('#out2').value = join(['m1', 'm2', 'm3']);
    };
    $$('#composer input[type="url"]').forEach(function (i) { i.addEventListener('input', upd); });
    upd();
  }
})();
