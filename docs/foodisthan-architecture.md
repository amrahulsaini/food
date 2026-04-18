# Foodisthan Architecture (Phase 1)

## Product Split

1. `foodisthan-customer` (Flutter)
2. `foodisthan-restro` (Flutter)
3. `foodisthan-delivery` (Flutter)
4. `restrologin` (web portal in this repo)

## Responsibility Map

1. Customer app: browsing and ordering UX
2. Restro app/web: catalog and inventory operations
3. Delivery app: fulfillment workflow
4. Next.js backend: API layer and MySQL access

## Current Backend Scope

1. Restaurant bootstrap and creation
2. Parent/sub category management
3. Item CRUD with stock, SKU, veg flag
4. Variants (price delta + stock)
5. Add-ons (price + max selection + required)
6. Offer title/discount/date windows

## API-First Mobile Strategy

1. Use `/api/customer/menu` for customer-side listing
2. Use `/api/restro/categories` for category workflows
3. Use `/api/restro/items` for item workflows
4. Keep request/response models stable for Flutter integration

## Suggested Flutter Folder Structure

```text
lib/
  core/
    api/
    theme/
    constants/
  features/
    customer/
      menu/
      cart/
      checkout/
    restro/
      auth/
      categories/
      items/
      offers/
    delivery/
      orders/
      tracking/
      earnings/
  shared/
    widgets/
    models/
```

## Phase 2 Backend Additions

1. Auth with JWT/session for restro and delivery
2. Order placement and lifecycle states
3. Payment integration hooks
4. Delivery assignment engine
5. Real-time notifications/websocket updates
6. Analytics dashboards (sales, item performance)
