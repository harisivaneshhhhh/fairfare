// Run: node test.js
const assert = require("assert");
const E = require("./engine.js");
const R = (x) => Math.round(x * 100); // rupees -> paise for readable tests

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log("  ok  ", name); }
  catch (e) { console.log("  FAIL", name, "\n      ", e.message); process.exitCode = 1; }
};

// After applying the payments, every balance must be exactly zero.
function assertSettles(res) {
  const bal = { ...res.net };
  for (const p of res.payments) { bal[p.from] += p.amount; bal[p.to] -= p.amount; }
  for (const [m, v] of Object.entries(bal)) assert.strictEqual(v, 0, `${m} not settled (${v})`);
  assert.strictEqual(Object.values(res.net).reduce((a, b) => a + b, 0), 0, "nets must sum to 0");
  assert.strictEqual(Object.values(res.shares).reduce((a, b) => a + b, 0), res.total, "shares must sum to total");
}

console.log("FairFare engine tests");

test("one payer, three friends, equal", () => {
  const r = E.settle({
    members: ["A", "B", "C"],
    expenses: [{ title: "Hotel", amount: R(300), paidBy: "A", sharedBy: ["A", "B", "C"] }],
    transfers: [], mode: "equal",
  });
  assert.ok(r.ok); assertSettles(r);
  assert.deepStrictEqual(r.payments.map((p) => `${p.from}>${p.to}:${p.amount}`).sort(), ["B>A:10000", "C>A:10000"]);
});

test("expense shared by a subset only", () => {
  const r = E.settle({
    members: ["A", "B", "C"],
    expenses: [{ title: "Beer", amount: R(100), paidBy: "A", sharedBy: ["A", "B"] }],
    transfers: [], mode: "equal",
  });
  assert.deepStrictEqual(r.payments, [{ from: "B", to: "A", amount: R(50) }]);
});

test("transfer: advance cash to organiser reduces what giver owes", () => {
  // K pays 600 for all three; H gave K 200 in advance. Share=200 each.
  // H: gave 200, share 200 -> net 0. L owes 200. K net = 600-200... K received 200.
  const r = E.settle({
    members: ["K", "H", "L"],
    expenses: [{ title: "Trip", amount: R(600), paidBy: "K", sharedBy: ["K", "H", "L"] }],
    transfers: [{ from: "H", to: "K", amount: R(200) }], mode: "equal",
  });
  assertSettles(r);
  assert.deepStrictEqual(r.payments, [{ from: "L", to: "K", amount: R(200) }]);
});

test("passed-along money (H->M 200, M->Hari 200) nets out for the middleman", () => {
  const r = E.settle({
    members: ["K", "H", "M", "Hari"],
    expenses: [{ title: "Trip", amount: R(400), paidBy: "K", sharedBy: ["K", "H", "M", "Hari"] }],
    transfers: [
      { from: "H", to: "M", amount: R(200) },
      { from: "M", to: "Hari", amount: R(200) },
    ], mode: "equal",
  });
  assertSettles(r);
  assert.strictEqual(r.net.M, -R(100)); // middleman unchanged: still owes his own share
  assert.strictEqual(r.net.H, R(200) - R(100));
  assert.strictEqual(r.net.Hari, -R(200) - R(100));
});

test("paise rounding: 1736 / 6 = 289.33 and shares sum exactly", () => {
  const m = ["Kamesh", "Haswin", "Santhosh", "Mukesh", "Hari", "Mathi"];
  const r = E.settle({
    members: m,
    expenses: [
      { title: "a", amount: R(1342), paidBy: "Kamesh", sharedBy: m },
      { title: "b", amount: R(254), paidBy: "Hari", sharedBy: m },
      { title: "c", amount: R(140), paidBy: "Mathi", sharedBy: m },
    ], transfers: [], mode: "equal",
  });
  assert.strictEqual(r.total, 173600);
  for (const v of Object.values(r.shares)) assert.ok(v === 28933 || v === 28934);
  assertSettles(r);
});

test("caps: one capped person, others absorb shortfall equally", () => {
  const r = E.settle({
    members: ["A", "B", "C"],
    expenses: [{ title: "x", amount: R(900), paidBy: "A", sharedBy: ["A", "B", "C"] }],
    transfers: [], mode: "caps", caps: { C: R(100) },
  });
  assert.deepStrictEqual(r.shares, { A: R(400), B: R(400), C: R(100) });
  assertSettles(r);
  assert.deepStrictEqual(r.payments.map((p) => `${p.from}>${p.to}`).sort(), ["B>A", "C>A"]);
});

