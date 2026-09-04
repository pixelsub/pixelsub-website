# PixelSub

Premium digital products store — Express + PostgreSQL, with a built-in admin panel.

## Setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Copy `.env.example` to `.env` and fill it in:

   ```powershell
   Copy-Item .env.example .env
   ```

   `DATABASE_URL` is required — the site shows no products without it. Any cloud
   Postgres works (Neon, Railway, Supabase). Generate a session secret with:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```

3. Start the server:

   ```powershell
   npm start
   ```

   - Storefront: http://localhost:3000
   - Admin panel: http://localhost:3000/admin

On first run against an empty database, the tables are created, 22 demo products
are seeded, and an admin user is created from `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
Change that password from the admin panel afterwards.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `SESSION_SECRET` | in production | Signs admin session cookies |
| `ADMIN_USERNAME` | first run | Username for the initial admin (default `admin`) |
| `ADMIN_PASSWORD` | first run | Password for the initial admin |
| `NODE_ENV` | no | Set to `production` when deploying |
| `PORT` | no | Defaults to `3000` |

In production, `SESSION_SECRET` is mandatory — the server refuses to start without
it rather than falling back to a known default.

## Pricing

Prices are derived from each product's base price and the customer's selection:

| Plan | Multiplier | | Account type | Multiplier |
| --- | --- | --- | --- | --- |
| 1 Month | 1× | | Shared | 1× |
| 3 Months | 2.5× | | Personal | 1.8× |
| 6 Months | 4.5× | | | |
| 1 Year | 8× | | | |

`GET /api/pricing` exposes these multipliers so the storefront never keeps its own
copy. The server recalculates every order total from the database at checkout, so a
tampered cart in the browser cannot change what gets charged.

## Project layout

```
server.js          Express app, API routes, database setup
public/            Storefront (index, product, checkout)
admin/             Admin panel (products, orders, settings)
uploads/products/  Uploaded product images
```

## Notes

- Customer accounts are not implemented — the "Login" button is a placeholder.
- Footer pages (Contact, FAQ, Privacy, Refund, Terms) are not written yet.
- Orders are confirmed manually: the customer submits a transaction ID, and the
  admin verifies it and updates the order status.
