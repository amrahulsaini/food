import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { execute, query, withTransaction } from "@/lib/db";
import { InputError, ensureRestroSchema } from "@/lib/restro-data";

const scrypt = promisify(scryptCallback);
const ACCOUNT_STATUSES = ["approved", "suspended", "rejected", "on_hold"] as const;
const APPROVED_STATUS = "approved";
const SLUG_PATTERN = /^[a-z0-9]{6,8}$/;

type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export interface RestaurantAuthProfile {
  restaurantId: number;
  restaurantName: string;
  restaurantSlug: string;
  restaurantImageUrl: string | null;
  ownerName: string;
  ownerMobile: string;
  ownerEmail: string;
  businessAddress: string;
  city: string;
  postalCode: string;
  gstin: string;
  sgstPercent: number;
  cgstPercent: number;
  accountStatus: AccountStatus;
  createdAt: string | null;
  updatedAt: string | null;
}

interface RestaurantAuthRow extends RowDataPacket {
  restaurant_id: number;
  restaurant_name: string;
  restaurant_slug: string;
  restaurant_image_url: string | null;
  owner_name: string;
  owner_mobile: string;
  owner_email: string;
  business_address: string;
  city: string;
  postal_code: string;
  gstin: string;
  sgst_percent: string | number;
  cgst_percent: string | number;
  account_status: string;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

interface RestaurantAccountRow extends RowDataPacket {
  id: number;
  restaurant_id: number;
  owner_email: string;
  password_hash: string;
  account_status: string;
}

interface NewRestaurantAccountResult extends ResultSetHeader {
  insertId: number;
}

export interface RestaurantRegistrationPayload {
  restaurantName: string;
  ownerName: string;
  ownerMobile: string;
  ownerEmail: string;
  ownerPassword: string;
  businessAddress: string;
  city: string;
  postalCode: string;
  gstin: string;
  sgstPercent: number;
  cgstPercent: number;
}

export interface RestaurantLoginPayload {
  ownerEmail: string;
  ownerPassword: string;
}

let restroAuthSchemaReadyPromise: Promise<void> | null = null;

function normalizeName(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new InputError(`${fieldName} is required.`);
  }

  const normalized = value.trim();

  if (normalized.length < 2) {
    throw new InputError(`${fieldName} should have at least 2 characters.`);
  }

  return normalized;
}

function normalizeAddress(value: unknown): string {
  if (typeof value !== "string") {
    throw new InputError("Business address is required.");
  }

  const normalized = value.trim();

  if (normalized.length < 6) {
    throw new InputError("Business address should have at least 6 characters.");
  }

  return normalized;
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new InputError("Owner email is required.");
  }

  const normalized = value.trim().toLowerCase();

  if (!/^\S+@\S+\.\S+$/.test(normalized)) {
    throw new InputError("Enter a valid owner email address.");
  }

  return normalized;
}

function normalizeMobile(value: unknown): string {
  if (typeof value !== "string") {
    throw new InputError("Owner mobile number is required.");
  }

  const digits = value.replace(/\D/g, "");

  if (digits.length < 10 || digits.length > 15) {
    throw new InputError("Owner mobile number should have 10 to 15 digits.");
  }

  return digits;
}

function normalizePostalCode(value: unknown): string {
  if (typeof value !== "string") {
    throw new InputError("Postal code is required.");
  }

  const normalized = value.trim().toUpperCase();

  if (normalized.length < 4 || normalized.length > 12) {
    throw new InputError("Postal code should have 4 to 12 characters.");
  }

  return normalized;
}

function normalizeGstin(value: unknown): string {
  if (typeof value !== "string") {
    throw new InputError("GSTIN is required.");
  }

  const normalized = value.trim().toUpperCase();

  if (normalized.length < 8 || normalized.length > 20) {
    throw new InputError("GSTIN should have 8 to 20 characters.");
  }

  return normalized;
}

function normalizeTaxPercent(value: unknown, fieldName: "SGST" | "CGST"): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new InputError(`${fieldName} should be a number between 0 and 100.`);
  }

  return Number(parsed.toFixed(2));
}

function normalizePassword(value: unknown): string {
  if (typeof value !== "string") {
    throw new InputError("Owner password is required.");
  }

  if (value.length < 8) {
    throw new InputError("Owner password should have at least 8 characters.");
  }

  return value;
}