test("caps: cascade (a second person hits their cap after the first)", () => {
  const r = E.settle({
    members: ["A", "B", "C", "D"],
    expenses: [{ title: "x", amount: R(1000), paidBy: "A", sharedBy: ["A", "B", "C", "D"] }],
    transfers: [], mode: "caps", caps: { A: R(100), B: R(280) },
  });
  assert.deepStrictEqual(r.shares, { A: R(100), B: R(280), C: R(310), D: R(310) });
  assertSettles(r);
});

test("caps: a cap above the equal share changes nothing", () => {
  const r = E.settle({
    members: ["A", "B"],
    expenses: [{ title: "x", amount: R(100), paidBy: "A", sharedBy: ["A", "B"] }],
    transfers: [], mode: "caps", caps: { B: R(500) },
  });
  assert.deepStrictEqual(r.shares, { A: R(50), B: R(50) });
});

test("caps: impossible caps return a friendly error", () => {
  const r = E.settle({
    members: ["A", "B"],
    expenses: [{ title: "x", amount: R(1000), paidBy: "A", sharedBy: ["A", "B"] }],
    transfers: [], mode: "caps", caps: { A: R(100), B: R(100) },
  });
  assert.strictEqual(r.ok, false);
  assert.match(r.errors[0], /caps/i);
});

test("fewest payments: two independent pairs need 2, not 3", () => {
  // nets: A +6, B +4, C -6, D -4  (A<-C and B<-D)
  const pay = E.minimalSettle({ A: 600, B: 400, C: -600, D: -400 });
  assert.strictEqual(pay.length, 2);
});

test("fewest payments: finds zero-sum subgroups greedy could miss", () => {
  // +3,+3,+4 vs -5,-5 ... plus a hidden pair: +10/-10 should be 1 payment
  const nets = { A: 1000, B: -1000, C: 300, D: 300, E: 400, F: -500, G: -500 };
  const pay = E.minimalSettle(nets);
  assert.strictEqual(pay.length, 1 + 4); // A-B (1) + 5 people in the other group (4)
});

test("validation catches bad input", () => {
  const r = E.settle({
    members: ["A", "B"],
    expenses: [{ title: "x", amount: 0, paidBy: "Z", sharedBy: [] }],
    transfers: [{ from: "A", to: "A", amount: 5 }],
  });
  assert.strictEqual(r.ok, false);
  assert.ok(r.errors.length >= 3);
});

test("worked example from the idea's origin (advances back-solved from expected output)", () => {
  const m = ["Kamesh", "Haswin", "Santhosh", "Mukesh", "Hari", "Mathi"];
  const r = E.settle({
    members: m,
    expenses: [
      { title: "Kamesh bills", amount: R(1342), paidBy: "Kamesh", sharedBy: m },
      { title: "Hari bills", amount: R(254), paidBy: "Hari", sharedBy: m },
      { title: "Mathi bills", amount: R(140), paidBy: "Mathi", sharedBy: m },
    ],
    transfers: [
      { from: "Haswin", to: "Kamesh", amount: R(200) },
      { from: "Santhosh", to: "Kamesh", amount: R(300) },
      { from: "Hari", to: "Kamesh", amount: R(200) },
      { from: "Mathi", to: "Kamesh", amount: R(250) },
      { from: "Haswin", to: "Mukesh", amount: R(200) },
      { from: "Mukesh", to: "Hari", amount: R(200) },
    ],
    mode: "equal",
  });
  assertSettles(r);
  assert.strictEqual(r.payments.length, 5);
  const expected = { "Mukesh>Haswin": 11067, "Mukesh>Kamesh": 10267, "Mukesh>Mathi": 7600, "Hari>Mathi": 2467, "Hari>Santhosh": 1066 };
  for (const p of r.payments) {
    const want = expected[`${p.from}>${p.to}`];
    assert.ok(want !== undefined, `unexpected payment ${p.from}>${p.to}`);
    assert.ok(Math.abs(p.amount - want) <= 1, `${p.from}>${p.to}: got ${p.amount}, want ${want} (+-1 paisa)`);
  }
});

