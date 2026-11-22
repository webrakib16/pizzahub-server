# PizzaHub Backend API & Architecture Documentation (AGENTS.md)

This documentation is the **single source of truth** for the **PizzaHub Server** (`pizzahub-server`). It provides a complete architectural overview, schema definitions, exhaustive API catalog of all implemented features, security policies, and a definitive step-by-step protocol for extending or modifying the backend in the future.

---

## 1. Project Specifications & Environment

- **Repository / Directory:** `c:\Projects\Programing Hero Batch-14\PROJECTS\pizzahub-server`
- **Runtime & Language:** Node.js (v18+), JavaScript with ES Modules (`"type": "module"` in `package.json`), Express.js
- **Database:** MongoDB Atlas (Database: `pizzahub`)
- **Default Local Port:** `5000` (`http://localhost:5000`)
- **Production Server URL (Vercel):** `https://pizzahub-server-mbfm523uf-akib-rakib.vercel.app`
- **Frontend App URL (Local / Prod):** `http://localhost:3000` / `https://pizzahub-*.vercel.app`
- **Stripe Webhook Endpoint URL:** `https://pizzahub-server-mbfm523uf-akib-rakib.vercel.app/api/webhooks/stripe`
- **Dual Route Architecture:** All endpoints are mounted with both `/api/*` and direct `/*` prefixes (e.g. `/api/menu/public` and `/menu/public` execute identical logic).

### Environment Variables (`.env`)
```env
# Server Configuration
PORT=5000

# Database Connection (Atlas Cluster)
MONGODB_BETTER_AUTH_URI=<configure-in-environment>

# JWT Secret Key for token signing & verification
ACCESS_TOKEN_SECRET=<configure-in-environment>

# Frontend Client URLs (CORS & Stripe Redirects)
CLIENT_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe Payment Keys
STRIPE_SECRET_KEY=<configure-in-environment>
STRIPE_WEBHOOK_SECRET=<configure-in-environment>
```

---

## 2. Directory & MVC Architecture

```
pizzahub-server/
├── .env                         ← Unified environment variables (DB, JWT, Stripe)
├── package.json                 ← Dependencies (express, mongodb, jsonwebtoken, cors, dotenv, stripe)
├── index.js                     ← Entry point, CORS config, Raw Webhook mounting, Router loader
└── src/
    ├── config/
    │   └── db.js                ← MongoClient setup, collection getters, toIdQuery helper
    ├── middlewares/
    │   └── auth.js              ← verifyToken (Better Auth + JWT), verifyNotBlocked, verifyAdmin, verifyVendor
    ├── controllers/
    │   ├── authController.js        ← JWT token issuance
    │   ├── userController.js        ← User management & admin blocking/role assignment
    │   ├── vendorShopController.js  ← Shop profile creation, query & cascading updates
    │   ├── menuController.js        ← Menu catalog CRUD, free limit & admin approvals
    │   ├── orderController.js       ← Customer COD orders, tracking & vendor accept/reject
    │   ├── paymentController.js     ← Stripe checkout session, webhook handler & plan status
    │   ├── transactionController.js ← Transaction logs for vendors and admin
    │   ├── overviewController.js    ← Analytical metrics for Vendor, Admin, and Customer
    │   └── vendorController.js      ← Public vendor directory with premium priority
    └── routes/
        ├── authRoutes.js        ← /jwt
        ├── userRoutes.js        ← /users, /users/me, /admin/users
        ├── vendorShopRoutes.js  ← /vendor/shop, /vendor/:vendorId
        ├── menuRoutes.js        ← /menu/public, /vendor/menu, /admin/menu
        ├── orderRoutes.js       ← /orders, /vendor/orders, /admin/orders
        ├── paymentRoutes.js     ← /vendor/subscription/checkout, /webhooks/stripe
        ├── transactionRoutes.js ← /subscription/upgrade, /transactions
        ├── overviewRoutes.js    ← /overview/vendor, /overview/admin, /overview/customer
        └── vendorRoutes.js      ← /vendors
```

---

## 3. Database Collections & Schemas

