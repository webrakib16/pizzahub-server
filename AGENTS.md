# PizzaHub Backend API Documentation (AGENTS.md)

This documentation provides the complete backend architecture, API reference, schemas, security policies, and integration instructions for **PizzaHub Server** (`pizzahub-server`).

Frontend agents or developers must use this file as the single source of truth when wiring API calls, data fetching, and state management in the client (`pizzahub`).

---

## 1. Server Configuration & Setup

- **Project Location:** `c:\Projects\Programing Hero Batch-14\PROJECTS\pizzahub-server`
- **Language / Runtime:** JavaScript (ES Modules, `"type": "module"` in `package.json`), Node.js, Express.js
- **Default Port:** `5000` (`http://localhost:5000`)
- **Database:** MongoDB Atlas cluster (`pizzahub` database)
- **Environment Variables (`.env` in `pizzahub-server`):**
  - `PORT=5000`
  - `MONGODB_BETTER_AUTH_URI=mongodb+srv://pizzahub:TTpqXyzuxpGfPev1@cluster0.su0mzzp.mongodb.net/`
  - `ACCESS_TOKEN_SECRET=pizzahub_jwt_secret_token_batch14_secure_key_2026`
- **CORS Policy:** Allows `http://localhost:3000` and `*.vercel.app` with `credentials: true`.
- **Dual Route Prefix Support:** Every route is accessible both with `/api/...` and directly (e.g. `/api/menu/public` and `/menu/public` execute identical logic).

---

## 2. Directory & MVC Architecture

```
pizzahub-server/
├── .env                         ← Server environment variables
├── package.json                 ← Dependencies (express, mongodb, jsonwebtoken, cors, dotenv)
├── index.js                     ← Server entry point, CORS config, route mounting, health check
└── src/
    ├── config/
    │   └── db.js                ← MongoClient initialization, collections exporter, ID queries
    ├── middlewares/
    │   └── auth.js              ← verifyToken (Better Auth + JWT), verifyNotBlocked, verifyAdmin, verifyVendor
    ├── controllers/
    │   ├── authController.js        ← JWT generation
    │   ├── userController.js        ← User profile and admin user management
    │   ├── vendorShopController.js  ← Vendor shop profile setup & public shop query
    │   ├── menuController.js        ← Public & vendor menu CRUD, admin review
    │   ├── orderController.js       ← Customer order placement, tracking, vendor order handling
    │   ├── transactionController.js ← Subscription upgrades and transactions
    │   ├── overviewController.js    ← Dashboard overview analytics
    │   └── vendorController.js      ← Public vendors list with priority
    └── routes/
        ├── authRoutes.js        ← /jwt
        ├── userRoutes.js        ← /users, /users/me, /admin/users
        ├── vendorShopRoutes.js  ← /vendor/shop, /vendor/:vendorId
        ├── menuRoutes.js        ← /menu/public, /vendor/menu, /admin/menu
        ├── orderRoutes.js       ← /orders, /vendor/orders, /admin/orders
        ├── transactionRoutes.js ← /subscription/upgrade, /transactions
        ├── overviewRoutes.js    ← /overview/vendor, /overview/admin, /overview/customer
        └── vendorRoutes.js      ← /vendors
```

---

## 3. Authentication & Authorization Middleware

### `verifyToken`
Supports two token transmission types:
1. **Better Auth Session:** Token sent via `better-auth.session_token` cookie or `Authorization: Bearer <session_token>`. Verified directly against the MongoDB `session` collection.
2. **JWT Access Token:** Signed JWT token sent via `Authorization: Bearer <jwt_token>`.
- Rejection: Returns `401 Unauthorized` if token is missing, invalid, or expired.
- Block Check: If the associated user has `blocked: true`, returns `403 Forbidden` (`Your account has been blocked by an administrator`).
- Request Attachment: Injects `req.user = { id, name, email, role, blocked, subscription }` into the request object.

### `verifyNotBlocked`
Ensures `req.user.blocked !== true`.

### `verifyAdmin`
Requires `req.user.role === "admin"`. Otherwise returns `403 Forbidden`.

