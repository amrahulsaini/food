import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { InputError } from "@/lib/restro-data";

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 1600;
const MAX_IMAGE_HEIGHT = 1600;
const WEBP_QUALITY = 72;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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

function hasAllowedImageExtension(fileName: string): boolean {
  const normalizedName = fileName.toLowerCase();

  return (
    normalizedName.endsWith(".jpg") ||
    normalizedName.endsWith(".jpeg") ||
    normalizedName.endsWith(".png") ||
    normalizedName.endsWith(".webp")
  );
}

function validateImageFile(file: File): void {
  if (!(file instanceof File) || file.size <= 0) {
    throw new InputError("Image file is required.");
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new InputError("Image size should be 8 MB or less.");
  }

  const mimeType = file.type.toLowerCase();

  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new InputError("Upload a JPG, PNG, or WEBP image.");
  }

  if (!mimeType && !hasAllowedImageExtension(file.name)) {
    throw new InputError("Upload a JPG, PNG, or WEBP image.");
  }
}

export async function saveImageToCdn(slugValue: unknown, file: File): Promise<string> {
  const slug = normalizeCdnSlug(slugValue);
  validateImageFile(file);

  const fileName = `${Date.now()}-${randomBytes(4).toString("hex")}.webp`;
  const targetDir = path.join(process.cwd(), "public", "cdn", slug, "images");
  const targetPath = path.join(targetDir, fileName);

  await mkdir(targetDir, { recursive: true });

  const sourceBuffer = Buffer.from(await file.arrayBuffer());

  let optimizedBuffer: Buffer;

  try {
    optimizedBuffer = await sharp(sourceBuffer)
      .rotate()
      .resize({
        width: MAX_IMAGE_WIDTH,
        height: MAX_IMAGE_HEIGHT,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: WEBP_QUALITY,
        effort: 4,
        smartSubsample: true,
      })
      .toBuffer();
  } catch {
    throw new InputError("Invalid image file. Upload a JPG, PNG, or WEBP image.");
  }

  await writeFile(targetPath, optimizedBuffer);

  return `/cdn/${slug}/images/${fileName}`;
}