| Collection | Description | Document Schema |
|---|---|---|
| `user` | Platform users (Customer, Vendor, Admin) | `{ _id: ObjectId\|string, id?: string, name: string, email: string, role: "customer"\|"vendor"\|"admin", blocked: boolean, subscription: "free"\|"premium", isPremium?: boolean, premiumSince?: Date, image?: string, createdAt: Date, updatedAt: Date }` |
| `session` | Better Auth active sessions | `{ _id: ObjectId, token: string, userId: string\|ObjectId, expiresAt: Date, createdAt: Date, updatedAt: Date }` |
| `vendorShops` | Restaurant profiles for vendors | `{ _id: ObjectId, vendorId: string, shopName: string, shopBio: string, shopLogo?: string, shopLocation: string, isProfileComplete: boolean, isPremium?: boolean, subscription?: "free"\|"premium", createdAt: Date, updatedAt: Date }` |
| `menuItems` | Pizza catalogue | `{ _id: ObjectId, vendorId: string, vendorName: string, name: string, category: string, description: string, price: number, location: string, primaryImage?: string, image: string, images?: string[], status: "pending"\|"approved"\|"rejected", isActive: boolean, createdAt: Date, updatedAt: Date }` |
| `orders` | Food delivery customer orders (COD) | `{ _id: ObjectId, userId: string, customerName: string, customerEmail: string, phone: string, items: Array<{ menuItemId, name, unitPrice, quantity, vendorName, image }>, subtotal: number, deliveryCharge: number, totalAmount: number, deliveryLocation: "inside-dhaka"\|"outside-dhaka", deliveryArea: string, deliveryAddress: string, deliveryDate: string, instructions?: string, status: "pending"\|"accepted"\|"rejected"\|"cancelled", createdAt: Date, updatedAt: Date }` |
| `transactions` | Subscription payments (Stripe) | `{ _id: ObjectId, vendorId: string, vendorName: string, vendorEmail: string, plan: "Premium", amount: number, currency: "bdt", status: "success", stripeSessionId: string, createdAt: Date }` |

---

## 4. Security & Middleware Implementation

1. **Dual Token Authentication (`verifyToken`):**
   - Supports **Better Auth Session Tokens** sent via `better-auth.session_token` HTTP-only cookie or `Authorization: Bearer <session_token>`. Verified against the `session` collection.
   - Supports **Custom Signed JWTs** sent via `Authorization: Bearer <jwt_token>` verified against `ACCESS_TOKEN_SECRET`.
   - Injects the authenticated user document into `req.user = { id, name, email, role, blocked, subscription }`.
   - Returns `401 Unauthorized` (`{ error: "Unauthorized access: Token missing or invalid" }`) on failure.
2. **Account Blocking Guard (`verifyNotBlocked`):**
   - Rejects blocked users immediately with `403 Forbidden` (`{ error: "Your account has been blocked by an administrator" }`).
3. **Role-Based Access Control (RBAC):**
   - **`verifyAdmin`:** Checks `req.user.role === "admin"`. If not, returns `403 Forbidden`.
   - **`verifyVendor`:** Checks `req.user.role === "vendor"` or `"admin"`. If not, returns `403 Forbidden`.
4. **Server-Side Data Validation & Ownership Checks:**
   - Resource updates or deletions (e.g. `menuItems`, orders) verify that `doc.vendorId === req.user.id` or `doc.userId === req.user.id` before mutating.
   - Client-provided roles or user IDs are **never** trusted; values are always extracted directly from `req.user`.

---

## 5. Comprehensive API Catalog (What is Implemented)

### A. Authentication & User Management
- **`POST /api/jwt`**: Issues a signed JWT access token for an authenticated email.
  - Body: `{ email: "user@example.com" }`
  - Response: `{ success: true, token: string, user: Object }`
- **`GET /api/users/me`**: Returns profile of currently logged-in user (`verifyToken`).
- **`GET /api/admin/users`** *(Admin)*: Lists all platform users with filtering (`?search=...`, `?role=customer|vendor|admin|all`).
- **`PATCH /api/admin/users/:id/block`** *(Admin)*: Blocks or unblocks a user. Admin cannot block their own account.
  - Body: `{ blocked: boolean }`
