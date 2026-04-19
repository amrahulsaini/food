import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { execute, query, withTransaction } from "@/lib/db";

declare global {
  // Persist schema init promise across dev hot reloads.
  var __restroSchemaReadyPromise: Promise<void> | undefined;
}

export class InputError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "InputError";
    this.status = status;
  }
}

export interface Restaurant {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
  city: string | null;
  isOpen: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Category {
  id: number;
  restaurantId: number;
  name: string;
  description: string | null;
  parentCategoryId: number | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ItemVariant {
  id: number;
  itemId: number;
  name: string;
  priceDelta: number;
  stockQty: number;
  isDefault: boolean;
  sortOrder: number;
}

export interface ItemAddon {
  id: number;
  itemId: number;
  name: string;
  price: number;
  maxSelect: number;
  isRequired: boolean;
  isAvailable: boolean;
  sortOrder: number;
}

export interface Item {
  id: number;
  restaurantId: number;
  categoryId: number;
  categoryName: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
  stockQty: number;
  sku: string | null;
  isVeg: boolean;
  isAvailable: boolean;
  offerTitle: string | null;
  offerDiscountPercent: number | null;
  offerStartAt: string | null;
  offerEndAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  variants: ItemVariant[];
  addons: ItemAddon[];
}

export interface CategoryPayload {
  restaurantId: number;
  name: string;
  description: string | null;
  parentCategoryId: number | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ItemVariantPayload {
  name: string;
  priceDelta: number;
  stockQty: number;
  isDefault: boolean;
  sortOrder: number;
}

export interface ItemAddonPayload {
  name: string;
  price: number;
  maxSelect: number;
  isRequired: boolean;
  isAvailable: boolean;
  sortOrder: number;
}

export interface ItemPayload {
  restaurantId: number;
  categoryId: number;
  categoryName: string | null;
  skipVariantAddonSync: boolean;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
  stockQty: number;
  sku: string | null;
  isVeg: boolean;
  isAvailable: boolean;
  offerTitle: string | null;
  offerDiscountPercent: number | null;
  offerStartAt: string | null;
  offerEndAt: string | null;
  variants: ItemVariantPayload[];
  addons: ItemAddonPayload[];
}

interface RestaurantRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  city: string | null;
  is_open: number;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

let restroSchemaReadyPromise: Promise<void> | null = null;

interface CategoryRow extends RowDataPacket {
  id: number;
  restaurant_id: number;
  name: string;
  description: string | null;
  parent_category_id: number | null;
  image_url: string | null;
  sort_order: number;
  is_active: number;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

interface ItemRow extends RowDataPacket {
  id: number;
  restaurant_id: number;
  category_id: number;
  category_name: string;
  name: string;
  description: string | null;
  image_url: string | null;
  base_price: number;
  stock_qty: number;
  sku: string | null;
  is_veg: number;
  is_available: number;
  offer_title: string | null;
  offer_discount_percent: number | null;
  offer_start_at: Date | string | null;
  offer_end_at: Date | string | null;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

interface VariantRow extends RowDataPacket {
  id: number;
  item_id: number;
  name: string;
  price_delta: number;
  stock_qty: number;
  is_default: number;
  sort_order: number;
}

interface AddonRow extends RowDataPacket {
  id: number;
  item_id: number;
  name: string;
  price: number;
  max_select: number;
  is_required: number;
  is_available: number;
  sort_order: number;
}

const ITEM_LIST_CACHE_TTL_MS = 12_000;

interface ItemListCacheEntry {
  expiresAt: number;
  items: Item[];
}

const itemListCache = new Map<number, ItemListCacheEntry>();

function readItemListCache(restaurantId: number): Item[] | null {
  const cached = itemListCache.get(restaurantId);

  if (!cached) {
    return null;
  }

  if (Date.now() > cached.expiresAt) {
    itemListCache.delete(restaurantId);
    return null;
  }

  return cached.items;
}

function writeItemListCache(restaurantId: number, items: Item[]): void {
  itemListCache.set(restaurantId, {
    expiresAt: Date.now() + ITEM_LIST_CACHE_TTL_MS,
    items,
  });
}

function invalidateItemListCache(restaurantId: number): void {
  itemListCache.delete(restaurantId);
}

function logSlowItemListTiming(details: {
  restaurantId: number;
  totalMs: number;
  itemQueryMs: number;
  childQueryMs: number;
  mapMs: number;
  itemCount: number;
  variantCount: number;
  addonCount: number;
  cacheHit: boolean;
}): void {
  if (details.totalMs < 900) {
    return;
  }

  console.info("[restro-items] slow-list", details);
}

function toIso(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function toTrimmedString(value: unknown, maxLength = 255): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function toRequiredString(
  value: unknown,
  fieldName: string,
  maxLength = 255
): string {
  const text = toTrimmedString(value, maxLength);

  if (!text) {
    throw new InputError(`${fieldName} is required.`);
  }

  return text;
}

function toInteger(
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number } = {}
): number {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(num)) {
    throw new InputError(`${fieldName} must be a number.`);
  }

  const int = Math.trunc(num);

  if (options.min !== undefined && int < options.min) {
    throw new InputError(`${fieldName} must be at least ${options.min}.`);
  }

  if (options.max !== undefined && int > options.max) {
    throw new InputError(`${fieldName} must be at most ${options.max}.`);
  }

  return int;
}

function toOptionalInteger(
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number } = {}
): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return toInteger(value, fieldName, options);
}

function toDecimal(
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number } = {}
): number {
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(num)) {
    throw new InputError(`${fieldName} must be a valid number.`);
  }

