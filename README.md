# FairFare

Fair trip-expense settlement for friend groups. One organiser enters everything, the app works out who pays whom, and the result goes to the group as one clear summary: copy it anywhere, or send it straight to WhatsApp.

## Run it
- Open `index.html` in a browser. No build step, no server, no install.
- Run the tests: `node test.js`

## Files
- `engine.js`   settlement logic (shares, caps, balances, fewest payments), integer paise
- `summary.js`  builds the share text in two formats from one source: **General** (plain text, works in any app) and **WhatsApp style** (`*bold*`, `_italic_`, emoji)
- `test.js`     27 tests: engine, caps, rounding, validation, fuzzing, and both summary formats
- `index.html`, `style.css`, `app.js`  the organiser workspace: dashboard, transactions (expenses and transfers together), members, fair share studio with caps, settlement (money flow and overview on the left, payments on the right), and share summary

## Sharing
- The summary opens in **General** format. Copy it, or use **Share…** (shown on devices that support it) to send it with any app.
- **Share on WhatsApp** always sends the WhatsApp style version, so the `*` bold markers show up correctly in the chat.
- Switch to **WhatsApp style** to preview and edit that version before sending.
- Very long summaries can exceed WhatsApp's link limit; use Copy and paste instead.

## Limits
One organiser on one device, no sync between friends, caps rely on the group agreeing in chat, and no real money moves.
