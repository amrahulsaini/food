import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { InputError } from "@/lib/restro-data";

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function normalizeCdnSlug(value: unknown): string {
  if (typeof value !== "string") {
    throw new InputError("Restaurant slug is required for image upload.");
  }

  const normalized = value.trim().toLowerCase();

  if (!/^[a-z0-9]{6,8}$/.test(normalized)) {
    throw new InputError("Restaurant slug should be 6 to 8 alphanumeric characters.");
  }

  return normalized;
}

function getImageExtension(file: File): string {
  const mimeType = file.type.toLowerCase();
  const extFromMime = ALLOWED_MIME_TO_EXT[mimeType];

  if (extFromMime) {
    return extFromMime;
  }

  const originalName = file.name.toLowerCase();

  if (originalName.endsWith(".jpg") || originalName.endsWith(".jpeg")) {
    return "jpg";
  }

  if (originalName.endsWith(".png")) {
    return "png";
  }

  if (originalName.endsWith(".webp")) {
    return "webp";
  }

  throw new InputError("Upload a JPG, PNG, or WEBP image.");
}

function validateImageFile(file: File): void {
  if (!(file instanceof File) || file.size <= 0) {
    throw new InputError("Image file is required.");
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new InputError("Image size should be 8 MB or less.");
  }

  getImageExtension(file);
}

export async function saveImageToCdn(slugValue: unknown, file: File): Promise<string> {
  const slug = normalizeCdnSlug(slugValue);
  validateImageFile(file);

  const extension = getImageExtension(file);
  const fileName = `${Date.now()}-${randomBytes(4).toString("hex")}.${extension}`;
  const targetDir = path.join(process.cwd(), "public", "cdn", slug, "images");
  const targetPath = path.join(targetDir, fileName);

  await mkdir(targetDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(targetPath, buffer);

  return `/cdn/${slug}/images/${fileName}`;
}