  if (options.min !== undefined && num < options.min) {
    throw new InputError(`${fieldName} must be at least ${options.min}.`);
  }

  if (options.max !== undefined && num > options.max) {
    throw new InputError(`${fieldName} must be at most ${options.max}.`);
  }

  return Number(num.toFixed(2));
}

function toOptionalDecimal(
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number } = {}
): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return toDecimal(value, fieldName, options);
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const lower = value.toLowerCase();
    return lower === "1" || lower === "true" || lower === "yes";
  }

  return false;
}

function toMySqlDateTime(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new InputError(`${fieldName} must be a date string.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new InputError(`${fieldName} is not a valid date.`);
  }

  return date.toISOString().slice(0, 19).replace("T", " ");
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 160);
}

function mapRestaurant(row: RestaurantRow): Restaurant {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    imageUrl: row.image_url,
    city: row.city,
    isOpen: row.is_open === 1,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    name: row.name,
    description: row.description,
    parentCategoryId: row.parent_category_id,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    isActive: row.is_active === 1,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapItemCore(row: ItemRow): Omit<Item, "variants" | "addons"> {
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    name: row.name,
    description: row.description,
    imageUrl: row.image_url,
    basePrice: row.base_price,
    stockQty: row.stock_qty,
    sku: row.sku,
    isVeg: row.is_veg === 1,
    isAvailable: row.is_available === 1,
    offerTitle: row.offer_title,
    offerDiscountPercent: row.offer_discount_percent,
    offerStartAt: toIso(row.offer_start_at),
    offerEndAt: toIso(row.offer_end_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapVariant(row: VariantRow): ItemVariant {
  return {
    id: row.id,
    itemId: row.item_id,
    name: row.name,
    priceDelta: row.price_delta,
    stockQty: row.stock_qty,
    isDefault: row.is_default === 1,
    sortOrder: row.sort_order,
  };
}

function mapAddon(row: AddonRow): ItemAddon {
  return {
    id: row.id,
    itemId: row.item_id,
    name: row.name,
    price: row.price,
    maxSelect: row.max_select,
    isRequired: row.is_required === 1,
    isAvailable: row.is_available === 1,
    sortOrder: row.sort_order,
  };
}

function mapVariantPayload(
  itemId: number,
  variant: ItemVariantPayload,
  index: number
): ItemVariant {
  return {
    id: -(index + 1),
    itemId,
    name: variant.name,
    priceDelta: variant.priceDelta,
    stockQty: variant.stockQty,
    isDefault: variant.isDefault,
    sortOrder: variant.sortOrder,
  };
}

function mapAddonPayload(
  itemId: number,
  addon: ItemAddonPayload,
  index: number
): ItemAddon {
  return {
    id: -(index + 1),
    itemId,
    name: addon.name,
    price: addon.price,
    maxSelect: addon.maxSelect,
    isRequired: addon.isRequired,
    isAvailable: addon.isAvailable,
    sortOrder: addon.sortOrder,
  };
}

function toResponseDateTime(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.includes("T") ? value : value.replace(" ", "T");
}

function buildCategorySnapshot(
  categoryId: number,
  payload: CategoryPayload,
  createdAt: string | null
): Category {
  const now = new Date().toISOString();

  return {
    id: categoryId,
    restaurantId: payload.restaurantId,
    name: payload.name,
    description: payload.description,
    parentCategoryId: payload.parentCategoryId,
    imageUrl: payload.imageUrl,
    sortOrder: payload.sortOrder,
    isActive: payload.isActive,
    createdAt,
    updatedAt: now,
  };
}

function buildItemSnapshot(itemId: number, payload: ItemPayload, createdAt: string | null): Item {
  const now = new Date().toISOString();

  return {
    id: itemId,
    restaurantId: payload.restaurantId,
    categoryId: payload.categoryId,
    categoryName: payload.categoryName ?? "",
    name: payload.name,
    description: payload.description,
    imageUrl: payload.imageUrl,
    basePrice: payload.basePrice,
    stockQty: payload.stockQty,
    sku: payload.sku,
    isVeg: payload.isVeg,
    isAvailable: payload.isAvailable,
    offerTitle: payload.offerTitle,
    offerDiscountPercent: payload.offerDiscountPercent,
    offerStartAt: toResponseDateTime(payload.offerStartAt),
    offerEndAt: toResponseDateTime(payload.offerEndAt),
    createdAt,
    updatedAt: now,
    variants: payload.variants.map((variant, index) =>
      mapVariantPayload(itemId, variant, index)
    ),
    addons: payload.addons.map((addon, index) => mapAddonPayload(itemId, addon, index)),
  };
}

function parseVariantPayload(raw: unknown, index: number): ItemVariantPayload {
  const value = raw as Record<string, unknown>;

  return {
    name: toRequiredString(value.name, `Variant #${index + 1} name`, 100),
    priceDelta: toDecimal(value.priceDelta, `Variant #${index + 1} priceDelta`, {
      min: -100000,
      max: 100000,
    }),
    stockQty: toInteger(value.stockQty ?? 0, `Variant #${index + 1} stockQty`, {
      min: 0,
      max: 100000,
    }),
    isDefault: toBoolean(value.isDefault),
    sortOrder: toInteger(value.sortOrder ?? index, `Variant #${index + 1} sortOrder`, {
      min: 0,
      max: 100000,
    }),
  };
}