### `verifyVendor`
Requires `req.user.role === "vendor"` or `req.user.role === "admin"`. Otherwise returns `403 Forbidden`.

---

## 4. MongoDB Database Collections

| Collection | Role / Description | Key Document Structure |
|---|---|---|
| `user` | Registered platform users | `{ _id, id, name, email, role: "customer"\|"vendor"\|"admin", blocked: boolean, subscription: "free"\|"premium", image, createdAt }` |
| `session` | Better Auth active sessions | `{ _id, token, userId, expiresAt, createdAt, updatedAt }` |
| `vendorShops` | Vendor restaurant profile | `{ _id, vendorId, shopName, shopBio, shopLogo, shopLocation, isProfileComplete: boolean, createdAt, updatedAt }` |
| `menuItems` | Menu item catalogue | `{ _id, vendorId, vendorName, name, category, description, price, location, primaryImage, image, images: string[], status: "pending"\|"approved"\|"rejected", isActive: boolean, createdAt, updatedAt }` |
| `orders` | Food customer orders | `{ _id, userId, customerName, customerEmail, phone, items: OrderItem[], subtotal, deliveryCharge, totalAmount, deliveryLocation: "inside-dhaka"\|"outside-dhaka", deliveryArea, deliveryAddress, deliveryDate, instructions, status: "pending"\|"accepted"\|"rejected"\|"cancelled", createdAt, updatedAt }` |
| `transactions` | Subscription payments | `{ _id, vendorId, vendorName, vendorEmail, plan: "premium", amount, paymentMethod, status: "success", createdAt }` |

---

## 5. Comprehensive API Catalog

### A. Public Menu Endpoints
- **`GET /api/menu/public`** (or `GET /menu/public`, `GET /menu`)
  - **Access:** Public (No authentication required)
  - **Query Parameters:**
    - `limit` (number) — Limit number of returned items (e.g. `?limit=6` for homepage featured pizzas).
    - `category` (string) — Filter by category name (e.g. `?category=Classic Pizza` or `?category=all`).
    - `location` (string) — Filter by area/city (e.g. `?location=Dhaka`).
    - `exclude` (string) — Exclude specific item ID (e.g. `?exclude=6b006ab984...` for related items).
    - `search` (string) — Case-insensitive search on item `name`, `description`, or `category`.
    - `sort` (string) — `price-low`, `price-high`, `oldest`, or default newest.
  - **Filter Criteria:** Only returns items with `status: "approved"` and `isActive: true`.
  - **Response:** Array of menu item objects.

- **`GET /api/menu/public/:id`** (or `GET /menu/:id`)
  - **Access:** Public
  - **Purpose:** Fetches single item for the Product Details page (`/menu/[id]`).
  - **Response:** Menu item object with joined vendor shop details (`vendorName`, `shopBio`, `shopLogo`, `shopLocation`, `vendorPremium`).
  - **Error:** `404 Not Found` if missing, `400 Bad Request` if invalid ObjectId format.

---

### B. Public Vendor Info
- **`GET /api/vendor/:vendorId`**
  - **Access:** Public
  - **Purpose:** Returns public shop info for the "About Vendor" section on the details page.
  - **Response:** `{ vendorId, shopName, shopBio, shopLogo, shopLocation, isProfileComplete }`.
  - **Fallback:** If vendor hasn't initialized their shop profile yet, falls back to `user` name and defaults.

- **`GET /api/vendors`**
  - **Access:** Public
  - **Purpose:** Lists all vendors. Premium vendors (`subscription === "premium"`) are sorted first with `isPremium: true` and `badge: "Premium"`.
  - **Response:** Array of `{ id, name, email, image, isPremium, badge }`.

---

### C. Vendor Shop Profile (Vendor Auth Required)
- **`GET /api/vendor/shop`**
  - **Purpose:** Fetches current vendor's shop document. Returns `404` if not yet configured.
- **`POST /api/vendor/shop`**
  - **Purpose:** Initial shop setup.
  - **Body:** `{ shopName: string, shopBio: string, shopLogo?: string, shopLocation: string }`.
  - **Validation:** `shopName`, `shopBio`, and `shopLocation` are required.
