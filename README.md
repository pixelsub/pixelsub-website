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

Each product can have any number of plans, and every plan carries its own
price. A product's plans are edited on its admin page:

| label | sublabel | price | original price |
| --- | --- | --- | --- |
| 1 Month | 30 days access | 550 | 950 |
| 6 Month | 180 days access | 2200 | 3800 |

The discount percentage shown on the product page is calculated from those two
prices. A product with no plans is sold at the single price on its own record.

At checkout the browser sends only the product id, quantity and plan id. The
server looks up the plan and computes the total itself, so a tampered cart
cannot change what gets charged. A plan id belonging to a different product is
rejected.

Carts saved before per-plan pricing used a multiplier scheme; `/api/pricing`
still returns those multipliers so an old cart left in a browser is priced the
way it was shown, rather than silently repriced.

## Project layout

```
server.js          Express app, API routes, database setup
public/            Storefront (index, product, checkout)
admin/             Admin panel (products, plans, orders, settings)
uploads/products/  Uploaded product images
```

Tables: `products`, `product_plans`, `product_faqs`, `product_reviews`,
`orders`, `settings`, `admin_users`. All are created on first run.

## Notes

- Customer accounts are not implemented — the "Login" button is a placeholder.
- Footer pages (Contact, FAQ, Privacy, Refund, Terms) are not written yet.
- Product reviews are entered by the admin, not submitted by customers, since
  there are no customer accounts to attribute them to.
- Orders are confirmed manually: the customer submits a transaction ID, and the
  admin verifies it and updates the order status.
