# Foodisthan Platform Starter

This repository is the foundation for a Zomato-style ecosystem with 3 apps:

1. `foodisthan-customer` (Flutter)
2. `foodisthan-restro` (Flutter + Web portal)
3. `foodisthan-delivery` (Flutter)

The current codebase includes:

1. MySQL-backed backend APIs in Next.js App Router
2. Restro login + dashboard web portal for category/item operations
3. Customer menu preview web page that consumes the same API as Flutter

## Tech Stack

1. Next.js 16 (App Router)
2. React 19
3. TypeScript
4. MySQL (`mysql2`)

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` using `env.sample` values:

```bash
DB_HOST=34.133.49.19
DB_USER=loop_food
DB_PASSWORD=food
DB_NAME=loop_food
DB_PORT=3306
```

3. Run development server:

```bash
npm run dev
```

4. Open:

1. `http://localhost:3000` (platform home)
2. `http://localhost:3000/restro/login` (restro admin start)
3. `http://localhost:3000/customer` (customer feed preview)

## Implemented Routes

1. `app/page.tsx`: platform landing page
2. `app/restro/login/page.tsx`: restro portal entry and bootstrap
3. `app/restro/dashboard/page.tsx`: category + item CRUD (variants, add-ons, offers, stock)
4. `app/customer/page.tsx`: customer menu preview
5. `app/delivery/page.tsx`: delivery app blueprint page

## API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET`/`POST` | `/api/restro/bootstrap` | Create core schema if missing |
| `GET` | `/api/restro/restaurants` | List restaurants |
| `POST` | `/api/restro/restaurants` | Create restaurant |
| `GET` | `/api/restro/categories?restaurantId=1` | List categories |
| `POST` | `/api/restro/categories` | Create category |
| `PUT` | `/api/restro/categories/:id` | Update category |
| `DELETE` | `/api/restro/categories/:id?restaurantId=1` | Delete category |
| `GET` | `/api/restro/items?restaurantId=1` | List items |
| `POST` | `/api/restro/items` | Create item |
| `PUT` | `/api/restro/items/:id` | Update item |
| `DELETE` | `/api/restro/items/:id?restaurantId=1` | Delete item |
| `GET` | `/api/customer/menu?restaurantId=1` | Customer-ready nested menu feed |

## MySQL Data Model

Schema bootstrap creates these tables:

1. `restaurants`
2. `categories` (supports parent categories via `parent_category_id`)
3. `items`
4. `item_variants`
5. `item_addons`

The `items` table currently supports:

1. Base price
2. Stock quantity
3. SKU
4. Veg/non-veg
5. Availability toggle
6. Offer title
7. Offer discount percent
8. Offer start/end datetime

## Flutter App Design Plan

### 1) `foodisthan-customer`

1. Home screen with category and subcategory rails
2. Item listing with variants/add-ons and offer badge
3. Item detail and cart workflow
4. Data source: `GET /api/customer/menu?restaurantId=<id>`

### 2) `foodisthan-restro`

1. Login/select restaurant
2. Category manager (create/update/delete)
3. Item manager with stock, variants, addons, and offer windows
4. Data source: `/api/restro/*` endpoints

### 3) `foodisthan-delivery`

1. Assigned order queue
2. Pickup verification
3. Delivery progress and status updates
4. Earnings and settlement history
5. Next phase: add dedicated `/api/delivery/*` routes

## Quality Check

Run lint:

```bash
npm run lint
```

The current code passes lint with the implemented changes.