- **`PATCH /api/vendor/shop`**
  - **Purpose:** Updates shop profile. Re-evaluates `isProfileComplete` and cascades updated `shopName` to all vendor's existing `menuItems.vendorName`.

---

### D. Vendor Menu Management (Vendor Auth Required)
- **`GET /api/vendor/menu`**
  - **Purpose:** Retrieves all menu items owned by this vendor across all statuses (`pending`, `approved`, `rejected`).
- **`POST /api/vendor/menu`** (or `POST /api/menu`)
  - **Purpose:** Creates a new menu item.
  - **Business Rules Enforced:**
    1. **Shop Profile Gate:** Vendor must have a complete shop profile in `vendorShops` (`isProfileComplete: true`). Otherwise returns `400 { error: "Complete your shop profile before adding menu items" }`.
    2. **Free Plan Limit:** Vendors on the Free plan can have at most **3 active items**. If limit reached, returns `400 { error: "Free plan limit reached..." }`.
    3. **Shop Name:** Reads `shopName` directly from `vendorShops` and assigns it as `vendorName`.
    4. **Default Status:** Always saved with `status: "pending"` until an admin approves it.
  - **Body:** `{ name, category, description, price, location, image, primaryImage?, images? }`.
- **`PATCH /api/vendor/menu/:id`** (or `PATCH /api/menu/:id`)
  - **Purpose:** Updates item details (name, price, description, images).
  - **Security Rule:** Automatically strips `status` and `isActive` fields from non-admin updates.
- **`PATCH /api/vendor/menu/:id/availability`**
  - **Purpose:** Toggles item `isActive` status. Re-validates free plan 3-item limit when activating.
  - **Body:** `{ isActive: boolean }`.
- **`DELETE /api/vendor/menu/:id`**
  - **Purpose:** Deletes vendor's own menu item.

---

### E. Customer Orders & Lifecycle
- **`POST /api/orders`** *(Customer Auth Required)*
  - **Purpose:** Submits food order with delivery date and address.
  - **Business Rules Enforced:**
    1. **Admins cannot place customer orders** (`403 Forbidden`).
    2. **Vendors cannot order their own items** (`403 Forbidden`).
    3. **Only approved and active items can be ordered** (`400 Bad Request`).
  - **Body:**
    ```json
    {
      "items": [
        {
          "menuItemId": "6b006ab9845d66487ee625a1",
          "name": "Margherita Classic",
          "unitPrice": 450,
          "quantity": 2,
          "vendorName": "Jael Buchanan",
          "image": "https://..."
        }
      ],
      "subtotal": 900,
      "deliveryCharge": 60,
      "totalAmount": 960,
      "deliveryLocation": "inside-dhaka",
      "deliveryArea": "Gulshan",
      "deliveryAddress": "Road 11, House 24",
      "deliveryDate": "2026-11-25",
      "instructions": "Leave at front desk",
      "phone": "+8801700000000"
    }
    ```
  - **Default Status:** Created as `"pending"`.
- **`GET /api/orders/customer`** (or `GET /api/orders`) *(Customer Auth Required)*
  - **Purpose:** Retrieves all orders placed by the current logged-in customer.
- **`PATCH /api/orders/:id/cancel`** *(Customer Auth Required)*
  - **Purpose:** Customer cancels a pending order. Rejects with `409 Conflict` if order status is not `"pending"`.
- **`GET /api/vendor/orders`** *(Vendor Auth Required)*
  - **Purpose:** Retrieves orders that contain items belonging to this restaurant.
- **`PATCH /api/orders/:id/status`** *(Vendor Auth Required)*
  - **Purpose:** Accepts or rejects a customer order.
  - **Body:** `{ status: "accepted" | "rejected" }`.
- **`GET /api/orders/:id`** *(Customer / Vendor / Admin)*
  - **Purpose:** Retrieves detailed order document. Validates caller is order owner, item vendor, or admin.
- **`GET /api/admin/orders`** *(Admin Auth Required)*
  - **Purpose:** Retrieves all orders platform-wide.

