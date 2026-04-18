import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { execute, query, withTransaction } from "@/lib/db";
import { ensureRestroSchema, InputError } from "@/lib/restro-data";

const PASSWORD_KEYLEN = 64;
const ACCOUNT_STATUS_VALUES = [
  "approved",
  "suspended",
  "rejected",
  "on_hold",
] as const;

export type RestaurantAccountStatus = (typeof ACCOUNT_STATUS_VALUES)[number];

interface RestaurantAccountRow extends RowDataPacket {
  restaurant_id: number;
  restaurant_name: string;
  slug: string;
  owner_name: string;
  mobile_number: string;
  email: string;
  password_hash: string;
  address_line1: string;
  address_line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  gstin: string | null;
  sgst_percent: number;
  cgst_percent: number;
  account_status: string;
  is_open: number;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

interface MysqlErrorLike {
  code?: string;
  message?: string;
  sqlMessage?: string;
}

export interface RestaurantAuthProfile {
  restaurantId: number;
  restaurantName: string;
  slug: string;
  ownerName: string;
  mobileNumber: string;
  email: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  gstin: string | null;
  sgstPercent: number;
  cgstPercent: number;
  accountStatus: RestaurantAccountStatus;
  isOpen: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RestaurantRegistrationPayload {
  restaurantName: string;
  ownerName: string;
  mobileNumber: string;
  email: string;
  password: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  gstin: string | null;
  sgstPercent: number;
  cgstPercent: number;
}

export interface RestaurantLoginPayload {
  email: string;
  password: string;
}

function isDuplicateKey(error: unknown, keyName?: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const mysqlError = error as MysqlErrorLike;

  if (mysqlError.code !== "ER_DUP_ENTRY") {
    return false;
  }

  if (!keyName) {
    return true;
  }

  const rawMessage = mysqlError.message ?? mysqlError.sqlMessage ?? "";
  return rawMessage.includes(keyName);
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

function normalizeAccountStatus(value: unknown): RestaurantAccountStatus {
  if (typeof value !== "string") {
    return "on_hold";
  }

  const lowered = value.toLowerCase() as RestaurantAccountStatus;

  if ((ACCOUNT_STATUS_VALUES as readonly string[]).includes(lowered)) {
    return lowered;
  }

  return "on_hold";
}

function statusLoginMessage(status: RestaurantAccountStatus): string {
  if (status === "approved") {
    return "Account approved.";
  }

  if (status === "suspended") {
    return "Your account is suspended. Please contact admin.";
  }

  if (status === "rejected") {
    return "Your account is rejected. Please contact admin.";
  }

  return "Your account is on hold. Wait for admin approval.";
}

function toText(value: unknown, fieldName: string, maxLength = 255): string {
  if (typeof value !== "string") {
    throw new InputError(`${fieldName} is required.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new InputError(`${fieldName} is required.`);
  }

  return trimmed.slice(0, maxLength);
}

function toOptionalText(value: unknown, maxLength = 255): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function toEmail(value: unknown): string {
  const email = toText(value, "Email", 140).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new InputError("Email format is invalid.");
  }

  return email;
}

function toMobileNumber(value: unknown): string {
  const raw = toText(value, "Mobile number", 20);
  const normalized = raw.replace(/[^0-9]/g, "");

  if (!/^\d{10,15}$/.test(normalized)) {
    throw new InputError("Mobile number must contain 10 to 15 digits.");
  }

  return normalized;
}

function toPincode(value: unknown): string {
  const pincode = toText(value, "Pincode", 12).replace(/\s+/g, "");

  if (!/^\d{6}$/.test(pincode)) {
    throw new InputError("Pincode must be a valid 6-digit code.");
  }

  return pincode;
}

function toPassword(value: unknown): string {
  if (typeof value !== "string") {
    throw new InputError("Password is required.");
  }

  if (value.length < 8) {
    throw new InputError("Password must be at least 8 characters.");
  }

  if (value.length > 72) {
    throw new InputError("Password is too long.");
  }

  return value;
}

function toPercent(value: unknown, fieldName: string): number {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(raw)) {
    throw new InputError(`${fieldName} must be a number.`);
  }

  if (raw < 0 || raw > 100) {
    throw new InputError(`${fieldName} must be between 0 and 100.`);
  }

  return Number(raw.toFixed(2));
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 150);
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, PASSWORD_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, stored] = storedHash.split(":");

  if (!salt || !stored) {
    return false;
  }

  const computed = scryptSync(password, salt, PASSWORD_KEYLEN);
  const expected = Buffer.from(stored, "hex");

  if (computed.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(expected, computed);
}

function mapProfile(row: RestaurantAccountRow): RestaurantAuthProfile {
  return {
    restaurantId: row.restaurant_id,
    restaurantName: row.restaurant_name,
    slug: row.slug,
    ownerName: row.owner_name,
    mobileNumber: row.mobile_number,
    email: row.email,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    landmark: row.landmark,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    gstin: row.gstin,
    sgstPercent: row.sgst_percent,
    cgstPercent: row.cgst_percent,
    accountStatus: normalizeAccountStatus(row.account_status),
    isOpen: row.is_open === 1,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function parseObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new InputError("Invalid request body.");
  }

  return body as Record<string, unknown>;
}

export function parseRestaurantRegistrationPayload(
  body: unknown
): RestaurantRegistrationPayload {
  const value = parseObject(body);

  return {
    restaurantName: toText(value.restaurantName, "Restaurant name", 150),
    ownerName: toText(value.ownerName, "Owner name", 120),
    mobileNumber: toMobileNumber(value.mobileNumber),
    email: toEmail(value.email),
    password: toPassword(value.password),
    addressLine1: toText(value.addressLine1, "Address line 1", 220),
    addressLine2: toOptionalText(value.addressLine2, 220),
    landmark: toOptionalText(value.landmark, 120),
    city: toText(value.city, "City", 80),
    state: toText(value.state, "State", 80),
    pincode: toPincode(value.pincode),
    gstin: toOptionalText(value.gstin, 25),
    sgstPercent: toPercent(value.sgstPercent, "SGST percent"),
    cgstPercent: toPercent(value.cgstPercent, "CGST percent"),
  };
}

export function parseRestaurantLoginPayload(body: unknown): RestaurantLoginPayload {
  const value = parseObject(body);

  return {
    email: toEmail(value.email),
    password: toText(value.password, "Password", 72),
  };
}

export async function ensureRestroAuthSchema(): Promise<void> {
  await ensureRestroSchema();

  await execute(`
    CREATE TABLE IF NOT EXISTS restaurant_accounts (
      id BIGINT NOT NULL AUTO_INCREMENT,
      restaurant_id BIGINT NOT NULL,
      owner_name VARCHAR(120) NOT NULL,
      mobile_number VARCHAR(20) NOT NULL,
      email VARCHAR(140) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      address_line1 VARCHAR(220) NOT NULL,
      address_line2 VARCHAR(220) NULL,
      landmark VARCHAR(120) NULL,
      city VARCHAR(80) NOT NULL,
      state VARCHAR(80) NOT NULL,
      pincode VARCHAR(12) NOT NULL,
      gstin VARCHAR(25) NULL,
      sgst_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
      cgst_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
      account_status VARCHAR(20) NOT NULL DEFAULT 'on_hold',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_restro_accounts_restaurant (restaurant_id),
      UNIQUE KEY uniq_restro_accounts_email (email),
      CONSTRAINT fk_restro_accounts_restaurant
        FOREIGN KEY (restaurant_id)
        REFERENCES restaurants(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const rows = await query<Array<RowDataPacket & { total: number }>>(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'restaurant_accounts'
       AND COLUMN_NAME = 'account_status'`
  );

  if ((rows[0]?.total ?? 0) === 0) {
    await execute(`
      ALTER TABLE restaurant_accounts
      ADD COLUMN account_status VARCHAR(20) NOT NULL DEFAULT 'on_hold'
      AFTER cgst_percent
    `);
  }

  await execute(`
    UPDATE restaurant_accounts
    SET account_status = CASE
      WHEN LOWER(account_status) IN ('approved', 'suspended', 'rejected', 'on_hold')
      THEN LOWER(account_status)
      ELSE 'on_hold'
    END
  `);
}

async function getRestaurantProfileById(
  restaurantId: number
): Promise<RestaurantAuthProfile | null> {
  const rows = await query<RestaurantAccountRow[]>(
    `SELECT r.id AS restaurant_id,
            r.name AS restaurant_name,
            r.slug,
            a.owner_name,
            a.mobile_number,
            a.email,
            a.password_hash,
            a.address_line1,
            a.address_line2,
            a.landmark,
            a.city,
            a.state,
            a.pincode,
            a.gstin,
            a.sgst_percent,
            a.cgst_percent,
              a.account_status,
            r.is_open,
            a.created_at,
            a.updated_at
     FROM restaurant_accounts a
     INNER JOIN restaurants r ON r.id = a.restaurant_id
     WHERE a.restaurant_id = ?
     LIMIT 1`,
    [restaurantId]
  );

  if (!rows[0]) {
    return null;
  }

  return mapProfile(rows[0]);
}

export async function registerRestaurantAccount(
  payload: RestaurantRegistrationPayload
): Promise<RestaurantAuthProfile> {
  try {
    const restaurantId = await withTransaction(async (connection) => {
      const baseSlug = slugify(payload.restaurantName);

      if (!baseSlug) {
        throw new InputError("Restaurant name is invalid for slug generation.");
      }

      let slug = baseSlug;
      let insertedRestaurantId = 0;

      for (let attempt = 0; attempt < 25; attempt += 1) {
        try {
          const [restaurantResult] = await connection.execute<ResultSetHeader>(
            `INSERT INTO restaurants (name, slug, phone, email, address, city, is_open)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [
              payload.restaurantName,
              slug,
              payload.mobileNumber,
              payload.email,
              [
                payload.addressLine1,
                payload.addressLine2,
                payload.landmark,
                payload.city,
                payload.state,
                payload.pincode,
              ]
                .filter(Boolean)
                .join(", "),
              payload.city,
            ]
          );

          insertedRestaurantId = Number(restaurantResult.insertId);
          break;
        } catch (error) {
          if (!isDuplicateKey(error, "uniq_restaurant_slug")) {
            throw error;
          }

          slug = `${baseSlug}-${attempt + 2}`;
        }
      }

      if (!insertedRestaurantId) {
        throw new InputError("Unable to create restaurant right now.", 500);
      }

      await connection.execute<ResultSetHeader>(
        `INSERT INTO restaurant_accounts
         (restaurant_id, owner_name, mobile_number, email, password_hash,
          address_line1, address_line2, landmark, city, state, pincode, gstin,
            sgst_percent, cgst_percent, account_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          insertedRestaurantId,
          payload.ownerName,
          payload.mobileNumber,
          payload.email,
          hashPassword(payload.password),
          payload.addressLine1,
          payload.addressLine2,
          payload.landmark,
          payload.city,
          payload.state,
          payload.pincode,
          payload.gstin,
          payload.sgstPercent,
          payload.cgstPercent,
          "on_hold",
        ]
      );

      return insertedRestaurantId;
    });

    const created = await getRestaurantProfileById(restaurantId);

    if (!created) {
      throw new Error("Restaurant account created but failed to fetch profile.");
    }

    return created;
  } catch (error) {
    if (isDuplicateKey(error, "uniq_restro_accounts_email")) {
      throw new InputError("This email is already registered.");
    }

    throw error;
  }
}

export async function loginRestaurantAccount(
  payload: RestaurantLoginPayload
): Promise<RestaurantAuthProfile> {
  const rows = await query<RestaurantAccountRow[]>(
    `SELECT r.id AS restaurant_id,
            r.name AS restaurant_name,
            r.slug,
            a.owner_name,
            a.mobile_number,
            a.email,
            a.password_hash,
            a.address_line1,
            a.address_line2,
            a.landmark,
            a.city,
            a.state,
            a.pincode,
            a.gstin,
            a.sgst_percent,
            a.cgst_percent,
              a.account_status,
            r.is_open,
            a.created_at,
            a.updated_at
     FROM restaurant_accounts a
     INNER JOIN restaurants r ON r.id = a.restaurant_id
     WHERE a.email = ? AND a.is_active = 1
     LIMIT 1`,
    [payload.email]
  );

  const account = rows[0];

  if (!account) {
    throw new InputError("Invalid email or password.", 401);
  }

  if (!verifyPassword(payload.password, account.password_hash)) {
    throw new InputError("Invalid email or password.", 401);
  }

  const accountStatus = normalizeAccountStatus(account.account_status);

  if (accountStatus !== "approved") {
    throw new InputError(statusLoginMessage(accountStatus), 403);
  }

  return mapProfile(account);
}

export async function listRestaurantAccounts(): Promise<RestaurantAuthProfile[]> {
  const rows = await query<RestaurantAccountRow[]>(
    `SELECT r.id AS restaurant_id,
            r.name AS restaurant_name,
            r.slug,
            a.owner_name,
            a.mobile_number,
            a.email,
            a.password_hash,
            a.address_line1,
            a.address_line2,
            a.landmark,
            a.city,
            a.state,
            a.pincode,
            a.gstin,
            a.sgst_percent,
            a.cgst_percent,
              a.account_status,
            r.is_open,
            a.created_at,
            a.updated_at
     FROM restaurant_accounts a
     INNER JOIN restaurants r ON r.id = a.restaurant_id
     ORDER BY a.created_at DESC`
  );

  return rows.map(mapProfile);
}
