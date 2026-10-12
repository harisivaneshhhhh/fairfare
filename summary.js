// FairFare summary: turns a settled trip into shareable text. Pure functions, no DOM.
// Two formats from one source of truth:
//   "plain"    - general text that reads well anywhere (SMS, email, any chat app)
//   "whatsapp" - the same content with WhatsApp markers: *bold*, _italic_ and emoji
// Works in the browser (window.FairFareSummary) and in Node (module.exports).
(function (root) {
  "use strict";
  const FF = typeof module !== "undefined" && module.exports ? require("./engine.js") : root.FairFare;
  const rs = (p) => "₹" + FF.fmt(p);

  /** True when affordability caps actually moved someone's share away from the equal split. */
  function capsChangedShares(state, c) {
    if (state.mode !== "caps" || !c.res.ok || !c.eq.ok) return false;
    return state.members.some((m) => c.res.shares[m] !== c.eq.shares[m]);
  }

  /**
   * Describe how shares look: { even, spread, text } where `text` is the plain
   * wording of the headline share (no markers; the formatter adds them).
   */
  function shareInfo(state, c) {
    const res = c.res;
    const sh = state.members.map((m) => res.shares[m]);
    const spread = Math.max(...sh) - Math.min(...sh);
    const even = spread <= 1;
    const each = even ? Math.round(res.total / state.members.length) : 0;
    let reason = "";
    if (!even) reason = capsChangedShares(state, c) ? "affordability caps" : "who shared what";
    return { even, spread, each, reason, capped: capsChangedShares(state, c) };
  }

  function styler(kind) {
    if (kind === "whatsapp") {
      return {
        wa: true,
        b: (s) => "*" + s + "*",
        i: (s) => "_" + s + "_",
        e: (emoji) => emoji + " ",
        h: (s) => "*" + s + "*",
      };
    }
    return { wa: false, b: (s) => s, i: (s) => s, e: () => "", h: (s) => s + ":" };
  }

  /**
   * Build the message. kind = "plain" | "whatsapp".
   * state: { trip, members, expenses, transfers, mode, caps, agreed, sumOpts:{list,balances} }
   * c: { eq, res } from settling the state.
   */
  function build(state, c, kind) {
    const f = styler(kind);
    const res = c.res;
    const o = state.sumOpts || { list: true, balances: true };
    const trip = (state.trip || "").trim() || "Our trip";
    const info = shareInfo(state, c);
    const L = [];

    L.push(f.e("🧾") + f.b(trip + " – Trip Settlement"));
    L.push("");
    L.push(f.e("💰") + "Total spent: " + f.b(rs(res.total)));
    const shareText = info.even
      ? "Fair share: " + f.b(rs(info.each)) + " each"
      : "Shares differ because of " + info.reason;
    L.push(f.e("👥") + state.members.length + " people · " + shareText);

    if (o.list && (state.expenses.length || state.transfers.length)) {
      L.push("");
      L.push(f.h("What we counted"));
      state.expenses.forEach((e) => {
        const shared = e.sharedBy.length === state.members.length ? "" : ", shared by " + e.sharedBy.join(", ");
        L.push("• " + e.title + " – " + rs(e.amount) + " (paid by " + e.paidBy + shared + ")");
      });
      if (state.transfers.length) {
        L.push(f.i("Money passed around (not spending):"));
        state.transfers.forEach((t) => {
          L.push("• " + t.from + " → " + t.to + " " + rs(t.amount) + (t.note ? " (" + t.note + ")" : ""));
        });
      }
    }

    if (!info.even) {
      L.push("");
      L.push(f.h("Each person's share"));
      state.members.forEach((m) => {
        const cap = state.caps && state.caps[m];
        const capped = state.mode === "caps" && typeof cap === "number" && res.shares[m] === cap && c.eq.shares[m] > cap;
        L.push("• " + m + ": " + rs(res.shares[m]) + (capped ? " (their cap)" : ""));
      });
    }

    if (o.balances) {
      L.push("");
      L.push(f.h("Where everyone stands"));
      state.members.forEach((m) => {
        const n = res.net[m];
        L.push("• " + m + (n > 0 ? " gets back " + rs(n) : n < 0 ? " owes " + rs(-n) : " is settled"));
      });
    }

    L.push("");
    L.push(f.h("Payments to make (" + res.payments.length + ")"));
    if (res.payments.length) {
      res.payments.forEach((p, i) => L.push(i + 1 + ". " + p.from + " → " + p.to + ": " + f.b(rs(p.amount))));
    } else {
      L.push("Nobody needs to pay anyone. All even.");
    }
    L.push(f.i("Fewest possible payments, worked out with FairFare."));

    if (info.capped) {
      L.push("");
      L.push(
        state.agreed
          ? f.e("✅") + f.i("Caps agreed by the group.")
          : f.e("⚠️") + f.i("This split uses affordability caps. Please reply if you are fine with it.")
      );
    }

    L.push("");
    L.push("Please settle up and reply " + (f.wa ? f.b("done") : '"done"') + " once paid. Thank you!" + (f.wa ? " 🙌" : ""));
    return L.join("\n");
  }

  /** One short, plain nudge per person who has to pay. */
  function reminders(state, c) {
    const by = {};
    const trip = (state.trip || "").trim() || "our trip";
    c.res.payments.forEach((p) => (by[p.from] = by[p.from] || []).push(p));
    return Object.keys(by).map((m) => {
      const lines = by[m].map((p) => "• " + p.to + ": " + rs(p.amount)).join("\n");
      const total = by[m].reduce((a, p) => a + p.amount, 0);
      return { m, total, text: "Hi " + m + ", for " + trip + " please pay:\n" + lines + "\nThanks! (via FairFare)" };
    });
  }

  const escHtml = (s) =>
    String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  /** Render WhatsApp-style text as safe HTML for the on-screen preview (*bold*, _italic_). */
  function waHtml(text) {
    return escHtml(text)
      .replace(/\*([^*\n]+)\*/g, "<b>$1</b>")
      .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,])/gm, "$1<i>$2</i>");
  }

  const api = { build, reminders, shareInfo, capsChangedShares, waHtml };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FairFareSummary = api;
})(typeof window !== "undefined" ? window : globalThis);
