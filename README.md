# truemail.io — Email finding & verification

This is a demo prototype for truemail.io: find and verify email addresses (single & bulk), provide an API, dashboard, and a subscription/credit model.

Features
- POST /api/generate — generate common email patterns given first, last, domain
- POST /api/verify — check email format, MX records, and optionally try an SMTP connection to the mail server

Quick start

1. Install dependencies

```bash
cd /Users/ravishekhar/Documents/Email_validate_find
npm install
```

2. Start the server

```bash
npm start
```

3. Open the UI

Visit: http://localhost:3000

Notes
- SMTP verification attempts to connect to remote mail servers on port 25 and may be blocked by your ISP or require elevated networking permissions. Use it only when you expect network connectivity.
- This project is a learning scaffold, not a production-ready system. Next steps: add database, rate-limiting, caching, usage tracking, more exhaustive name parsing, parallel MX probing, and UI polish.

Auth & credits
- Register and login from the UI at /app.html. New users receive 5 starter credits.
- Each /api/generate and /api/verify request consumes 1 credit. You can "purchase" credits via the dashboard (simulated).

Contact
- For enterprise inquiries and sales, use sales@truemail.io (demo address).

Auth & credits
- Register and login from the UI. New users receive 5 starter credits.
- Each /api/generate and /api/verify request consumes 1 credit. You can "purchase" credits via the dashboard (simulated).

Security note
- Tokens are returned by the API and stored in localStorage by the demo frontend; for production move to HTTP-only cookies and add TLS.