function parseAddonPayload(raw: unknown, index: number): ItemAddonPayload {
  const value = raw as Record<string, unknown>;

  return {
    name: toRequiredString(value.name, `Addon #${index + 1} name`, 100),
    price: toDecimal(value.price, `Addon #${index + 1} price`, {
      min: 0,
      max: 100000,
    }),
    maxSelect: toInteger(value.maxSelect ?? 1, `Addon #${index + 1} maxSelect`, {
      min: 1,
      max: 100,
    }),
    isRequired: toBoolean(value.isRequired),
    isAvailable: toBoolean(value.isAvailable ?? true),
    sortOrder: toInteger(value.sortOrder ?? index, `Addon #${index + 1} sortOrder`, {
      min: 0,
      max: 100000,
    }),
  };
}

export function parseCategoryPayload(body: unknown): CategoryPayload {
  const value = body as Record<string, unknown>;

  return {
    restaurantId: toInteger(value.restaurantId, "restaurantId", { min: 1 }),
    name: toRequiredString(value.name, "Category name", 120),
    description: toTrimmedString(value.description, 500),
    parentCategoryId: toOptionalInteger(value.parentCategoryId, "parentCategoryId", {
      min: 1,
    }),
    imageUrl: toTrimmedString(value.imageUrl, 500),
    sortOrder: toInteger(value.sortOrder ?? 0, "sortOrder", { min: 0, max: 100000 }),
    isActive: value.isActive === undefined ? true : toBoolean(value.isActive),
  };
}

export function parseItemPayload(body: unknown): ItemPayload {
  const value = body as Record<string, unknown>;

  const variantsSource = Array.isArray(value.variants) ? value.variants : [];
  const addonsSource = Array.isArray(value.addons) ? value.addons : [];

  return {
    restaurantId: toInteger(value.restaurantId, "restaurantId", { min: 1 }),
    categoryId: toInteger(value.categoryId, "categoryId", { min: 1 }),
    categoryName: toTrimmedString(value.categoryName, 120),
    skipVariantAddonSync: toBoolean(value.skipVariantAddonSync),
    name: toRequiredString(value.name, "Item name", 150),
    description: toTrimmedString(value.description, 1000),
    imageUrl: toTrimmedString(value.imageUrl, 500),
    basePrice: toDecimal(value.basePrice, "basePrice", {
      min: 0.01,
      max: 100000,
    }),
    stockQty: toInteger(value.stockQty ?? 0, "stockQty", { min: 0, max: 1000000 }),
    sku: toTrimmedString(value.sku, 80),
    isVeg: toBoolean(value.isVeg),
    isAvailable: value.isAvailable === undefined ? true : toBoolean(value.isAvailable),
    offerTitle: toTrimmedString(value.offerTitle, 100),
    offerDiscountPercent: toOptionalDecimal(
      value.offerDiscountPercent,
      "offerDiscountPercent",
      { min: 0, max: 100 }
    ),
    offerStartAt: toMySqlDateTime(value.offerStartAt, "offerStartAt"),
    offerEndAt: toMySqlDateTime(value.offerEndAt, "offerEndAt"),
    variants: variantsSource.map(parseVariantPayload),
    addons: addonsSource.map(parseAddonPayload),
  };
}