- **`PATCH /api/admin/users/:id/role`** *(Admin)*: Changes user role (`customer`, `vendor`, `admin`).
  - Body: `{ role: string }`

### B. Public Menu & Vendor Directory
- **`GET /api/menu/public`**: Lists pizzas where `status: "approved"` and `isActive: true`.
  - Query parameters:
    - `limit` (number): e.g. `?limit=6` for homepage featured section.
    - `category` (string): e.g. `?category=Classic Pizza` or `?category=all`.
    - `location` (string): e.g. `?location=Dhaka`.
    - `exclude` (string): Exclude an item ID for related pizzas.
    - `search` (string): Case-insensitive search on name, description, category.
    - `sort` (string): `price-low`, `price-high`, `oldest`, or default newest.
- **`GET /api/menu/public/:id`**: Single pizza details joined with vendor restaurant information (`shopBio`, `shopLogo`, `shopLocation`, `vendorPremium`).
- **`GET /api/vendor/:vendorId`**: Public vendor profile for "About Vendor" section.
- **`GET /api/vendors`**: All vendors. Premium vendors (`subscription === "premium"`) are sorted first with `isPremium: true` and `badge: "Premium"`.

### C. Vendor Shop Profile (Vendor Auth)
- **`GET /api/vendor/shop`**: Returns current vendor's shop document.
- **`POST /api/vendor/shop`**: Initial setup (`shopName`, `shopBio`, `shopLocation` required). Sets `isProfileComplete: true`.
- **`PATCH /api/vendor/shop`**: Updates shop profile. Automatically cascades updated `shopName` to all existing `menuItems.vendorName`.

### D. Vendor Menu CRUD (Vendor Auth)
- **`GET /api/vendor/menu`**: Retrieves all items owned by current vendor across all statuses (`pending`, `approved`, `rejected`).
- **`POST /api/vendor/menu`**: Creates a new menu item.
  - *Shop profile gate:* Requires `vendorShops.isProfileComplete: true`.
  - *Free plan limit:* Free vendors can have at most **3 active items**.
  - *Auto shop name:* Sets `vendorName` from `vendorShops.shopName`.
  - *Default status:* Always created with `status: "pending"`.
- **`PATCH /api/vendor/menu/:id`**: Updates item details (name, price, description, images). Strips `status` and `isActive` fields to prevent privilege escalation.
- **`PATCH /api/vendor/menu/:id/availability`**: Toggles `isActive`. Re-verifies 3-item limit on activation.
  - Body: `{ isActive: boolean }`
- **`DELETE /api/vendor/menu/:id`**: Deletes item owned by the vendor.

### E. Customer Orders & Delivery (Cash on Delivery)
- **`POST /api/orders`** *(Customer Auth)*: Places order with delivery address, date, and phone.
  - *Guard:* Admins cannot place food orders.
  - *Guard:* Vendors cannot purchase their own items.
  - *Guard:* Items must be approved and active.
- **`GET /api/orders/customer`**: Returns logged-in customer's order history.
- **`PATCH /api/orders/:id/cancel`** *(Customer Auth)*: Cancels order (only allowed if status is `"pending"`).
- **`GET /api/vendor/orders`** *(Vendor Auth)*: Orders containing items belonging to this vendor.
- **`PATCH /api/orders/:id/status`** *(Vendor Auth)*: Accept or reject customer order (`{ status: "accepted" | "rejected" }`).
- **`GET /api/orders/:id`**: Fetches order document (accessible by customer, vendor, or admin).
- **`GET /api/admin/orders`** *(Admin Auth)*: Platform-wide orders list.

### F. Vendor Stripe Premium Subscription & Webhook
- **`POST /api/vendor/subscription/checkout`** *(Vendor Auth)*: Creates Stripe Hosted Checkout Session (৳499 BDT / 49900 poisha). Returns `{ url: string }`.
- **`POST /api/webhooks/stripe`** *(Public endpoint, Stripe Signature Verified)*:
  - Mounted before `express.json()` using `express.raw({ type: "application/json" })`.
  - Cryptographically verifies signature using `STRIPE_WEBHOOK_SECRET`.
  - Enforces idempotency via `transactions.stripeSessionId`.
  - On `checkout.session.completed`:
    1. Records transaction in `transactions` collection.
    2. Updates `user`: `{ subscription: "premium", isPremium: true, premiumSince: new Date() }`.
    3. Updates `vendorShops`: `{ isPremium: true, subscription: "premium" }`.