function normalizeStatus(value: unknown): AccountStatus {
  if (typeof value !== "string") {
    return "on_hold";
  }

  const normalized = value.trim().toLowerCase();
  return (ACCOUNT_STATUSES as readonly string[]).includes(normalized)
    ? (normalized as AccountStatus)
    : "on_hold";
}

function toIso(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapRestaurantProfile(row: RestaurantAuthRow): RestaurantAuthProfile {
  return {
    restaurantId: row.restaurant_id,
    restaurantName: row.restaurant_name,
    restaurantSlug: row.restaurant_slug,
    restaurantImageUrl: row.restaurant_image_url,
    ownerName: row.owner_name,
    ownerMobile: row.owner_mobile,
    ownerEmail: row.owner_email,
    businessAddress: row.business_address,
    city: row.city,
    postalCode: row.postal_code,
    gstin: row.gstin,
    sgstPercent: Number.parseFloat(String(row.sgst_percent)),
    cgstPercent: Number.parseFloat(String(row.cgst_percent)),
    accountStatus: normalizeStatus(row.account_status),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function generateSlug(length: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(length);
  let value = "";

  for (let index = 0; index < length; index += 1) {
    value += alphabet[bytes[index] % alphabet.length];
  }

  return value;
}

export function createRestaurantSlug(): string {
  const length = 6 + (randomBytes(1)[0] % 3);
  return generateSlug(length);
}

export function normalizeRestaurantSlug(value: unknown): string {
  if (typeof value !== "string") {
    throw new InputError("Restaurant slug is required.");
  }

  const normalized = value.trim().toLowerCase();

  if (!SLUG_PATTERN.test(normalized)) {
    throw new InputError("Restaurant slug should be 6 to 8 alphanumeric characters.");
  }

  return normalized;
}

function isDuplicateFor(error: unknown, keyName: string): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const lower = error.message.toLowerCase();
  return lower.includes("duplicate") && lower.includes(keyName.toLowerCase());
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const storedBuffer = Buffer.from(hash, "hex");

  if (storedBuffer.length !== derived.length) {
    return false;
  }

  return timingSafeEqual(derived, storedBuffer);
}

async function runRestroAuthSchemaSetup(): Promise<void> {
  await ensureRestroSchema();

  await execute(`
    CREATE TABLE IF NOT EXISTS restaurant_accounts (
      id BIGINT NOT NULL AUTO_INCREMENT,
      restaurant_id BIGINT NOT NULL,
      owner_name VARCHAR(120) NOT NULL,
      owner_mobile VARCHAR(20) NOT NULL,
      owner_email VARCHAR(160) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      business_address TEXT NOT NULL,
      city VARCHAR(80) NOT NULL,
      postal_code VARCHAR(20) NOT NULL,
      gstin VARCHAR(30) NOT NULL,
      sgst_percent DECIMAL(5,2) NOT NULL,
      cgst_percent DECIMAL(5,2) NOT NULL,
      account_status ENUM('approved','suspended','rejected','on_hold') NOT NULL DEFAULT 'on_hold',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_owner_email (owner_email),
      UNIQUE KEY uniq_restaurant_account (restaurant_id),
      CONSTRAINT fk_restaurant_accounts_restaurant
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const statusColumnRows = await query<Array<RowDataPacket & { total: number }>>(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'restaurant_accounts'
       AND COLUMN_NAME = 'account_status'`
  );

  if ((statusColumnRows[0]?.total ?? 0) === 0) {
    await execute(`
      ALTER TABLE restaurant_accounts
      ADD COLUMN account_status ENUM('approved','suspended','rejected','on_hold')
      NOT NULL DEFAULT 'on_hold'
      AFTER cgst_percent
    `);
  }

  await execute(`
    UPDATE restaurant_accounts
    SET account_status = 'on_hold'
    WHERE account_status IS NULL
      OR account_status = ''
  `);
}

export async function ensureRestroAuthSchema(): Promise<void> {
  if (!restroAuthSchemaReadyPromise) {
    restroAuthSchemaReadyPromise = runRestroAuthSchemaSetup().catch((error) => {
      restroAuthSchemaReadyPromise = null;
      throw error;
    });
  }

  await restroAuthSchemaReadyPromise;
}

export function parseRestaurantRegistrationPayload(
  body: unknown
): RestaurantRegistrationPayload {
  const payload = body as Record<string, unknown>;

  return {
    restaurantName: normalizeName(payload.restaurantName, "Restaurant name"),
    ownerName: normalizeName(payload.ownerName, "Owner name"),
    ownerMobile: normalizeMobile(payload.ownerMobile),
    ownerEmail: normalizeEmail(payload.ownerEmail),
    ownerPassword: normalizePassword(payload.ownerPassword),
    businessAddress: normalizeAddress(payload.businessAddress),
    city: normalizeName(payload.city, "City"),
    postalCode: normalizePostalCode(payload.postalCode),
    gstin: normalizeGstin(payload.gstin),
    sgstPercent: normalizeTaxPercent(payload.sgstPercent, "SGST"),
    cgstPercent: normalizeTaxPercent(payload.cgstPercent, "CGST"),
  };
}

export function parseRestaurantLoginPayload(body: unknown): RestaurantLoginPayload {
  const payload = body as Record<string, unknown>;

  return {
    ownerEmail: normalizeEmail(payload.ownerEmail ?? payload.email),
    ownerPassword: normalizePassword(payload.ownerPassword ?? payload.password),
  };
}

async function readRestaurantProfileById(restaurantId: number): Promise<RestaurantAuthProfile> {
  const rows = await query<RestaurantAuthRow[]>(
    `SELECT
      r.id AS restaurant_id,
      r.name AS restaurant_name,
      r.slug AS restaurant_slug,
      r.image_url AS restaurant_image_url,
      a.owner_name,
      a.owner_mobile,
      a.owner_email,
      a.business_address,
      a.city,
      a.postal_code,
      a.gstin,
      a.sgst_percent,
      a.cgst_percent,
      a.account_status,
      a.created_at,
      a.updated_at
     FROM restaurant_accounts a
     INNER JOIN restaurants r ON r.id = a.restaurant_id
     WHERE a.restaurant_id = ?
     LIMIT 1`,
    [restaurantId]
  );

  const row = rows[0];

  if (!row) {
    throw new InputError("Restaurant account not found.", 404);
  }

  return mapRestaurantProfile(row);
}

export async function registerRestaurantAccount(
  payload: RestaurantRegistrationPayload,
  options: {
    restaurantSlug: string;
    restaurantImageUrl: string;
  }
): Promise<RestaurantAuthProfile> {
  await ensureRestroAuthSchema();

  const restaurantSlug = normalizeRestaurantSlug(options.restaurantSlug);
  const restaurantImageUrl = String(options.restaurantImageUrl || "").trim();

  if (!restaurantImageUrl.startsWith(`/cdn/${restaurantSlug}/images/`)) {
    throw new InputError("Restaurant image path is invalid.");
  }

  const passwordHash = await hashPassword(payload.ownerPassword);

  try {
    const restaurantId = await withTransaction<number>(async (connection) => {
      const [restaurantResult] = await connection.execute<NewRestaurantAccountResult>(
        `INSERT INTO restaurants (
          name,
          slug,
          image_url,
          phone,
          email,
          address,
          city,
          is_open
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          payload.restaurantName,
          restaurantSlug,
          restaurantImageUrl,
          payload.ownerMobile,
          payload.ownerEmail,
          payload.businessAddress,
          payload.city,
        ]
      );

      const insertedRestaurantId = Number(restaurantResult.insertId);

      await connection.execute(
        `INSERT INTO restaurant_accounts (
          restaurant_id,
          owner_name,
          owner_mobile,
          owner_email,
          password_hash,
          business_address,
          city,
          postal_code,
          gstin,
          sgst_percent,
          cgst_percent,
          account_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          insertedRestaurantId,
          payload.ownerName,
          payload.ownerMobile,
          payload.ownerEmail,
          passwordHash,
          payload.businessAddress,
          payload.city,
          payload.postalCode,
          payload.gstin,
          payload.sgstPercent,
          payload.cgstPercent,
          "on_hold",
        ]
      );

      return insertedRestaurantId;
    });

    return await readRestaurantProfileById(restaurantId);
  } catch (error) {
    if (isDuplicateFor(error, "uniq_owner_email") || isDuplicateFor(error, "owner_email")) {
      throw new InputError("Owner email is already registered.", 409);
    }

    if (isDuplicateFor(error, "uniq_restaurant_slug") || isDuplicateFor(error, "slug")) {
      throw new InputError("Restaurant slug already exists.", 409);
    }

    throw error;
  }
}

export async function listRestaurantAccounts(): Promise<RestaurantAuthProfile[]> {
  await ensureRestroAuthSchema();

  const rows = await query<RestaurantAuthRow[]>(
    `SELECT
      r.id AS restaurant_id,
      r.name AS restaurant_name,
      r.slug AS restaurant_slug,
      r.image_url AS restaurant_image_url,
      a.owner_name,
      a.owner_mobile,
      a.owner_email,
      a.business_address,
      a.city,
      a.postal_code,
      a.gstin,
      a.sgst_percent,
      a.cgst_percent,
      a.account_status,
      a.created_at,
      a.updated_at
     FROM restaurant_accounts a
     INNER JOIN restaurants r ON r.id = a.restaurant_id
     ORDER BY a.id DESC`
  );

  return rows.map(mapRestaurantProfile);
}

export async function getRestaurantAccountBySlug(
  slugValue: string
): Promise<RestaurantAuthProfile | null> {
  await ensureRestroAuthSchema();

  const slug = normalizeRestaurantSlug(slugValue);

  const rows = await query<RestaurantAuthRow[]>(
    `SELECT
      r.id AS restaurant_id,
      r.name AS restaurant_name,
      r.slug AS restaurant_slug,
      r.image_url AS restaurant_image_url,
      a.owner_name,
      a.owner_mobile,
      a.owner_email,
      a.business_address,
      a.city,
      a.postal_code,
      a.gstin,
      a.sgst_percent,
      a.cgst_percent,
      a.account_status,
      a.created_at,
      a.updated_at
     FROM restaurant_accounts a
     INNER JOIN restaurants r ON r.id = a.restaurant_id
     WHERE r.slug = ?
     LIMIT 1`,
    [slug]
  );

  const row = rows[0];
  return row ? mapRestaurantProfile(row) : null;
}

export async function setRestaurantImageBySlug(
  slugValue: string,
  imageUrlValue: string
): Promise<void> {
  await ensureRestroAuthSchema();

  const slug = normalizeRestaurantSlug(slugValue);
  const imageUrl = String(imageUrlValue || "").trim();

  if (!imageUrl.startsWith(`/cdn/${slug}/images/`)) {
    throw new InputError("Restaurant image path is invalid.");
  }

  await execute(
    `UPDATE restaurants
     SET image_url = ?
     WHERE slug = ?
     LIMIT 1`,
    [imageUrl, slug]
  );
}

export async function loginRestaurantAccount(
  payload: RestaurantLoginPayload
): Promise<RestaurantAuthProfile> {
  await ensureRestroAuthSchema();

  const normalizedEmail = normalizeEmail(payload.ownerEmail);
  const normalizedPassword = normalizePassword(payload.ownerPassword);

  const accounts = await query<RestaurantAccountRow[]>(
    `SELECT id, restaurant_id, owner_email, password_hash, account_status
     FROM restaurant_accounts
     WHERE owner_email = ?
     LIMIT 1`,
    [normalizedEmail]
  );

  const account = accounts[0];

  if (!account) {
    throw new InputError("Invalid email or password.", 401);
  }

  const passwordMatches = await verifyPassword(normalizedPassword, account.password_hash);

  if (!passwordMatches) {
    throw new InputError("Invalid email or password.", 401);
  }

  const accountStatus = normalizeStatus(account.account_status);

  if (accountStatus !== APPROVED_STATUS) {
    if (accountStatus === "on_hold") {
      throw new InputError(
        "Registration is under review. Ask admin to set status to approved.",
        403
      );
    }

    if (accountStatus === "suspended") {
      throw new InputError(
        "Your restaurant account is suspended. Contact admin for support.",
        403
      );
    }

    if (accountStatus === "rejected") {
      throw new InputError(
        "Your restaurant registration is rejected. Contact admin for details.",
        403
      );
    }

    throw new InputError("Your account is not approved for login.", 403);
  }

  return await readRestaurantProfileById(account.restaurant_id);
}