async function insertVariants(
  connection: PoolConnection,
  itemId: number,
  variants: ItemVariantPayload[]
): Promise<void> {
  if (variants.length === 0) {
    return;
  }

  const chunkSize = 100;

  for (let offset = 0; offset < variants.length; offset += chunkSize) {
    const chunk = variants.slice(offset, offset + chunkSize);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
    const params: Array<number | string> = [];

    for (const variant of chunk) {
      params.push(
        itemId,
        variant.name,
        variant.priceDelta,
        variant.stockQty,
        variant.isDefault ? 1 : 0,
        variant.sortOrder
      );
    }

    await connection.execute<ResultSetHeader>(
      `INSERT INTO item_variants
      (item_id, name, price_delta, stock_qty, is_default, sort_order)
      VALUES ${placeholders}`,
      params
    );
  }
}

async function insertVariantsDirect(
  itemId: number,
  variants: ItemVariantPayload[]
): Promise<void> {
  if (variants.length === 0) {
    return;
  }

  const chunkSize = 100;

  for (let offset = 0; offset < variants.length; offset += chunkSize) {
    const chunk = variants.slice(offset, offset + chunkSize);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");
    const params: Array<number | string> = [];

    for (const variant of chunk) {
      params.push(
        itemId,
        variant.name,
        variant.priceDelta,
        variant.stockQty,
        variant.isDefault ? 1 : 0,
        variant.sortOrder
      );
    }

    await execute(
      `INSERT INTO item_variants
      (item_id, name, price_delta, stock_qty, is_default, sort_order)
      VALUES ${placeholders}`,
      params
    );
  }
}

async function replaceVariants(
  connection: PoolConnection,
  itemId: number,
  variants: ItemVariantPayload[]
): Promise<void> {
  await connection.execute<ResultSetHeader>(
    "DELETE FROM item_variants WHERE item_id = ?",
    [itemId]
  );

  await insertVariants(connection, itemId, variants);
}

async function insertAddons(
  connection: PoolConnection,
  itemId: number,
  addons: ItemAddonPayload[]
): Promise<void> {
  if (addons.length === 0) {
    return;
  }

  const chunkSize = 100;

  for (let offset = 0; offset < addons.length; offset += chunkSize) {
    const chunk = addons.slice(offset, offset + chunkSize);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
    const params: Array<number | string> = [];

    for (const addon of chunk) {
      params.push(
        itemId,
        addon.name,
        addon.price,
        addon.maxSelect,
        addon.isRequired ? 1 : 0,
        addon.isAvailable ? 1 : 0,
        addon.sortOrder
      );
    }

    await connection.execute<ResultSetHeader>(
      `INSERT INTO item_addons
      (item_id, name, price, max_select, is_required, is_available, sort_order)
      VALUES ${placeholders}`,
      params
    );
  }
}

async function insertAddonsDirect(itemId: number, addons: ItemAddonPayload[]): Promise<void> {
  if (addons.length === 0) {
    return;
  }

  const chunkSize = 100;

  for (let offset = 0; offset < addons.length; offset += chunkSize) {
    const chunk = addons.slice(offset, offset + chunkSize);
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?, ?, ?)").join(", ");
    const params: Array<number | string> = [];

    for (const addon of chunk) {
      params.push(
        itemId,
        addon.name,
        addon.price,
        addon.maxSelect,
        addon.isRequired ? 1 : 0,
        addon.isAvailable ? 1 : 0,
        addon.sortOrder
      );
    }

    await execute(
      `INSERT INTO item_addons
      (item_id, name, price, max_select, is_required, is_available, sort_order)
      VALUES ${placeholders}`,
      params
    );
  }
}

function logSlowItemCreateTiming(details: {
  totalMs: number;
  insertItemMs: number;
  insertChildrenMs: number;
  variantCount: number;
  addonCount: number;
}): void {
  if (details.totalMs < 900) {
    return;
  }

  console.info("[restro-items] slow-create", details);
}

async function replaceAddons(
  connection: PoolConnection,
  itemId: number,
  addons: ItemAddonPayload[]
): Promise<void> {
  await connection.execute<ResultSetHeader>("DELETE FROM item_addons WHERE item_id = ?", [
    itemId,
  ]);

  await insertAddons(connection, itemId, addons);
}