test("random fuzz: always settles to exactly zero, never more than n-1 payments", () => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let iter = 0; iter < 500; iter++) {
    const n = 2 + Math.floor(rnd() * 7);
    const members = Array.from({ length: n }, (_, i) => "P" + i);
    const pick = () => members[Math.floor(rnd() * n)];
    const expenses = Array.from({ length: 1 + Math.floor(rnd() * 5) }, () => {
      const shared = members.filter(() => rnd() > 0.3);
      return { title: "e", amount: 1 + Math.floor(rnd() * 500000), paidBy: pick(), sharedBy: shared.length ? shared : [members[0]] };
    });
    const transfers = Array.from({ length: Math.floor(rnd() * 4) }, () => {
      let a = pick(), b = pick(); if (a === b) b = members[(members.indexOf(a) + 1) % n];
      return { from: a, to: b, amount: 1 + Math.floor(rnd() * 100000) };
    });
    const r = E.settle({ members, expenses, transfers, mode: "equal" });
    assert.ok(r.ok, JSON.stringify(r.errors));
    assertSettles(r);
    assert.ok(r.payments.length <= n - 1);
  }
});

test("toPaise: accepts normal money text, rejects junk", () => {
  assert.strictEqual(E.toPaise("289.33"), 28933);
  assert.strictEqual(E.toPaise("1,342"), 134200);
  assert.strictEqual(E.toPaise("₹250.5"), 25050);
  assert.strictEqual(E.toPaise("250."), 25000);
  assert.strictEqual(E.toPaise(".5"), 50);
  assert.strictEqual(E.toPaise(0), 0);
  for (const bad of ["", "abc", "-5", "1.234", "1e5", "12 34", "99999999999999999"]) assert.ok(Number.isNaN(E.toPaise(bad)), `"${bad}" should be invalid`);
});

test("fmt: Indian grouping and paise padding", () => {
  assert.strictEqual(E.fmt(28933), "289.33");
  assert.strictEqual(E.fmt(100000), "1,000.00");
  assert.strictEqual(E.fmt(5), "0.05");
  assert.strictEqual(E.fmt(-12050), "-120.50");
});

test("reserved member names (constructor, __proto__) are rejected", () => {
  for (const bad of ["constructor", "__proto__", "toString"]) {
    const r = E.settle({ members: ["A", bad], expenses: [], transfers: [], mode: "equal" });
    assert.strictEqual(r.ok, false, bad);
  }
});

test("a member who shares nothing owes nothing and settles to zero", () => {
  const r = E.settle({
    members: ["A", "B", "C"],
    expenses: [{ title: "x", amount: R(90), paidBy: "A", sharedBy: ["A", "B"] }],
    transfers: [], mode: "equal",
  });
  assertSettles(r);
  assert.strictEqual(r.shares.C, 0);
  assert.strictEqual(r.net.C, 0);
});

test("transfers alone (no expenses) still produce a settlement", () => {
  const r = E.settle({ members: ["A", "B"], expenses: [], transfers: [{ from: "A", to: "B", amount: R(100) }], mode: "equal" });
  assert.ok(r.ok);
  assert.deepStrictEqual(r.payments, [{ from: "B", to: "A", amount: R(100) }]);
});

test("caps fuzz: shares sum to total, nobody above their cap, nobody negative, always settles", () => {
  let seed = 777;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let solved = 0;
  for (let it = 0; it < 1500; it++) {
    const n = 2 + Math.floor(rnd() * 6);
    const members = Array.from({ length: n }, (_, i) => "P" + i);
    const expenses = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => {
      const sh = members.filter(() => rnd() > 0.25);
      return { title: "e", amount: 1 + Math.floor(rnd() * 300000), paidBy: members[Math.floor(rnd() * n)], sharedBy: sh.length ? sh : [members[0]] };
    });
    const caps = {};
    members.forEach((m) => { if (rnd() < 0.5) caps[m] = Math.floor(rnd() * 120000); });
    const r = E.settle({ members, expenses, transfers: [], mode: "caps", caps });
    if (!r.ok) { assert.match(r.errors[0], /caps/i); continue; }
    solved++;
    assertSettles(r);
    for (const m of members) {
      assert.ok(r.shares[m] >= 0, `${m} negative`);
      if (m in caps) assert.ok(r.shares[m] <= caps[m], `${m} over cap`);
    }
  }
  assert.ok(solved > 500);
});