---

### F. Admin Platform Management (Admin Auth Required)
- **`GET /api/admin/menu`**
  - **Purpose:** Lists all items across all vendors. Query: `?status=pending|approved|rejected|all`.
- **`PATCH /api/admin/menu/:id/status`**
  - **Purpose:** Approves or rejects menu item.
  - **Rule:** Automatically sets `isActive: status === "approved"`.
  - **Body:** `{ status: "approved" | "rejected" }`.
- **`GET /api/admin/users`** (or `GET /api/users`)
  - **Purpose:** Lists all registered users. Query: `?search=...`, `?role=customer|vendor|admin|all`.
- **`PATCH /api/admin/users/:id/block`**
  - **Purpose:** Blocks or unblocks a user. Admin cannot block their own account.
  - **Body:** `{ blocked: boolean }`.
- **`PATCH /api/admin/users/:id/role`**
  - **Purpose:** Changes user role (`customer`, `vendor`, `admin`).
  - **Body:** `{ role: string }`.

---

### G. Vendor Stripe Premium Subscription & Transactions

#### Architectural Flow (Strict Requirement)
```
[Next.js Client] ──> [Express Backend] ──> [Stripe Checkout] ──> [Vendor Completes Payment]
                                                    │
[Next.js Success Page] <── (Informs Vendor Only)   ▼
                                             [Stripe Webhook Event]
                                                    │
                                                    ▼
                                            [Express Backend] (Verifies Signature & Idempotency)
                                                    │
                                                    ▼
                                            [MongoDB Database] (Updates Vendor & Records Transaction)
```
> **Core Security Principle:** *"The success page is for the user. The webhook is for the backend."*  
> **Never** activate Premium based on frontend redirects or URL queries. Premium status is granted **only** after verified Stripe webhook event confirmation.

#### Endpoints

- **`POST /api/vendor/subscription/checkout`** *(Vendor Auth Required)*
  - **Purpose:** Initiates a Stripe Checkout Session for Vendor Premium Subscription.
  - **Pricing:** ৳499 BDT (`unit_amount: 49900` in poisha, one-time payment).
  - **Security:** Requires logged-in vendor (`verifyToken`, `verifyNotBlocked`, `verifyVendor`).
  - **Metadata Attached:** `{ vendorId, vendorName, vendorEmail, plan: "Premium" }`.
  - **Success URL:** `${NEXT_PUBLIC_APP_URL}/vendor/subscription/success?session_id={CHECKOUT_SESSION_ID}`.
  - **Cancel URL:** `${NEXT_PUBLIC_APP_URL}/vendor/subscription/cancel`.
  - **Response:** `{ url: string }` (Stripe Hosted Checkout URL).

- **`GET /api/vendor/subscription/status`** *(Vendor Auth Required)*
  - **Purpose:** Checks current vendor's subscription plan, active status (`isPremium: boolean`), and date.
  - **Response:** `{ isPremium: boolean, plan: "Premium" | "Free", premiumSince: string | null }`.

- **`POST /api/webhooks/stripe`** *(Public endpoint, Stripe Signature Verified)*
  - **Purpose:** Listens to asynchronous Stripe payment confirmation events (`checkout.session.completed`).
  - **Middleware Requirement:** Mounted with `express.raw({ type: "application/json" })` **before** `express.json()` to preserve raw body buffers.
  - **Signature Verification:** Uses `stripe.webhooks.constructEvent(req.body, signature, STRIPE_WEBHOOK_SECRET)`.
  - **Idempotency Rule:** Checks MongoDB `transactions` collection for duplicate `stripeSessionId`. If duplicate, skips re-processing and returns `200 { received: true, duplicate: true }`.
  - **Database Updates on Successful Payment:**
    1. Records transaction in `transactions` collection (`vendorId`, `vendorName`, `vendorEmail`, `plan: "Premium"`, `amount: 499`, `currency: "bdt"`, `status: "success"`, `stripeSessionId`, `createdAt`).
    2. Updates `user` collection: `{ $set: { subscription: "premium", isPremium: true, premiumSince: new Date(), updatedAt: new Date() } }`.
    3. Updates `vendorShops` collection: `{ $set: { isPremium: true, subscription: "premium", updatedAt: new Date() } }`.
    4. Updates `vendors` collection (if present): `{ $set: { subscription: "premium", isPremium: true, updatedAt: new Date() } }`.
  - **Response:** `200 { received: true }`.