async function runRestroSchemaSetup(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id BIGINT NOT NULL AUTO_INCREMENT,
      name VARCHAR(150) NOT NULL,
      slug VARCHAR(160) NOT NULL,
      image_url VARCHAR(500) NULL,
      phone VARCHAR(25) NULL,
      email VARCHAR(120) NULL,
      address TEXT NULL,
      city VARCHAR(80) NULL,
      open_time TIME NULL,
      close_time TIME NULL,
      is_open TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_restaurant_slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const rows = await query<Array<RowDataPacket & { total: number }>>(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'restaurants'
       AND COLUMN_NAME = 'image_url'`
  );

  if ((rows[0]?.total ?? 0) === 0) {
    await execute(`
      ALTER TABLE restaurants
      ADD COLUMN image_url VARCHAR(500) NULL
      AFTER slug
    `);
  }

  await execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id BIGINT NOT NULL AUTO_INCREMENT,
      restaurant_id BIGINT NOT NULL,
      name VARCHAR(120) NOT NULL,
      description VARCHAR(500) NULL,
      parent_category_id BIGINT NULL,
      image_url VARCHAR(500) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_categories_restaurant (restaurant_id),
      KEY idx_categories_parent (parent_category_id),
      CONSTRAINT fk_categories_restaurant
        FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_categories_parent
        FOREIGN KEY (parent_category_id)
        REFERENCES categories(id)
        ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS items (
      id BIGINT NOT NULL AUTO_INCREMENT,
      restaurant_id BIGINT NOT NULL,
      category_id BIGINT NOT NULL,
      name VARCHAR(150) NOT NULL,
      description VARCHAR(1000) NULL,
      image_url VARCHAR(500) NULL,
      base_price DECIMAL(10,2) NOT NULL,
      stock_qty INT NOT NULL DEFAULT 0,
      sku VARCHAR(80) NULL,
      is_veg TINYINT(1) NOT NULL DEFAULT 0,
      is_available TINYINT(1) NOT NULL DEFAULT 1,
      offer_title VARCHAR(100) NULL,
      offer_discount_percent DECIMAL(5,2) NULL,
      offer_start_at DATETIME NULL,
      offer_end_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_items_restaurant (restaurant_id),
      KEY idx_items_category (category_id),
      UNIQUE KEY uniq_items_sku (restaurant_id, sku),
      CONSTRAINT fk_items_restaurant
        FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_items_category
        FOREIGN KEY (category_id)
        REFERENCES categories(id)
        ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS item_variants (
      id BIGINT NOT NULL AUTO_INCREMENT,
      item_id BIGINT NOT NULL,
      name VARCHAR(100) NOT NULL,
      price_delta DECIMAL(10,2) NOT NULL DEFAULT 0,
      stock_qty INT NOT NULL DEFAULT 0,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      KEY idx_item_variants_item (item_id),
      CONSTRAINT fk_item_variants_item
        FOREIGN KEY (item_id)
        REFERENCES items(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await execute(`
    CREATE TABLE IF NOT EXISTS item_addons (
      id BIGINT NOT NULL AUTO_INCREMENT,
      item_id BIGINT NOT NULL,
      name VARCHAR(100) NOT NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      max_select INT NOT NULL DEFAULT 1,
      is_required TINYINT(1) NOT NULL DEFAULT 0,
      is_available TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      KEY idx_item_addons_item (item_id),
      CONSTRAINT fk_item_addons_item
        FOREIGN KEY (item_id)
        REFERENCES items(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

}

export async function ensureRestroSchema(): Promise<void> {
  if (process.env.NODE_ENV !== "production" && global.__restroSchemaReadyPromise) {
    restroSchemaReadyPromise = global.__restroSchemaReadyPromise;
  }

  if (!restroSchemaReadyPromise) {
    restroSchemaReadyPromise = runRestroSchemaSetup().catch((error) => {
      restroSchemaReadyPromise = null;

      if (process.env.NODE_ENV !== "production") {
        global.__restroSchemaReadyPromise = undefined;
      }

      throw error;
    });

    if (process.env.NODE_ENV !== "production") {
      global.__restroSchemaReadyPromise = restroSchemaReadyPromise;
    }
  }

  await restroSchemaReadyPromise;
}

export async function listRestaurants(): Promise<Restaurant[]> {
  const rows = await query<RestaurantRow[]>(
    `SELECT id, name, slug, image_url, city, is_open, created_at, updated_at
     FROM restaurants
     ORDER BY id ASC`
  );

  return rows.map(mapRestaurant);
}

export async function createRestaurant(payload: {
  name: unknown;
  city?: unknown;
  slug?: unknown;
}): Promise<Restaurant> {
  const name = toRequiredString(payload.name, "Restaurant name", 150);
  const city = toTrimmedString(payload.city, 80);
  const slug =
    toTrimmedString(payload.slug, 160)?.toLowerCase() ?? slugify(name);

  if (!slug) {
    throw new InputError("Unable to generate a valid slug for this restaurant.");
  }

  await execute(
    `INSERT INTO restaurants (name, slug, city)
     VALUES (?, ?, ?)`,
    [name, slug, city]
  );

  const rows = await query<RestaurantRow[]>(
    `SELECT id, name, slug, image_url, city, is_open, created_at, updated_at
     FROM restaurants
     WHERE slug = ?
     LIMIT 1`,
    [slug]
  );

  const restaurant = rows[0];

  if (!restaurant) {
    throw new Error("Restaurant created but failed to fetch record.");
  }

  return mapRestaurant(restaurant);
}

export async function getCategoriesByRestaurant(
  restaurantId: number
): Promise<Category[]> {
  const rows = await query<CategoryRow[]>(
    `SELECT id, restaurant_id, name, description, parent_category_id,
            image_url, sort_order, is_active, created_at, updated_at
     FROM categories
     WHERE restaurant_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [restaurantId]
  );

  return rows.map(mapCategory);
}

export async function createCategory(payload: CategoryPayload): Promise<Category> {
  const result = await execute(
    `INSERT INTO categories
    (restaurant_id, name, description, parent_category_id, image_url, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.restaurantId,
      payload.name,
      payload.description,
      payload.parentCategoryId,
      payload.imageUrl,
      payload.sortOrder,
      payload.isActive ? 1 : 0,
    ]
  );

  return buildCategorySnapshot(Number(result.insertId), payload, new Date().toISOString());
}

export async function updateCategory(
  categoryId: number,
  payload: CategoryPayload
): Promise<Category> {
  if (payload.parentCategoryId === categoryId) {
    throw new InputError("A category cannot be parent of itself.");
  }

  const result = await execute(
    `UPDATE categories
     SET name = ?,
         description = ?,
         parent_category_id = ?,
         image_url = ?,
         sort_order = ?,
         is_active = ?
     WHERE id = ? AND restaurant_id = ?`,
    [
      payload.name,
      payload.description,
      payload.parentCategoryId,
      payload.imageUrl,
      payload.sortOrder,
      payload.isActive ? 1 : 0,
      categoryId,
      payload.restaurantId,
    ]
  );

  if (result.affectedRows === 0) {
    throw new InputError("Category not found.", 404);
  }

  return buildCategorySnapshot(categoryId, payload, null);
}

export async function deleteCategory(
  categoryId: number,
  restaurantId: number
): Promise<void> {
  const itemCountRows = await query<Array<RowDataPacket & { total: number }>>(
    `SELECT COUNT(*) AS total
     FROM items
     WHERE category_id = ? AND restaurant_id = ?`,
    [categoryId, restaurantId]
  );

  if ((itemCountRows[0]?.total ?? 0) > 0) {
    throw new InputError(
      "Cannot delete category with items. Move or delete those items first."
    );
  }

  const result = await execute(
    `DELETE FROM categories WHERE id = ? AND restaurant_id = ?`,
    [categoryId, restaurantId]
  );

  if (result.affectedRows === 0) {
    throw new InputError("Category not found.", 404);
  }
}

export async function getItemsByRestaurant(restaurantId: number): Promise<Item[]> {
  const startedAt = Date.now();
  const cachedItems = readItemListCache(restaurantId);

  if (cachedItems) {
    logSlowItemListTiming({
      restaurantId,
      totalMs: Date.now() - startedAt,
      itemQueryMs: 0,
      childQueryMs: 0,
      mapMs: 0,
      itemCount: cachedItems.length,
      variantCount: cachedItems.reduce((acc, item) => acc + item.variants.length, 0),
      addonCount: cachedItems.reduce((acc, item) => acc + item.addons.length, 0),
      cacheHit: true,
    });

    return cachedItems;
  }

  const itemQueryStartedAt = Date.now();
  const itemRows = await query<ItemRow[]>(
    `SELECT i.id, i.restaurant_id, i.category_id, c.name AS category_name,
            i.name, i.description, i.image_url, i.base_price, i.stock_qty,
            i.sku, i.is_veg, i.is_available,
            i.offer_title, i.offer_discount_percent, i.offer_start_at, i.offer_end_at,
            i.created_at, i.updated_at
     FROM items i
     INNER JOIN categories c ON c.id = i.category_id
     WHERE i.restaurant_id = ?
     ORDER BY i.updated_at DESC, i.id DESC`,
    [restaurantId]
  );
  const itemQueryMs = Date.now() - itemQueryStartedAt;

  if (itemRows.length === 0) {
    writeItemListCache(restaurantId, []);
    logSlowItemListTiming({
      restaurantId,
      totalMs: Date.now() - startedAt,
      itemQueryMs,
      childQueryMs: 0,
      mapMs: 0,
      itemCount: 0,
      variantCount: 0,
      addonCount: 0,
      cacheHit: false,
    });
    return [];
  }

  const itemIds = itemRows.map((row) => row.id);
  const chunkSize = 250;

  const childQueryStartedAt = Date.now();

  const variantChunkPromises: Array<Promise<VariantRow[]>> = [];
  const addonChunkPromises: Array<Promise<AddonRow[]>> = [];

  for (let offset = 0; offset < itemIds.length; offset += chunkSize) {
    const chunk = itemIds.slice(offset, offset + chunkSize);
    const placeholders = chunk.map(() => "?").join(", ");

    variantChunkPromises.push(
      query<VariantRow[]>(
        `SELECT id, item_id, name, price_delta, stock_qty, is_default, sort_order
         FROM item_variants
         WHERE item_id IN (${placeholders})`,
        chunk
      )
    );

    addonChunkPromises.push(
      query<AddonRow[]>(
        `SELECT id, item_id, name, price, max_select, is_required, is_available, sort_order
         FROM item_addons
         WHERE item_id IN (${placeholders})`,
        chunk
      )
    );
  }

  const [variantChunks, addonChunks] = await Promise.all([
    Promise.all(variantChunkPromises),
    Promise.all(addonChunkPromises),
  ]);

  const variantRows = variantChunks.flat();
  const addonRows = addonChunks.flat();

  variantRows.sort(
    (left, right) =>
      left.item_id - right.item_id || left.sort_order - right.sort_order || left.id - right.id
  );

  addonRows.sort(
    (left, right) =>
      left.item_id - right.item_id || left.sort_order - right.sort_order || left.id - right.id
  );

  const childQueryMs = Date.now() - childQueryStartedAt;

  const variantsByItem = new Map<number, ItemVariant[]>();
  const addonsByItem = new Map<number, ItemAddon[]>();

  for (const row of variantRows) {
    const mapped = mapVariant(row);
    const list = variantsByItem.get(mapped.itemId) ?? [];
    list.push(mapped);
    variantsByItem.set(mapped.itemId, list);
  }

  for (const row of addonRows) {
    const mapped = mapAddon(row);
    const list = addonsByItem.get(mapped.itemId) ?? [];
    list.push(mapped);
    addonsByItem.set(mapped.itemId, list);
  }

  const mapStartedAt = Date.now();
  const items = itemRows.map((row) => {
    const core = mapItemCore(row);

    return {
      ...core,
      variants: variantsByItem.get(row.id) ?? [],
      addons: addonsByItem.get(row.id) ?? [],
    };
  });

  writeItemListCache(restaurantId, items);

  logSlowItemListTiming({
    restaurantId,
    totalMs: Date.now() - startedAt,
    itemQueryMs,
    childQueryMs,
    mapMs: Date.now() - mapStartedAt,
    itemCount: items.length,
    variantCount: variantRows.length,
    addonCount: addonRows.length,
    cacheHit: false,
  });

  return items;
}

export async function createItem(payload: ItemPayload): Promise<Item> {
  const startedAt = Date.now();

  if (payload.variants.length === 0 && payload.addons.length === 0) {
    const insertStartedAt = Date.now();
    const result = await execute(
      `INSERT INTO items
      (restaurant_id, category_id, name, description, image_url, base_price,
       stock_qty, sku, is_veg, is_available, offer_title, offer_discount_percent,
       offer_start_at, offer_end_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.restaurantId,
        payload.categoryId,
        payload.name,
        payload.description,
        payload.imageUrl,
        payload.basePrice,
        payload.stockQty,
        payload.sku,
        payload.isVeg ? 1 : 0,
        payload.isAvailable ? 1 : 0,
        payload.offerTitle,
        payload.offerDiscountPercent,
        payload.offerStartAt,
        payload.offerEndAt,
      ]
    );

    logSlowItemCreateTiming({
      totalMs: Date.now() - startedAt,
      insertItemMs: Date.now() - insertStartedAt,
      insertChildrenMs: 0,
      variantCount: 0,
      addonCount: 0,
    });

    invalidateItemListCache(payload.restaurantId);

    return buildItemSnapshot(Number(result.insertId), payload, new Date().toISOString());
  }

  const insertStartedAt = Date.now();
  const result = await execute(
    `INSERT INTO items
    (restaurant_id, category_id, name, description, image_url, base_price,
     stock_qty, sku, is_veg, is_available, offer_title, offer_discount_percent,
     offer_start_at, offer_end_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.restaurantId,
      payload.categoryId,
      payload.name,
      payload.description,
      payload.imageUrl,
      payload.basePrice,
      payload.stockQty,
      payload.sku,
      payload.isVeg ? 1 : 0,
      payload.isAvailable ? 1 : 0,
      payload.offerTitle,
      payload.offerDiscountPercent,
      payload.offerStartAt,
      payload.offerEndAt,
    ]
  );
  const insertItemMs = Date.now() - insertStartedAt;
  const itemId = Number(result.insertId);

  const childrenStartedAt = Date.now();

  try {
    await Promise.all([
      insertVariantsDirect(itemId, payload.variants),
      insertAddonsDirect(itemId, payload.addons),
    ]);
  } catch (error) {
    await execute(
      `DELETE FROM items
       WHERE id = ? AND restaurant_id = ?
       LIMIT 1`,
      [itemId, payload.restaurantId]
    );

    throw error;
  }

  logSlowItemCreateTiming({
    totalMs: Date.now() - startedAt,
    insertItemMs,
    insertChildrenMs: Date.now() - childrenStartedAt,
    variantCount: payload.variants.length,
    addonCount: payload.addons.length,
  });

  invalidateItemListCache(payload.restaurantId);

  return buildItemSnapshot(itemId, payload, new Date().toISOString());
}

export async function updateItem(
  itemId: number,
  payload: ItemPayload
): Promise<Item> {
  if (
    payload.skipVariantAddonSync &&
    payload.variants.length === 0 &&
    payload.addons.length === 0
  ) {
    const result = await execute(
      `UPDATE items
       SET category_id = ?,
           name = ?,
           description = ?,
           image_url = ?,
           base_price = ?,
           stock_qty = ?,
           sku = ?,
           is_veg = ?,
           is_available = ?,
           offer_title = ?,
           offer_discount_percent = ?,
           offer_start_at = ?,
           offer_end_at = ?
       WHERE id = ? AND restaurant_id = ?`,
      [
        payload.categoryId,
        payload.name,
        payload.description,
        payload.imageUrl,
        payload.basePrice,
        payload.stockQty,
        payload.sku,
        payload.isVeg ? 1 : 0,
        payload.isAvailable ? 1 : 0,
        payload.offerTitle,
        payload.offerDiscountPercent,
        payload.offerStartAt,
        payload.offerEndAt,
        itemId,
        payload.restaurantId,
      ]
    );

    if (result.affectedRows === 0) {
      throw new InputError("Item not found.", 404);
    }

    invalidateItemListCache(payload.restaurantId);

    return buildItemSnapshot(itemId, payload, null);
  }

  await withTransaction(async (connection) => {
    const [result] = await connection.execute<ResultSetHeader>(
      `UPDATE items
       SET category_id = ?,
           name = ?,
           description = ?,
           image_url = ?,
           base_price = ?,
           stock_qty = ?,
           sku = ?,
           is_veg = ?,
           is_available = ?,
           offer_title = ?,
           offer_discount_percent = ?,
           offer_start_at = ?,
           offer_end_at = ?
       WHERE id = ? AND restaurant_id = ?`,
      [
        payload.categoryId,
        payload.name,
        payload.description,
        payload.imageUrl,
        payload.basePrice,
        payload.stockQty,
        payload.sku,
        payload.isVeg ? 1 : 0,
        payload.isAvailable ? 1 : 0,
        payload.offerTitle,
        payload.offerDiscountPercent,
        payload.offerStartAt,
        payload.offerEndAt,
        itemId,
        payload.restaurantId,
      ]
    );

    if (result.affectedRows === 0) {
      throw new InputError("Item not found.", 404);
    }

    await replaceVariants(connection, itemId, payload.variants);
    await replaceAddons(connection, itemId, payload.addons);
  });

  invalidateItemListCache(payload.restaurantId);

  return buildItemSnapshot(itemId, payload, null);
}

export async function deleteItem(itemId: number, restaurantId: number): Promise<void> {
  const result = await execute(
    `DELETE FROM items WHERE id = ? AND restaurant_id = ?`,
    [itemId, restaurantId]
  );

  if (result.affectedRows === 0) {
    throw new InputError("Item not found.", 404);
  }

  invalidateItemListCache(restaurantId);
}

export async function getCustomerMenu(restaurantId: number): Promise<{
  restaurant: Restaurant | null;
  categories: Array<Category & { items: Item[] }>;
}> {
  const restaurants = await query<RestaurantRow[]>(
    `SELECT id, name, slug, image_url, city, is_open, created_at, updated_at
     FROM restaurants
     WHERE id = ?
     LIMIT 1`,
    [restaurantId]
  );

  const restaurant = restaurants[0] ? mapRestaurant(restaurants[0]) : null;

  if (!restaurant) {
    return {
      restaurant: null,
      categories: [],
    };
  }

  const categories = (await getCategoriesByRestaurant(restaurantId)).filter(
    (category) => category.isActive
  );
  const items = (await getItemsByRestaurant(restaurantId)).filter(
    (item) => item.isAvailable
  );

  const menuCategories = categories.map((category) => ({
    ...category,
    items: items.filter((item) => item.categoryId === category.id),
  }));

  return {
    restaurant,
    categories: menuCategories,
  };
}

export function parseRestaurantId(value: unknown): number {
  return toInteger(value, "restaurantId", { min: 1 });
}