- **`GET /api/vendor/subscription/status`** *(Vendor Auth)*: Returns current subscription status (`isPremium`, `plan`, `premiumSince`).
- **`GET /api/transactions`** *(Admin)* & **`GET /api/transactions/vendor`** *(Vendor)*: Billing history.

### G. Analytics & Overview
- **`GET /api/overview/vendor`**: Vendor stats (total items, active items, pending orders, accepted orders, plan).
- **`GET /api/overview/admin`**: Admin stats (total users, customers, vendors, blocked users, items, orders, transactions, platform revenue).
- **`GET /api/overview/customer`**: Customer stats (total orders, pending, accepted, cancelled, total spent).

---

## 6. Future Update Protocols: How to Handle Future Changes

Any developer or agent extending the backend must strictly adhere to the following 6-step lifecycle:

### Protocol 1: Implementing a New API Endpoint
1. **Controller Layer (`src/controllers/<feature>Controller.js`):**
   - Write an exported async function `export const myController = async (req, res) => { ... }`.
   - Obtain database collections via `const { myCollection } = getCollections();`.
   - Never trust client-supplied user IDs or roles. Always use `req.user.id` and `req.user.role`.
   - For MongoDB `_id` lookups, always wrap IDs with `toIdQuery(id)` so both 24-character ObjectIds and string IDs resolve correctly.
   - Handle errors with a `try ... catch` block and return standard format `{ error: err.message }`.
2. **Route Layer (`src/routes/<feature>Routes.js`):**
   - Import necessary middlewares: `verifyToken`, `verifyNotBlocked`, `verifyVendor`, or `verifyAdmin`.
   - Define route: `router.post("/path", verifyToken, verifyNotBlocked, myController);`.
3. **Register Route (`index.js`):**
   - Add the new router to the `routeList` array in `index.js`.
   - The server loop will automatically register both `/api/<path>` and `/<path>`.
4. **Update `AGENTS.md`:** Document the new route, body parameters, and responses.

### Protocol 2: Modifying Database Schemas or Collections
- **Backward Compatibility:** When adding a new field (e.g. `discountPrice`, `deliveryStatus`), always provide fallback logic for older documents in the controller:
  ```javascript
  const discount = item.discountPrice ?? 0;
  ```
- **Cascading Relationships:** If a parent document's key fields change (such as restaurant name or user image), use MongoDB `updateMany()` to cascade the change to related child collections (like `menuItems` and `orders`).

### Protocol 3: Modifying Payments & Stripe Logic
- **Raw Webhook Preservation:** Never place middleware before `index.js` line 44 that parses the request body as JSON for `/api/webhooks/stripe`. The raw buffer is strictly mandatory for Stripe signature verification.
- **Idempotency Check:** Always verify against `transactions.stripeSessionId` before awarding any subscription privileges.
- **Strict Separation of Concerns:** Pizza customer orders must remain Cash on Delivery (`/api/orders`). Do not route customer orders through Stripe. Stripe is reserved strictly for Vendor Premium Upgrades.

### Protocol 4: Local Testing & Verification
Before pushing changes:
1. Validate syntax:
   ```bash
   node --check index.js
   ```
2. Verify database connection and imports:
   ```bash
   node -e "import('./index.js')"
   ```
3. Test route authorization:
   - Request protected route without token ➔ Expect `401 Unauthorized`.
   - Request admin route with customer token ➔ Expect `403 Forbidden`.

### Protocol 5: Deployment to Production (Vercel)
1. Commit and push changes to the repository:
   ```bash
   git add .
   git commit -m "feat: your feature description"
   git push origin main
   ```
2. If new environment variables were introduced, add them in **Vercel Dashboard ➔ Project Settings ➔ Environment Variables**.
3. Redeploy the project on Vercel to load the new environment variables.
