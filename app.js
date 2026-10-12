// FairFare UI. Talks to the engine through window.FairFare. Everything stays in this browser (localStorage).
(function () {
  "use strict";
  var FF = window.FairFare;
  var FS = window.FairFareSummary;
  var KEY = "fairfare.v3";
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  };
  var rs = function (p) { return "₹" + FF.fmt(p); };
  var rsShort = function (p) { return p % 100 === 0 ? "₹" + (p / 100).toLocaleString("en-IN") : rs(p); };

  // ---------- icons ----------
  var IC = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M17.5 14.5c2.2.3 3.6 2 4 4.5"/>',
    scale: '<path d="M12 4v16M6 20h12M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
    swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    arrow: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8M13 8l4 4-4 4"/>',
    arrowr: '<path d="M5 12h14M14 7l5 5-5 5"/>',
    shield: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    pencil: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 10h18M16 15h2"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    food: '<path d="M6 3v7a2 2 0 0 0 2 2v9M10 3v7M6 3v7M17 3c-2 2-2 6 0 8v10"/>',
    cup: '<path d="M5 8h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M17 9h2a2 2 0 0 1 0 5h-2"/>',
    boat: '<path d="M3 15h18l-2 4H5zM12 4v10M12 5l6 8h-6"/>',
    car: '<path d="M3 14l2-6h14l2 6v4H3z"/><circle cx="7.5" cy="16" r="1.2"/><circle cx="16.5" cy="16" r="1.2"/>',
    bed: '<path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
    coins: '<circle cx="9" cy="9" r="6"/><path d="M15 6.3A6 6 0 0 1 15 17.7M9 7v4M7.5 9h3"/>'
  };
  var icon = function (n) { return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + (IC[n] || "") + "</svg>"; };
  var avatar = function (name, big) {
    var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return '<span class="av' + (big ? " lg" : "") + '" style="--h:' + h + '" aria-hidden="true">' + esc(name.charAt(0).toUpperCase()) + "</span>";
  };
  var who = function (name) { return '<span class="who">' + avatar(name) + "<span>" + esc(name) + "</span></span>"; };
  function catIcon(title) {
    var t = (title || "").toLowerCase();
    if (/\b(tea|coffee|snacks?|drinks?|juice)/.test(t)) return "cup";
    if (/\b(food|lunch|dinner|breakfast|meals?|restaurant|biryani)/.test(t)) return "food";
    if (/\b(boat|boating|rides?|tickets?|entry|park)\b/.test(t)) return "boat";
    if (/\b(fuel|petrol|diesel|cabs?|taxis?|bus|buses|toll|cars?|parking)\b/.test(t)) return "car";
    if (/\b(hotel|room|stay|resort|lodge)/.test(t)) return "bed";
    return "receipt";
  }

  // ---------- state ----------
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function shortDate(iso) {
    try { return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }); } catch (e) { return ""; }
  }
  function blank() { return { trip: "", demo: false, members: [], expenses: [], transfers: [], mode: "equal", caps: {}, agreed: false, nid: 1, view: "dashboard", txKind: "expense", txFilter: "all", sumOpts: { list: true, balances: true }, sumFmt: "plain" }; }
  function demo() {
    var m = ["Kamesh", "Haswin", "Santhosh", "Mukesh", "Hari", "Mathi"], R = function (x) { return x * 100; };
    return {
      trip: "Kodaikanal Getaway", demo: true, members: m, mode: "equal", caps: {}, agreed: false, nid: 20, view: "dashboard", txKind: "expense", txFilter: "all", sumOpts: { list: true, balances: true }, sumFmt: "plain",
      expenses: [
        { id: 1, title: "Food - Day 1", amount: R(1342), paidBy: "Kamesh", sharedBy: m.slice(), date: "2026-04-12" },
        { id: 2, title: "Tea & Snacks", amount: R(254), paidBy: "Hari", sharedBy: m.slice(), date: "2026-04-12" },
        { id: 3, title: "Boating", amount: R(140), paidBy: "Mathi", sharedBy: m.slice(), date: "2026-04-11" }
      ],
      transfers: [
        { id: 4, from: "Haswin", to: "Kamesh", amount: R(200), note: "Advance cash", date: "2026-04-10" },
        { id: 5, from: "Santhosh", to: "Kamesh", amount: R(300), note: "Advance cash", date: "2026-04-10" },
        { id: 6, from: "Hari", to: "Kamesh", amount: R(200), note: "Advance cash", date: "2026-04-10" },
        { id: 7, from: "Mathi", to: "Kamesh", amount: R(250), note: "Advance cash", date: "2026-04-10" },
        { id: 8, from: "Haswin", to: "Mukesh", amount: R(200), note: "Advance cash", date: "2026-04-11" },
        { id: 9, from: "Mukesh", to: "Hari", amount: R(200), note: "Passed along", date: "2026-04-12" }
      ]
    };
  }
  function load() { try { var r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  // Fill in anything missing so older or hand-edited saves never crash the UI.
  function normalize(d) {
    var b = blank();
    Object.keys(b).forEach(function (k) { if (d[k] === undefined || d[k] === null) d[k] = b[k]; });
    ["members", "expenses", "transfers"].forEach(function (k) { if (!Array.isArray(d[k])) d[k] = []; });
    if (typeof d.caps !== "object" || Array.isArray(d.caps)) d.caps = {};
    if (!d.sumOpts || typeof d.sumOpts !== "object") d.sumOpts = { list: true, balances: true };
    if (d.sumFmt !== "whatsapp") d.sumFmt = "plain";
    if (d.mode !== "caps") d.mode = "equal";
    var maxId = 0;
    d.expenses.concat(d.transfers).forEach(function (x) { if (x && x.id > maxId) maxId = x.id; });
    if (!(d.nid > maxId)) d.nid = maxId + 1;
    return d;
  }
  var S = normalize((function () { var d = load(); return d && !d.demo ? d : blank(); })());
  var ui = { editTrip: false, msg: {}, edit: null, summaryBase: "", remind: [] };
  function touch() { S.demo = false; S.agreed = false; save(); }

  // ---------- engine ----------
  function engineCaps() {
    var c = {}; S.members.forEach(function (m) { if (typeof S.caps[m] === "number") c[m] = S.caps[m]; }); return c;
  }
  function calc() {
    var base = { members: S.members, expenses: S.expenses, transfers: S.transfers, caps: engineCaps() };
    var eq = FF.settle(Object.assign({ mode: "equal" }, base));
    var res = S.mode === "caps" ? FF.settle(Object.assign({ mode: "caps" }, base)) : eq;
    return { eq: eq, res: res, empty: !S.expenses.length && !S.transfers.length };
  }
  var sum = function (a, f) { return a.reduce(function (s, x) { return s + f(x); }, 0); };
  var totalSpent = function () { return sum(S.expenses, function (e) { return e.amount; }); };

  // ---------- charts ----------
  function chartPaid() {
    var paid = {}; S.expenses.forEach(function (e) { paid[e.paidBy] = (paid[e.paidBy] || 0) + e.amount; });
    var tot = totalSpent();
    var rows = Object.keys(paid).sort(function (a, b) { return paid[b] - paid[a]; });
    if (!rows.length) return '<p class="empty">Add an expense to see who paid.</p>';
    return rows.map(function (m) {
      var pct = Math.round(paid[m] / tot * 100);
      return '<div class="hb" title="' + esc(m) + " paid " + rs(paid[m]) + " (" + pct + '% of spending)">' + who(m) +
        '<div class="t"><div class="f" style="width:' + (paid[m] / tot * 100).toFixed(1) + '%"></div></div><div class="v">' + rsShort(paid[m]) + "<small>" + pct + "%</small></div></div>";
    }).join("");
  }
  function chartBalances(res) {
    if (!res.ok) return '<p class="empty">Add members and an expense to see balances.</p>';
    var max = Math.max.apply(null, S.members.map(function (m) { return Math.abs(res.net[m]); }).concat([1]));
    return S.members.map(function (m) {
      var n = res.net[m], w = (Math.abs(n) / max * 50).toFixed(1);
      var bar = n === 0 ? "" : '<div class="b ' + (n > 0 ? "gets" : "pays") + '" style="width:' + w + '%"></div>';
      var txt = n > 0 ? "gets " + rs(n) : n < 0 ? "pays " + rs(-n) : "settled";
      return '<div class="div" title="' + esc(m) + " " + txt + '">' + who(m) + '<div class="t">' + bar + '</div><div class="v">' + txt + "</div></div>";
    }).join("");
  }
  function chartShares(c) {
    var res = c.res, eq = c.eq;
    if (!res.ok || !eq.ok) return '<p class="empty">Shares appear here once the split can be calculated.</p>';
    var caps = S.mode === "caps";
    var max = Math.max.apply(null, S.members.map(function (m) { return Math.max(res.shares[m], eq.shares[m]); }).concat([1]));
    var legend = caps
      ? '<div class="legend"><span><i style="background:var(--blue)"></i>Equal share</span><span><i style="background:var(--accent)"></i>With caps (proposed)</span></div>'
      : '<div class="legend"><span><i style="background:var(--accent)"></i>Fair share</span></div>';
    return legend + S.members.map(function (m) {
      var bars = (caps ? '<i class="eq" style="width:' + (eq.shares[m] / max * 100).toFixed(1) + '%"></i>' : "") + '<i class="pr" style="width:' + (res.shares[m] / max * 100).toFixed(1) + '%"></i>';
      var tip = esc(m) + ": equal " + rs(eq.shares[m]) + (caps ? ", proposed " + rs(res.shares[m]) : "");
      return '<div class="gb" title="' + tip + '">' + who(m) + '<div class="bars">' + bars + '</div><div class="v">' + rs(res.shares[m]) + "</div></div>";
    }).join("");
  }
  function chartFlow(pays) {
    if (!pays.length) return "";
    // Compact sankey: small canvas, short labels (full names in tooltips).
    var W = 340, LX = 92, RX = 236, NW = 8, GAP = 8, MINH = 30, PAD = 4, AVAIL = 120;
    var cut = function (n) { return n.length > 11 ? n.slice(0, 10) + "…" : n; };
    var out = {}, inn = {}, total = 0;
    pays.forEach(function (p) { out[p.from] = (out[p.from] || 0) + p.amount; inn[p.to] = (inn[p.to] || 0) + p.amount; total += p.amount; });
    var L = Object.keys(out).sort(function (a, b) { return out[b] - out[a]; });
    var R = Object.keys(inn).sort(function (a, b) { return inn[b] - inn[a]; });
    var scale = AVAIL / total;
    function layout(names, tot) {
      var y = PAD, pos = {};
      names.forEach(function (n) { var h = Math.max(MINH, tot[n] * scale); pos[n] = { y: y, h: h, used: 0 }; y += h + GAP; });
      return { pos: pos, end: y - GAP + PAD };
    }
    var lo = layout(L, out), ro = layout(R, inn);
    var H = Math.max(lo.end, ro.end);
    var byL = pays.slice().sort(function (a, b) { return L.indexOf(a.from) - L.indexOf(b.from) || R.indexOf(a.to) - R.indexOf(b.to); });
    var byR = pays.slice().sort(function (a, b) { return R.indexOf(a.to) - R.indexOf(b.to) || L.indexOf(a.from) - L.indexOf(b.from); });
    byL.forEach(function (p) { var n = lo.pos[p.from], t = p.amount / out[p.from] * n.h; p.ly = n.y + n.used; p.lt = t; n.used += t; });
    byR.forEach(function (p) { var n = ro.pos[p.to], t = p.amount / inn[p.to] * n.h; p.ry = n.y + n.used; p.rt = t; n.used += t; });
    var x0 = LX + NW, x1 = RX, cx = (x0 + x1) / 2, s = "";
    pays.forEach(function (p) {
      s += '<path class="rib" d="M' + x0 + "," + p.ly + " C" + cx + "," + p.ly + " " + cx + "," + p.ry + " " + x1 + "," + p.ry + " L" + x1 + "," + (p.ry + p.rt) + " C" + cx + "," + (p.ry + p.rt) + " " + cx + "," + (p.ly + p.lt) + " " + x0 + "," + (p.ly + p.lt) + ' Z"><title>' + esc(p.from) + " pays " + esc(p.to) + " " + rs(p.amount) + "</title></path>";
    });
    L.forEach(function (n) {
      var q = lo.pos[n], m = q.y + q.h / 2;
      s += '<g><title>' + esc(n) + " pays " + rs(out[n]) + '</title><rect class="nl" x="' + LX + '" y="' + q.y + '" width="' + NW + '" height="' + q.h + '" rx="3"/><text x="' + (LX - 6) + '" y="' + (m - 1) + '" text-anchor="end" font-weight="600">' + esc(cut(n)) + '</text><text class="a" x="' + (LX - 6) + '" y="' + (m + 12) + '" text-anchor="end">' + rsShort(out[n]) + "</text></g>";
    });
    R.forEach(function (n) {
      var q = ro.pos[n], m = q.y + q.h / 2;
      s += '<g><title>' + esc(n) + " receives " + rs(inn[n]) + '</title><rect class="nr" x="' + RX + '" y="' + q.y + '" width="' + NW + '" height="' + q.h + '" rx="3"/><text x="' + (RX + NW + 6) + '" y="' + (m - 1) + '" font-weight="600">' + esc(cut(n)) + '</text><text class="a" x="' + (RX + NW + 6) + '" y="' + (m + 12) + '">' + rsShort(inn[n]) + "</text></g>";
    });
    return '<div class="legend"><span><i style="background:var(--pays)"></i>Pays</span><span><i style="background:var(--accent)"></i>Receives</span></div>' +
      '<div class="flow"><svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Money flow from people who pay to people who receive">' + s + "</svg></div>";
  }

  // ---------- summary text (built in summary.js) ----------
  // Share text is built from one source in two formats: general text and WhatsApp-style (*bold*).
  function summaryState() { return { trip: S.trip, members: S.members, expenses: S.expenses, transfers: S.transfers, mode: S.mode, caps: S.caps, agreed: S.agreed, sumOpts: S.sumOpts }; }
  function summaryText(c, kind) { return FS.build(summaryState(), c, kind); }
  function reminders(c) { return FS.reminders(summaryState(), c); }
  var waHtml = FS.waHtml;
  function waLink(text) { return "https://wa.me/?text=" + encodeURIComponent(text); }

  // ---------- views ----------
  var NAV = [["dashboard", "Dashboard", "grid"], ["tx", "Transactions", "receipt"], ["members", "Members", "users"], ["studio", "Fair Share Studio", "scale"], ["settle", "Settlement", "swap"], ["share", "Share summary", "chat"]];
  function renderNav() {
    $("nav").innerHTML = '<div class="lbl">Workspace</div>' + NAV.map(function (n) {
      return '<button class="nav-btn" type="button" data-go="' + n[0] + '"' + (S.view === n[0] ? ' aria-current="page"' : "") + ">" + icon(n[2]) + n[1] + "</button>";
    }).join("");
    $("tripPill").innerHTML = esc(S.trip || "Name your trip") + " " + icon("pencil");
    $("logoMark").innerHTML = icon("wallet");
  }
  function msgLine(k) { return '<p class="msg" role="status" id="msg-' + k + '">' + esc(ui.msg[k] || "") + "</p>"; }
  function setMsg(k, t) { ui.msg[k] = t; var el = $("msg-" + k); if (el) el.textContent = t; }

  function onboarding() {
    if (S.members.length >= 2 && (S.expenses.length || S.transfers.length)) return "";
    var steps = [["Add your friends", S.members.length >= 2, "members", "Add members"], ["Record expenses and money passed around", S.expenses.length + S.transfers.length > 0, "tx", "Add a transaction"], ["Share the summary with your group", false, "share", "Open summary"]];
    var next = steps.findIndex(function (x) { return !x[1]; });
    return '<section class="card"><h3>Start your trip</h3><ul class="list">' + steps.map(function (st, i) {
      return '<li class="li"><span class="ic" style="' + (st[1] ? "" : "background:var(--soft);color:var(--muted)") + '">' + (st[1] ? icon("check") : "<b>" + (i + 1) + "</b>") + '</span><div class="mid"><b>' + st[0] + "</b></div>" +
        (i === next ? '<button class="btn small" type="button" data-go="' + st[2] + '">' + st[3] + "</button>" : "") + "</li>";
    }).join("") + '</ul><p class="foot">Just exploring? <button class="linkbtn" type="button" data-act="loadDemo">Fill in example data</button></p></section>';
  }
  function vDashboard(c) {
    var n = S.members.length, res = c.res;
    var shareTxt = "–", shareSub = "";
    if (res.ok && !c.empty) {
      var sh = S.members.map(function (m) { return res.shares[m]; }), mn = Math.min.apply(null, sh), mx = Math.max.apply(null, sh), si = FS.shareInfo(summaryState(), c);
      if (si.even) shareTxt = rs(si.each); else { shareTxt = rsShort(mn) + "–" + rsShort(mx); shareSub = si.capped ? "caps applied" : "varies by who shared"; }
    }
    var title = ui.editTrip
      ? '<form class="title-row" id="tripForm"><input id="tripInput" value="' + esc(S.trip) + '" placeholder="e.g. Goa trip" aria-label="Trip name" style="width:16rem;max-width:100%"><button class="btn small" type="submit">Save</button></form>'
      : '<div class="title-row"><h1' + (S.trip ? "" : ' style="color:var(--muted)"') + '>' + esc(S.trip || "Name your trip") + '</h1><button class="icon-btn" data-act="editTrip" type="button" aria-label="Edit trip name">' + icon("pencil") + "</button></div>";
    return '<div class="head"><div>' + title + '<p class="sub">' + n + " members · " + S.expenses.length + " expenses · " + S.transfers.length + ' transfers</p></div>' +
      '<div class="total-tile"><small>Trip Total</small><b class="num">' + rs(totalSpent()) + "</b></div></div>" +
      onboarding() + '<div class="grid g3">' +
      '<div class="card kpi"><span class="ico">' + icon("receipt") + '</span><small>Total Expenses</small><span class="big">' + rs(totalSpent()) + "</span></div>" +
      '<div class="card kpi"><span class="ico">' + icon("users") + '</span><small>Fair Share (each)</small><span class="big">' + shareTxt + "</span>" + (shareSub ? "<small>" + shareSub + "</small>" : "") + "</div>" +
      '<div class="card kpi"><span class="ico">' + icon("swap") + '</span><small>Settlements</small><span class="big">' + (res.ok ? res.payments.length : 0) + " payments</span></div></div>" +
      "<h2>Quick Actions</h2>" +
      '<div class="actions">' +
      '<button class="act" type="button" data-go="tx" data-kind="expense">' + icon("plus") + "Add Expense</button>" +
      '<button class="act" type="button" data-go="tx" data-kind="transfer">' + icon("arrow") + "Add Transfer</button>" +
      '<button class="act" type="button" data-go="studio" data-mode="caps">' + icon("shield") + "Set Affordability Cap</button>" +
      '<button class="act" type="button" data-go="settle">' + icon("list") + "View Settlement</button></div>" +
      '<div class="grid g2">' +
      '<section class="card"><h3>Who paid</h3><p class="sub" style="margin-top:-6px">Share of the trip\'s spending, by who paid the bill.</p>' + chartPaid() + "</section>" +
      '<section class="card"><h3>Who gets, who pays</h3><p class="sub" style="margin-top:-6px">Balance after spending, advance cash and passed money.</p>' + chartBalances(res) + "</section></div>" +
      (n ? "" : '<div class="banner warn">' + icon("info") + '<div class="grow"><span>Start by adding your friends under Members, then record expenses and transfers.</span><div class="row" style="flex:0 0 auto"><button class="btn small" type="button" data-go="members">Add members</button><button class="btn ghost small" type="button" data-act="demo">Try with sample data</button></div></div></div>') +
      '<div class="banner">' + icon("info") + "<span>All calculations are based on the entries you add. Share the summary with your group when you're ready.</span></div>";
  }

  function entries() {
    var a = S.expenses.map(function (e) { return { t: "e", id: e.id, date: e.date || "", o: e }; })
      .concat(S.transfers.map(function (t) { return { t: "t", id: t.id, date: t.date || "", o: t }; }));
    a.sort(function (x, y) { return x.date < y.date ? 1 : x.date > y.date ? -1 : y.id - x.id; });
    return a;
  }
  function txList() {
    var f = S.txFilter, a = entries().filter(function (x) { return f === "all" || (f === "expense" ? x.t === "e" : x.t === "t"); });
    if (!a.length) return '<p class="empty">Nothing here yet.</p>';
    return '<ul class="list">' + a.map(function (x) {
      var o = x.o, del = '<button class="icon-btn del" type="button" data-act="del" data-t="' + x.t + '" data-id="' + x.id + '" aria-label="Delete">' + icon("x") + "</button>";
      if (x.t === "e") {
        var sh = o.sharedBy.length === S.members.length ? "everyone" : o.sharedBy.join(", ");
        return '<li class="li"><span class="ic">' + icon(catIcon(o.title)) + '</span><div class="mid"><b>' + esc(o.title) + "</b><small>Paid by " + esc(o.paidBy) + " · shared by " + esc(sh) + '</small></div><div class="end"><b>' + rs(o.amount) + "</b><small>" + shortDate(o.date) + "</small></div>" + del + "</li>";
      }
      return '<li class="li"><span class="ic tr">' + icon("arrowr") + '</span><div class="mid"><b>' + esc(o.from) + " → " + esc(o.to) + "</b><small>" + esc(o.note || "Transfer") + '</small></div><div class="end"><b>' + rs(o.amount) + "</b><small>" + shortDate(o.date) + "</small></div>" + del + "</li>";
    }).join("") + "</ul>";
  }
  function opts(sel) { return S.members.map(function (m) { return '<option value="' + esc(m) + '"' + (m === sel ? " selected" : "") + ">" + esc(m) + "</option>"; }).join(""); }
  function vTx() {
    var ex = S.txKind === "expense";
    var chips = S.members.map(function (m) { return '<label class="chip on"><input type="checkbox" name="share" value="' + esc(m) + '" checked> ' + esc(m) + "</label>"; }).join("");
    var filters = [["all", "All"], ["expense", "Expenses"], ["transfer", "Transfers"]].map(function (f) {
      return '<button class="chip' + (S.txFilter === f[0] ? " on" : "") + '" type="button" data-filter="' + f[0] + '">' + f[1] + "</button>";
    }).join("");
    return '<div><h1>Transactions</h1><p class="sub">Record spending and money passed between friends in one place.</p></div>' +
      '<div class="grid g2" style="align-items:start">' +
      '<section class="card"><div class="seg" role="group" aria-label="Entry type"><button type="button" data-kind="expense" aria-pressed="' + ex + '">Expense</button><button type="button" data-kind="transfer" aria-pressed="' + !ex + '">Transfer</button></div>' +
      '<form class="form" id="expForm"' + (ex ? "" : " hidden") + '><p class="sub" style="margin:0">A real expense, not a transfer.</p>' +
      '<label>Amount (₹)<input id="eAmount" inputmode="decimal" placeholder="Enter amount" autocomplete="off"></label>' +
      '<label>Paid by<select id="ePaid">' + opts() + "</select></label>" +
      '<div><label id="shareLbl">Who shares?</label><div class="chips" id="eShare" role="group" aria-labelledby="shareLbl" style="margin-top:6px">' + (chips || '<span class="empty">Add members first.</span>') + "</div></div>" +
      '<label>Description (optional)<input id="eTitle" placeholder="e.g. Food, fuel, tickets" autocomplete="off"></label>' +
      '<button class="btn block" type="submit">Save Expense</button></form>' +
      '<form class="form" id="trForm"' + (ex ? " hidden" : "") + '><p class="sub" style="margin:0">Money moving between friends, such as advance cash or money passed along. Not spending.</p>' +
      '<label>From<select id="tFrom">' + opts() + "</select></label>" +
      '<label>To<select id="tTo">' + opts(S.members[1]) + "</select></label>" +
      '<label>Amount (₹)<input id="tAmount" inputmode="decimal" placeholder="Enter amount" autocomplete="off"></label>' +
      '<label>Reason (optional)<input id="tNote" placeholder="e.g. Advance cash" autocomplete="off"></label>' +
      '<button class="btn block" type="submit">Save Transfer</button></form>' + msgLine("tx") + "</section>" +
      '<section class="card"><div class="head"><h3>Recent activity</h3><div class="chips">' + filters + "</div></div>" + '<div id="txList">' + txList() + "</div></section></div>";
  }

  function memberStats(c) {
    return S.members.map(function (m) {
      var n = c.res.ok ? c.res.net[m] : 0;
      var pill = !c.res.ok || c.empty ? "" : n > 0 ? '<span class="pill gets">gets ' + rs(n) + "</span>" : n < 0 ? '<span class="pill pays">pays ' + rs(-n) + "</span>" : '<span class="pill even">settled</span>';
      return '<li class="li">' + avatar(m, true) + '<div class="mid"><b>' + esc(m) + "</b></div>" + pill +
        '<button class="icon-btn del" type="button" data-act="delMember" data-m="' + esc(m) + '" aria-label="Remove ' + esc(m) + '">' + icon("x") + "</button></li>";
    }).join("");
  }
  function vMembers(c) {
    return '<div><h1>Members</h1><p class="sub">Add your friends to the trip group.</p></div>' +
      '<section class="card"><form class="row" id="memberForm" style="align-items:flex-end"><label style="flex:3 1 200px">Name<input id="memberName" placeholder="Enter name" maxlength="30" autocomplete="off"></label><button class="btn" type="submit" style="flex:0 0 auto">' + icon("plus") + "Add</button></form>" + msgLine("members") + "</section>" +
      '<section class="card"><h3>Group members (' + S.members.length + ")</h3>" + (S.members.length ? '<ul class="list">' + memberStats(c) + "</ul>" : '<p class="empty">No one yet. Add your group above.</p>') + "</section>";
  }

  function studioOut(c) {
    var res = c.res, caps = S.mode === "caps", s = "";
    if (caps) {
      var has = Object.keys(engineCaps()).length > 0;
      if (!has) s += '<div class="banner">' + icon("info") + "<span>Enter a cap for anyone who can't pay an equal share. The proposed split shows here before anything is final.</span></div>";
      else if (S.agreed) s += '<div class="banner">' + icon("check") + '<div class="grow"><span>Marked as agreed by the group.</span><button class="btn ghost small" type="button" data-act="reopen">Reopen</button></div></div>';
      else s += '<div class="banner warn">' + icon("info") + '<div class="grow"><span>This is only a proposal. Send it to the group first and finalise once everyone agrees.</span><button class="btn small" type="button" data-act="agree">Everyone agreed, finalise</button></div></div>';
    }
    if (!res.ok || c.empty) return s + '<p class="empty">' + (c.empty ? "Add an expense to see the split." : esc(res.errors.join(" "))) + "</p>";
    s += '<section class="card"><h3>Split preview</h3><p class="sub" style="margin-top:-6px">Total trip cost ' + rs(res.total) + "</p>" +
      '<div class="table"><table><thead><tr><th>Member</th><th>Fair share</th><th>Spent</th><th>Given</th><th>Received</th><th>Balance</th></tr></thead><tbody>' +
      S.members.map(function (m) {
        var n = res.net[m];
        return "<tr><td>" + esc(m) + "</td><td>" + rs(res.shares[m]) + "</td><td>" + rs(res.paid[m]) + "</td><td>" + rs(res.given[m]) + "</td><td>" + rs(res.received[m]) + '</td><td><span class="pill ' + (n > 0 ? "gets" : n < 0 ? "pays" : "even") + '">' + (n > 0 ? "+" : n < 0 ? "−" : "") + rs(Math.abs(n)) + "</span></td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<p class="foot">Balance = spent + given − received − fair share. Plus means the group owes them.</p></section>' +
      '<section class="card"><h3>' + (caps ? "Equal vs proposed share" : "Fair share per person") + "</h3>" + chartShares(c) + "</section>";
    return s;
  }
  function vStudio(c) {
    var caps = S.mode === "caps";
    var rows = caps ? '<section class="card"><h3>Set affordability caps (optional)</h3><p class="sub" style="margin-top:-6px">Any member can set the most they can pay. The rest is spread equally over the others.</p>' +
      S.members.map(function (m, i) {
        var v = typeof S.caps[m] === "number" ? String(S.caps[m] / 100) : "";
        return '<div class="caprow">' + who(m) + '<input data-cap="' + i + '" inputmode="decimal" placeholder="Max amount (₹)" value="' + esc(v) + '" aria-label="Cap for ' + esc(m) + '" autocomplete="off"></div>';
      }).join("") + msgLine("cap") + "</section>" : "";
    return '<div><h1>Fair Share Studio</h1><p class="sub">Choose how you want to split the trip cost.</p></div>' +
      '<div class="seg" role="group" aria-label="Split mode" style="max-width:30rem"><button type="button" data-mode="equal" aria-pressed="' + !caps + '">Equal Split</button><button type="button" data-mode="caps" aria-pressed="' + caps + '">Equal with Caps</button></div>' +
      rows + '<div id="studioOut" class="main" style="padding:0;gap:18px">' + studioOut(c) + "</div>";
  }

  function vSettle(c) {
    var res = c.res, head = '<div><h1>Settlement Plan</h1><p class="sub">Minimum number of payments to settle everyone.</p></div>';
    if (c.empty || !res.ok) return head + '<section class="card"><p class="empty">' + (c.empty ? "Add members and an expense to see who pays whom." : esc(res.errors.join(" "))) + "</p></section>";
    var pays = res.payments.map(function (p) { return Object.assign({}, p); });
    var moving = sum(pays, function (p) { return p.amount; });
    var people = {}; pays.forEach(function (p) { people[p.from] = 1; people[p.to] = 1; });
    var left = '<div class="pane"><h3>Overview</h3><div class="mini">' +
      "<div><small>Payments</small><b>" + pays.length + "</b></div>" +
      "<div><small>Money moving</small><b>" + rsShort(moving) + "</b></div>" +
      "<div><small>People involved</small><b>" + Object.keys(people).length + "</b></div></div>" +
      (pays.length ? "<h3>Money flow</h3>" + chartFlow(pays) : '<p class="empty">Nothing to move, everyone is even.</p>') + "</div>";
    var right = '<div class="pane"><h3>Payments</h3>' + (pays.length ? "<div>" + pays.map(function (p, i) {
      return '<div class="pay"><span class="count">' + (i + 1) + "</span>" + who(p.from) + '<span class="arrow">' + icon("arrowr") + "</span>" + who(p.to) + '<span class="amt">' + rs(p.amount) + "</span></div>";
    }).join("") + "</div>" : '<p class="empty">Everyone is already even.</p>') + "</div>";
    var notes = "";
    if (FS.capsChangedShares(summaryState(), c) && !S.agreed) notes += '<div class="banner warn">' + icon("info") + "<span>These payments use proposed affordability caps that the group has not agreed to yet. Finalise them in Fair Share Studio.</span></div>";
    notes += '<div class="banner">' + icon("check") + "<span>" + (pays.length ? "<b>Plan ready.</b> This is the fewest payments that settle everyone." : "<b>All even.</b> Nobody needs to pay anyone.") + "</span></div>";
    return head + '<section class="card"><div class="split">' + left + right + "</div></section>" + notes;
  }

  function vShare(c) {
    var head = '<div><h1>Share summary</h1><p class="sub">One clear message for your group. Copy it anywhere, or send it straight to WhatsApp. Nobody else needs the app.</p></div>';
    if (c.empty || !c.res.ok) return head + '<section class="card"><p class="empty">' + (c.empty ? "Add at least two members and an expense, then your message appears here." : esc(c.res.errors.join(" "))) + "</p></section>";
    var wa = S.sumFmt === "whatsapp", fmtKind = wa ? "whatsapp" : "plain";
    var text = summaryText(c, fmtKind);
    ui.summaryBase = text;
    if (ui.edit && ui.edit.fmt === fmtKind && ui.edit.base === text) text = ui.edit.text; else ui.edit = null;
    var res = c.res, o = S.sumOpts, si = FS.shareInfo(summaryState(), c), rem = reminders(c);
    ui.remind = rem;
    var stats = '<div class="grid g3"><div class="card kpi"><small>Total spent</small><span class="big">' + rs(res.total) + '</span></div><div class="card kpi"><small>Fair share</small><span class="big">' + (si.even ? rs(si.each) : "Varies") + '</span></div><div class="card kpi"><small>Payments to make</small><span class="big">' + res.payments.length + "</span></div></div>";
    var opt = function (k, label) { return '<label class="chip' + (o[k] ? " on" : "") + '"><input type="checkbox" data-opt="' + k + '"' + (o[k] ? " checked" : "") + "> " + label + "</label>"; };
    var fmtSeg = '<div class="seg" role="group" aria-label="Message style"><button type="button" data-fmt="plain" aria-pressed="' + !wa + '">General</button><button type="button" data-fmt="whatsapp" aria-pressed="' + wa + '">WhatsApp style</button></div>';
    var canShare = typeof navigator.share === "function";
    var preview = wa ? '<div class="chatbg"><div class="bubble" id="preview">' + waHtml(text) + "</div></div>" : '<div class="paper" id="preview">' + esc(text) + "</div>";
    return head + stats +
      '<div class="grid g2" style="align-items:start"><section class="card"><h3>Message</h3>' + fmtSeg + '<div class="chips">' + opt("list", "List every expense and transfer") + opt("balances", "Show where everyone stands") + "</div>" +
      '<textarea id="summary" class="msgbox" aria-label="Summary message" spellcheck="false" rows="' + Math.min(34, text.split("\n").length + 1) + '">' + esc(text) + "</textarea>" +
      '<p class="foot">' + (wa ? "WhatsApp style adds *bold* and _italic_ markers and emoji. You can edit the text before sending." : "Plain text that works in any app. You can edit it before sending. The WhatsApp button always sends the WhatsApp style version.") + "</p>" +
      '<div class="row"><button class="btn ghost" type="button" data-act="copy">' + icon("copy") + "Copy summary</button>" +
      (canShare ? '<button class="btn ghost" type="button" data-act="nativeShare">' + icon("arrowr") + "Share…</button>" : "") +
      '<a class="btn" id="wa" target="_blank" rel="noopener" href="' + waLink(waShareText(c, text)) + '">' + icon("chat") + "Share on WhatsApp</a></div>" +
      '<p class="foot">If WhatsApp says the message is too long, use Copy and paste it into the chat.</p></section>' +
      '<section class="card"><h3>Preview</h3>' + preview + "</section></div>" +
      (rem.length ? '<section class="card"><h3>Personal reminders</h3><p class="sub" style="margin-top:-6px">A short nudge for each person who has to pay, if you prefer messaging them one by one.</p><ul class="list">' + rem.map(function (r, i) {
        return '<li class="li">' + avatar(r.m, true) + '<div class="mid"><b>' + esc(r.m) + "</b><small>pays " + rs(r.total) + '</small></div><button class="btn ghost small" type="button" data-act="copyRem" data-i="' + i + '">Copy</button><a class="btn small" target="_blank" rel="noopener" href="' + waLink(r.text) + '">WhatsApp</a></li>';
      }).join("") + "</ul></section>" : "");
  }
  // The WhatsApp button always sends the WhatsApp-style text (edited version when that tab is open).
  function waShareText(c, current) { return S.sumFmt === "whatsapp" ? current : summaryText(c, "whatsapp"); }

  var VIEWS = { dashboard: vDashboard, tx: vTx, members: vMembers, studio: vStudio, settle: vSettle, share: vShare };
  function render() {
    var c = calc();
    renderNav();
    $("main").innerHTML = (VIEWS[S.view] || vDashboard)(c);
    if (ui.editTrip && $("tripInput")) $("tripInput").focus();
  }
  function go(v) { S.view = v; ui.editTrip = false; save(); render(); window.scrollTo(0, 0); }

  // ---------- toast ----------
  var toastTimer, undo = null;
  function toast(text, undoFn) {
    var t = $("toast"); t.innerHTML = "<span>" + esc(text) + "</span>" + (undoFn ? '<button type="button" id="undoBtn">Undo</button>' : "");
    t.hidden = false; undo = undoFn || null; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; undo = null; }, 5000);
  }
  function hideToast() { clearTimeout(toastTimer); $("toast").hidden = true; undo = null; }
  $("toast").addEventListener("click", function (e) { if (e.target.id === "undoBtn" && undo) { undo(); hideToast(); } });

  // ---------- clipboard ----------
  // Modern clipboard API first; falls back to a hidden textarea where it is unavailable (some file:// or http setups).
  function copyText(text) {
    return new Promise(function (resolve, reject) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(resolve, function () { legacy(); });
      } else legacy();
      function legacy() {
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
        document.body.appendChild(ta); ta.select();
        var ok = false; try { ok = document.execCommand("copy"); } catch (x) {}
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error("copy failed"));
      }
    });
  }
  function flash(btn, text) { var o = btn.innerHTML; btn.textContent = text; setTimeout(function () { if (btn.isConnected) btn.innerHTML = o; }, 1600); }

  // ---------- events ----------
  function hasData() { return S.members.length || S.expenses.length || S.transfers.length || S.trip; }
  function loadSample() {
    if (hasData() && !window.confirm("Replace what you have entered with the sample trip?")) return;
    S = demo(); ui.edit = null; hideToast(); save(); render();
  }
  function refreshTxList() {
    var box = $("txList"); if (box) box.innerHTML = txList();
    Array.prototype.forEach.call(document.querySelectorAll("[data-filter]"), function (b) { b.classList.toggle("on", b.dataset.filter === S.txFilter); });
  }
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-go],[data-act],[data-kind],[data-mode],[data-filter],[data-fmt]");
    if (!el) return;
    var d = el.dataset;
    if (d.go) { if (d.kind) S.txKind = d.kind; if (d.mode) { S.mode = d.mode; } go(d.go); return; }
    if (d.kind) { S.txKind = d.kind; save(); render(); return; }
    if (d.mode) { S.mode = d.mode; save(); render(); return; }
    if (d.fmt) { S.sumFmt = d.fmt === "whatsapp" ? "whatsapp" : "plain"; save(); render(); return; }
    if (d.filter) { S.txFilter = d.filter; save(); refreshTxList(); return; }
    if (d.act === "editTrip") { ui.editTrip = true; S.view = "dashboard"; save(); render(); }
    else if (d.act === "demo" || d.act === "loadDemo") loadSample();
    else if (d.act === "agree") { S.agreed = true; save(); render(); }
    else if (d.act === "reopen") { S.agreed = false; save(); render(); }
    else if (d.act === "copy") copyText($("summary").value).then(function () { flash(el, "Copied"); }, function () { $("summary").select(); flash(el, "Press Ctrl+C"); });
    else if (d.act === "nativeShare") {
      var txt = $("summary").value;
      try { navigator.share({ title: (S.trip || "Trip settlement"), text: txt }).catch(function () {}); } catch (x) {}
    }
    else if (d.act === "copyRem") { var r = ui.remind && ui.remind[Number(d.i)]; if (r) copyText(r.text).then(function () { flash(el, "Copied"); }, function () { flash(el, "Copy failed"); }); }
    else if (d.act === "del") {
      var list = d.t === "e" ? S.expenses : S.transfers, i = list.findIndex(function (x) { return x.id === Number(d.id); });
      if (i < 0) return;
      var item = list.splice(i, 1)[0]; touch(); render();
      toast("Entry deleted", function () { list.splice(Math.min(i, list.length), 0, item); touch(); render(); });
    } else if (d.act === "delMember") {
      var m = d.m, uses = S.expenses.filter(function (x) { return x.paidBy === m || x.sharedBy.indexOf(m) >= 0; }).length + S.transfers.filter(function (t) { return t.from === m || t.to === m; }).length;
      if (uses) return setMsg("members", m + " is part of " + uses + " entries. Delete those first.");
      S.members.splice(S.members.indexOf(m), 1); delete S.caps[m]; touch(); setMsg("members", ""); render();
    }
  });
  document.addEventListener("submit", function (e) {
    e.preventDefault();
    var id = e.target.id;
    if (id === "tripForm") { S.trip = $("tripInput").value.trim(); ui.editTrip = false; touch(); render(); }
    else if (id === "memberForm") {
      var name = $("memberName").value.trim().replace(/\s+/g, " ");
      if (!name) return setMsg("members", "Type a name first.");
      if (name in {}) return setMsg("members", "Please pick a different name.");
      if (S.members.some(function (m) { return m.toLowerCase() === name.toLowerCase(); })) return setMsg("members", name + " is already added.");
      S.members.push(name); setMsg("members", ""); touch(); render(); $("memberName").focus();
    } else if (id === "expForm") {
      var amt = FF.toPaise($("eAmount").value);
      var shared = Array.prototype.map.call(document.querySelectorAll("#eShare input:checked"), function (c) { return c.value; });
      if (S.members.length < 2) return setMsg("tx", "Add at least two members first.");
      if (!(amt > 0)) return setMsg("tx", "Enter the amount as a number, like 1342 or 250.50.");
      if (!shared.length) return setMsg("tx", "Tick at least one person who shares this.");
      S.expenses.push({ id: S.nid++, title: $("eTitle").value.trim() || "Expense", amount: amt, paidBy: $("ePaid").value, sharedBy: shared, date: today() });
      setMsg("tx", ""); touch(); render(); toast("Expense saved");
    } else if (id === "trForm") {
      var ta = FF.toPaise($("tAmount").value), from = $("tFrom").value, to = $("tTo").value;
      if (S.members.length < 2) return setMsg("tx", "Add at least two members first.");
      if (!(ta > 0)) return setMsg("tx", "Enter the amount as a number, like 200.");
      if (from === to) return setMsg("tx", "Pick two different people.");
      S.transfers.push({ id: S.nid++, from: from, to: to, amount: ta, note: $("tNote").value.trim(), date: today() });
      setMsg("tx", ""); touch(); render(); toast("Transfer saved");
    }
  });
  document.addEventListener("change", function (e) {
    if (e.target.dataset && e.target.dataset.opt) { S.sumOpts[e.target.dataset.opt] = e.target.checked; save(); render(); return; }
    if (e.target.name === "share") e.target.closest(".chip").classList.toggle("on", e.target.checked);
  });
  document.addEventListener("input", function (e) {
    var el = e.target;
    if (el.dataset && el.dataset.cap !== undefined) {
      var m = S.members[Number(el.dataset.cap)], raw = el.value.trim();
      if (raw === "") delete S.caps[m];
      else { var p = FF.toPaise(raw); if (isNaN(p)) return setMsg("cap", "Enter the cap as a number, like 150."); S.caps[m] = p; }
      setMsg("cap", ""); S.agreed = false; save();
      $("studioOut").innerHTML = studioOut(calc());
    } else if (el.id === "summary") {
      var kind = S.sumFmt === "whatsapp" ? "whatsapp" : "plain";
      ui.edit = { fmt: kind, base: ui.summaryBase, text: el.value };
      if (kind === "whatsapp") $("preview").innerHTML = waHtml(el.value); else $("preview").textContent = el.value;
      if (kind === "whatsapp") $("wa").href = waLink(el.value);
    }
  });

  render();
})();