// ---------- summary text ----------
const S = require("./summary.js");
const trip = () => {
  const m = ["Kamesh", "Haswin", "Santhosh"];
  const state = {
    trip: "Goa", members: m, mode: "equal", caps: {}, agreed: false, sumOpts: { list: true, balances: true },
    expenses: [{ title: "Food", amount: R(900), paidBy: "Kamesh", sharedBy: m.slice() }],
    transfers: [{ from: "Haswin", to: "Kamesh", amount: R(100), note: "Advance" }],
  };
  const eq = E.settle(Object.assign({}, state, { mode: "equal" }));
  const res = state.mode === "caps" ? E.settle(state) : eq;
  return { state, c: { eq, res } };
};

test("summary: general format has no WhatsApp markers or emoji", () => {
  const { state, c } = trip();
  const txt = S.build(state, c, "plain");
  assert.ok(!/[*_]/.test(txt), "no * or _ markers in general text");
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u2705\u26A0]/u.test(txt), "no emoji in general text");
  assert.match(txt, /Goa – Trip Settlement/);
  assert.match(txt, /Fair share: ₹300\.00 each/);
  assert.match(txt, /Payments to make \(\d\)/);
});

test("summary: WhatsApp format uses * bold and _ italic placeholders", () => {
  const { state, c } = trip();
  const txt = S.build(state, c, "whatsapp");
  assert.match(txt, /\*Goa – Trip Settlement\*/);
  assert.match(txt, /Total spent: \*₹900\.00\*/);
  assert.match(txt, /Fair share: \*₹300\.00\* each/);
  assert.match(txt, /\*Payments to make \(\d\)\*/);
  assert.match(txt, /reply \*done\*/);
  assert.match(txt, /_Fewest possible payments/);
  assert.match(S.waHtml(txt), /<b>Goa – Trip Settlement<\/b>/);
});

test("summary: both formats carry the same payments", () => {
  const { state, c } = trip();
  const nums = (t) => t.split("\n").filter((l) => /^\d+\. /.test(l)).map((l) => l.replace(/\*/g, ""));
  assert.deepStrictEqual(nums(S.build(state, c, "plain")), nums(S.build(state, c, "whatsapp")));
});

test("summary: uneven shares from subset expenses are NOT blamed on caps", () => {
  const m = ["A", "B", "C"];
  const state = { trip: "T", members: m, mode: "equal", caps: {}, agreed: false, sumOpts: { list: false, balances: false },
    expenses: [{ title: "Beer", amount: R(100), paidBy: "A", sharedBy: ["A", "B"] }, { title: "Taxi", amount: R(60), paidBy: "C", sharedBy: m }], transfers: [] };
  const eq = E.settle(state);
  const txt = S.build(state, { eq, res: eq }, "plain");
  assert.match(txt, /who shared what/);
  assert.ok(!/cap/i.test(txt));
});

test("summary: caps note only appears when caps really change the split", () => {
  const m = ["A", "B", "C"];
  const base = { trip: "T", members: m, mode: "caps", agreed: false, sumOpts: { list: false, balances: false },
    expenses: [{ title: "x", amount: R(900), paidBy: "A", sharedBy: m }], transfers: [] };
  const noCap = Object.assign({}, base, { caps: {} });
  const eq0 = E.settle(Object.assign({}, noCap, { mode: "equal" }));
  assert.ok(!/cap/i.test(S.build(noCap, { eq: eq0, res: E.settle(noCap) }, "plain")));
  const withCap = Object.assign({}, base, { caps: { C: R(100) } });
  const txt = S.build(withCap, { eq: eq0, res: E.settle(withCap) }, "plain");
  assert.match(txt, /affordability caps/);
  assert.match(txt, /C: ₹100\.00 \(their cap\)/);
});

test("summary: reminders group payments per person", () => {
  const { state, c } = trip();
  const rem = S.reminders(state, c);
  assert.ok(rem.length >= 1);
  for (const r of rem) assert.match(r.text, /^Hi /);
});

test("summary: waHtml escapes HTML in names", () => {
  assert.ok(!S.waHtml("*<img src=x onerror=1>*").includes("<img"));
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