- **`GET /api/transactions`** *(Admin Auth Required)*
  - **Purpose:** Platform transaction records for admin oversight.
  - **Response:** Array of transaction objects sorted newest first.

- **`GET /api/transactions/vendor`** *(Vendor Auth Required)*
  - **Purpose:** Vendor's personal subscription billing history.

---

### H. Backend Rules: What to Do & What NOT to Do

#### ✅ What the Backend MUST Do:
1. **Enforce 3-Item Limit for Free Vendors:** In `POST /api/vendor/menu`, count active items for the vendor. If `!isPremium && count >= 3`, reject with `400 Free plan limit reached`.
2. **Unlock Unlimited Items for Premium:** If `isPremium === true`, allow creating more than 3 active menu items without restriction.
3. **Keep Stripe Secret Keys on the Backend:** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` must exist strictly on the Express server and must never be exposed to the client.
4. **Customer Orders Use Direct Order (Cash on Delivery):** Customer pizza checkout does NOT use Stripe. Orders are placed directly through `POST /api/orders` with payment method COD.
5. **Shop Profile Gate:** Vendors must have completed their shop profile (`isProfileComplete: true`) in `vendorShops` before adding menu items.
6. **Assign Shop Name to Menu Items:** Always read `shopName` from `vendorShops` when creating a menu item, not `user.name`.

#### ❌ What the Backend MUST NEVER Do:
1. **Never use Stripe for customer pizza orders.** Stripe is exclusively for Vendor Premium Subscriptions (৳499 BDT).
2. **Never activate Premium on client redirects.** Only activate through verified Stripe webhook events.
3. **Never allow vendors to modify admin-only fields** (`status`, `isActive`) in `PATCH /api/vendor/menu/:id`. Strip these fields before updating.
4. **Never allow blocked users (`blocked: true`)** to access protected endpoints. Always reject with `403 Forbidden`.

---

### H. Dashboard Overview Stats
- **`GET /api/overview/vendor`** *(Vendor)*: `{ totalMenuItems, activeMenuItems, pendingOrders, acceptedOrders, currentSubscriptionPlan }`.
- **`GET /api/overview/admin`** *(Admin)*: `{ totalUsers, totalCustomers, totalVendors, blockedUsers, totalMenuItems, pendingMenuItems, totalOrders, totalTransactions, totalRevenue }`.
- **`GET /api/overview/customer`** *(Customer)*: `{ totalOrders, pendingOrders, acceptedOrders, cancelledOrders, totalSpent }`.

---

### I. JWT Token Endpoint
- **`POST /api/jwt`**
  - **Purpose:** Issues signed JWT token for API testing or client header usage.
  - **Body:** `{ email: string }`.
  - **Response:** `{ success: true, token, user }`.

---

## 6. Frontend Client Integration Instructions

1. **Frontend `.env` Configuration:**
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000
   ```
2. **Data Fetching:**
   Replace static array imports in client components/pages:
   - Homepage `FeaturedMenuItems`: fetch `${process.env.NEXT_PUBLIC_API_URL}/api/menu/public?limit=6`.
   - Homepage `PizzaCategories`: fetch `${process.env.NEXT_PUBLIC_API_URL}/api/menu/public`.
   - Explore Menu (`/menu`): fetch `${process.env.NEXT_PUBLIC_API_URL}/api/menu/public` with active search and category filters.
   - Item Details (`/menu/[id]`): fetch `${process.env.NEXT_PUBLIC_API_URL}/api/menu/public/${id}`.
3. **Session & Cookie Forwarding:**
   Always specify `credentials: "include"` on `fetch()` calls from the browser so Better Auth session cookies are sent across origins. If using Bearer tokens, pass `Authorization: Bearer ${token}`.
