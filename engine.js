// FairFare engine: pure functions, no DOM. All money is integer PAISE.
// Works in the browser (window.FairFare) and in Node (module.exports).
(function (root) {
  "use strict";

  // ---------- helpers ----------
  const gcd = (a, b) => (b === 0n ? a : gcd(b, a % b));
  const lcm = (a, b) => (a / gcd(a, b)) * b;

  /** Format paise as rupees: 28933 -> "289.33", 100000 -> "1,000.00" */
  function fmt(paise) {
    const neg = paise < 0;
    const p = Math.abs(paise);
    const rs = Math.floor(p / 100).toLocaleString("en-IN");
    const ps = String(p % 100).padStart(2, "0");
    return (neg ? "-" : "") + rs + "." + ps;
  }

  /**
   * Parse "289.33", 289.33, "1,342", "250." or "₹250" into paise (integer).
   * Returns NaN if invalid (negative, more than 2 decimals, letters, too large).
   */
  function toPaise(rupees) {
    const s = String(rupees).trim().replace(/^₹\s*/, "").replace(/,/g, "");
    if (!/^(\d+\.?\d{0,2}|\.\d{1,2})$/.test(s)) return NaN;
    const [r = "", p = ""] = s.split(".");
    const paise = Number(r || "0") * 100 + Number((p + "00").slice(0, 2));
    return Number.isSafeInteger(paise) && paise <= 1e13 ? paise : NaN;
  }

  // ---------- validation ----------
  function validate(state) {
    const errors = [];
    const members = state.members || [];
    const set = new Set(members);
    if (members.some((m) => typeof m !== "string" || !m.trim())) errors.push("Every member needs a name.");
    // Names such as "constructor" or "__proto__" collide with built-in object keys.
    if (members.some((m) => typeof m === "string" && m in {})) errors.push("Please choose a different member name (reserved word).");
    if (set.size !== members.length) errors.push("Duplicate member names.");
    if (members.length < 2) errors.push("Add at least 2 members.");
    const isAmt = (n) => Number.isInteger(n) && n > 0;

    (state.expenses || []).forEach((e, i) => {
      const tag = `Expense #${i + 1} (${e.title || "untitled"})`;
      if (!isAmt(e.amount)) errors.push(`${tag}: amount must be a positive number.`);
      if (!set.has(e.paidBy)) errors.push(`${tag}: unknown payer "${e.paidBy}".`);
      if (!e.sharedBy || e.sharedBy.length === 0) errors.push(`${tag}: nobody shares it.`);
      else if (e.sharedBy.some((m) => !set.has(m))) errors.push(`${tag}: unknown member in "shared by".`);
      else if (new Set(e.sharedBy).size !== e.sharedBy.length) errors.push(`${tag}: duplicate in "shared by".`);
    });
    (state.transfers || []).forEach((t, i) => {
      const tag = `Transfer #${i + 1}`;
      if (!isAmt(t.amount)) errors.push(`${tag}: amount must be a positive number.`);
      if (!set.has(t.from) || !set.has(t.to)) errors.push(`${tag}: unknown member.`);
      if (t.from === t.to) errors.push(`${tag}: from and to are the same person.`);
    });
    for (const [m, c] of Object.entries(state.caps || {})) {
      if (!set.has(m)) errors.push(`Cap for unknown member "${m}".`);
      if (!Number.isInteger(c) || c < 0) errors.push(`Cap for ${m} must be zero or more.`);
    }
    return errors;
  }

  // ---------- step 1: equal shares (exact, then largest-remainder rounding) ----------
  /**
   * Each expense is split equally among its sharedBy. We sum the exact
   * fractions (using BigInt scaled by an LCM) and only round ONCE at the end,
   * so the 1-2 leftover paise land on the people with the biggest fractions
   * instead of always on the first member of every expense.
   * Returns { shares: {name: paise}, total }.
   */
  function equalShares(members, expenses) {
    let K = 1n;
    for (const e of expenses) K = lcm(K, BigInt(e.sharedBy.length));
    const scaled = Object.fromEntries(members.map((m) => [m, 0n]));
    let total = 0;
    for (const e of expenses) {
      total += e.amount;
      const each = (BigInt(e.amount) * K) / BigInt(e.sharedBy.length); // exact by LCM
      for (const m of e.sharedBy) scaled[m] += each;
    }
    const shares = {};
    const rem = [];
    let given = 0;
    members.forEach((m, idx) => {
      const base = Number(scaled[m] / K);
      shares[m] = base;
      given += base;
      rem.push({ m, idx, frac: scaled[m] % K });
    });
    let left = total - given; // < members.length
    rem.sort((a, b) => (a.frac === b.frac ? a.idx - b.idx : a.frac > b.frac ? -1 : 1));
    for (let i = 0; i < left; i++) shares[rem[i].m] += 1;
    return { shares, total };
  }

  // ---------- step 2: caps ----------
  /** Split `amount` paise equally across `names` (remainder to the first ones). */
  function splitInt(amount, names) {
    const out = {};
    const n = names.length;
    const base = Math.floor(amount / n);
    let r = amount - base * n;
    names.forEach((m) => {
      out[m] = base + (r > 0 ? 1 : 0);
      if (r > 0) r--;
    });
    return out;
  }

  /**
   * Equal-with-caps. Anyone whose equal share exceeds their cap pays exactly
   * their cap; the shortfall is spread EQUALLY over everyone else, and we
   * repeat because the extra can push another person over their own cap.
   * Throws if the caps can't cover the total.
   */
  function applyCaps(base, caps, total, members) {
    const locked = Object.create(null); // name -> cap paise
    const hasCap = (m) => Object.prototype.hasOwnProperty.call(caps, m);
    for (;;) {
      const unlocked = members.filter((m) => !(m in locked) && base[m] > 0);
      const lockedSum = Object.values(locked).reduce((a, b) => a + b, 0);
      const baseUnl = unlocked.reduce((a, m) => a + base[m], 0);
      const extra = total - lockedSum - baseUnl; // shortfall to spread
      if (unlocked.length === 0) {
        if (extra !== 0) throw new Error("The caps add up to less than the total spent. Raise a cap.");
        break;
      }
      const add = splitInt(extra, unlocked);
      const violators = unlocked.filter((m) => hasCap(m) && base[m] + add[m] > caps[m]);
      if (violators.length === 0) {
        const shares = {};
        members.forEach((m) => (shares[m] = m in locked ? locked[m] : base[m] > 0 ? base[m] + add[m] : 0));
        return shares;
      }
      violators.forEach((m) => (locked[m] = caps[m]));
    }
    const shares = {};
    members.forEach((m) => (shares[m] = m in locked ? locked[m] : 0));
    return shares;
  }

  // ---------- step 3: settlement ----------
  /** Greedy: biggest debtor pays biggest creditor. <= k-1 payments for k people. */
  function greedySettle(nets) {
    const cred = [], debt = [];
    for (const [m, v] of Object.entries(nets)) {
      if (v > 0) cred.push({ m, v });
      else if (v < 0) debt.push({ m, v: -v });
    }
    const payments = [];
    while (cred.length && debt.length) {
      cred.sort((a, b) => b.v - a.v);
      debt.sort((a, b) => b.v - a.v);
      const c = cred[0], d = debt[0];
      const amt = Math.min(c.v, d.v);
      payments.push({ from: d.m, to: c.m, amount: amt });
      c.v -= amt;
      d.v -= amt;
      if (c.v === 0) cred.shift();
      if (d.v === 0) debt.shift();
    }
    return payments;
  }

  /**
   * Fewest payments. A group of k people whose balances sum to zero can always
   * settle in k-1 payments, so the minimum is (#people owing/owed) - (max number
   * of zero-sum subgroups). We find that max partition with a bitmask DP
   * (exact up to 16 people), then settle each subgroup greedily.
   */
  function minimalSettle(nets) {
    const people = Object.keys(nets).filter((m) => nets[m] !== 0);
    const n = people.length;
    if (n === 0) return [];
    if (n > 16) return greedySettle(nets); // too big for exact; greedy is fine

    const N = 1 << n;
    const sums = new Float64Array(N);
    const dp = new Int16Array(N);
    const par = new Int8Array(N).fill(-1);
    for (let mask = 1; mask < N; mask++) {
      const low = 31 - Math.clz32(mask & -mask);
      sums[mask] = sums[mask & (mask - 1)] + nets[people[low]];
      let best = -1, arg = -1;
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) {
          const v = dp[mask ^ (1 << i)];
          if (v > best) { best = v; arg = i; }
        }
      }
      dp[mask] = best + (sums[mask] === 0 ? 1 : 0);
      par[mask] = arg;
    }
    // Rebuild the ordering, then cut it wherever the running total hits zero.
    const order = [];
    for (let mask = N - 1; mask > 0; mask ^= 1 << par[mask]) order.push(par[mask]);
    order.reverse();
    const groups = [];
    let cur = {}, run = 0;
    for (const i of order) {
      cur[people[i]] = nets[people[i]];
      run += nets[people[i]];
      if (run === 0) { groups.push(cur); cur = {}; }
    }
    return groups.flatMap(greedySettle);
  }

  // ---------- main entry ----------
  /**
   * state = { members:[name], expenses:[{title,amount,paidBy,sharedBy:[name]}],
   *           transfers:[{from,to,amount}], mode:"equal"|"caps", caps:{name:paise} }
   * Returns { ok, errors, total, shares, paid, given, received, net, payments }
   */
  function settle(state) {
    const errors = validate(state);
    if (errors.length) return { ok: false, errors };

    const { members } = state;
    const expenses = state.expenses || [];
    const transfers = state.transfers || [];
    const { shares: equal, total } = equalShares(members, expenses);

    let shares = equal;
    if (state.mode === "caps") {
      try {
        shares = applyCaps(equal, state.caps || {}, total, members);
      } catch (e) {
        return { ok: false, errors: [e.message] };
      }
    }

    const zero = () => Object.fromEntries(members.map((m) => [m, 0]));
    const paid = zero(), given = zero(), received = zero(), net = zero();
    expenses.forEach((e) => (paid[e.paidBy] += e.amount));
    transfers.forEach((t) => { given[t.from] += t.amount; received[t.to] += t.amount; });
    members.forEach((m) => (net[m] = paid[m] + given[m] - received[m] - shares[m]));

    const payments = minimalSettle(net);
    return { ok: true, errors: [], total, equalShares: equal, shares, paid, given, received, net, payments };
  }

  const api = { settle, validate, equalShares, applyCaps, minimalSettle, greedySettle, fmt, toPaise };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FairFare = api;
})(typeof window !== "undefined" ? window : globalThis);
