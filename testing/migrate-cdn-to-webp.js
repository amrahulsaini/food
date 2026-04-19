const fs = require("node:fs/promises");
const path = require("node:path");
const mysql = require("mysql2/promise");
const sharp = require("sharp");

const IMAGE_EXT_PATTERN = /\.(jpg|jpeg|png|webp)$/i;
const WEBP_EXT_PATTERN = /\.webp$/i;

const MAX_IMAGE_WIDTH = 1600;
const MAX_IMAGE_HEIGHT = 1600;
const WEBP_QUALITY = 72;

const DB_CONFIG = {
  host: process.env.DB_HOST || "34.133.49.19",
  user: process.env.DB_USER || "loop_food",
  password: process.env.DB_PASSWORD || "food",
  database: process.env.DB_NAME || "loop_food",
  port: Number(process.env.DB_PORT || 3306),
};

const DB_TARGETS = [
  { table: "restaurant_accounts", column: "restaurant_image_url" },
  { table: "categories", column: "image_url" },
  { table: "items", column: "image_url" },
  { table: "restaurants", column: "image_url" },
];

async function collectFilesRecursively(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      const childFiles = await collectFilesRecursively(fullPath);
      files.push(...childFiles);
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function toCdnUrl(cdnRoot, absoluteFilePath) {
  const relative = path.relative(cdnRoot, absoluteFilePath);
  return `/cdn/${toPosixPath(relative)}`;
}

async function convertFileToWebp(sourcePath, targetPath) {
  const sourceBuffer = await fs.readFile(sourcePath);

  const optimizedBuffer = await sharp(sourceBuffer)
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

  await fs.writeFile(targetPath, optimizedBuffer);
}

async function hasTableColumn(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column]
  );

  return Number(rows[0]?.total || 0) > 0;
}

async function updateDbUrls(connection, urlMap) {
  const existingTargets = [];

  for (const target of DB_TARGETS) {
    const exists = await hasTableColumn(connection, target.table, target.column);

    if (exists) {
      existingTargets.push(target);
    }
  }

  const dbUpdates = [];

  for (const [oldUrl, newUrl] of urlMap.entries()) {
    if (oldUrl === newUrl) {
      continue;
    }

    for (const target of existingTargets) {
      const [result] = await connection.execute(
        `UPDATE ${target.table}
         SET ${target.column} = ?
         WHERE ${target.column} = ?`,
        [newUrl, oldUrl]
      );

      const updatedRows = Number(result.affectedRows || 0);

      if (updatedRows > 0) {
        dbUpdates.push({
          table: target.table,
          column: target.column,
          from: oldUrl,
          to: newUrl,
          rows: updatedRows,
        });
      }
    }
  }

  return {
    existingTargets,
    dbUpdates,
  };
}

async function main() {
  const projectRoot = process.cwd();
  const cdnRoot = path.join(projectRoot, "public", "cdn");

  try {
    await fs.access(cdnRoot);
  } catch {
    console.log("No public/cdn directory found. Nothing to migrate.");
    return;
  }

  const allFiles = await collectFilesRecursively(cdnRoot);
  const imageFiles = allFiles.filter((filePath) => IMAGE_EXT_PATTERN.test(filePath));

  if (imageFiles.length === 0) {
    console.log("No CDN image files found. Nothing to migrate.");
    return;
  }

  const conversionMap = new Map();
  let convertedCount = 0;
  let skippedCount = 0;
  let deletedOriginalCount = 0;

  for (const sourcePath of imageFiles) {
    const sourceUrl = toCdnUrl(cdnRoot, sourcePath);

    if (WEBP_EXT_PATTERN.test(sourcePath)) {
      conversionMap.set(sourceUrl, sourceUrl);
      skippedCount += 1;
      continue;
    }

    const targetPath = sourcePath.replace(/\.(jpg|jpeg|png)$/i, ".webp");
    const targetUrl = toCdnUrl(cdnRoot, targetPath);

    await convertFileToWebp(sourcePath, targetPath);
    await fs.unlink(sourcePath);

    convertedCount += 1;
    deletedOriginalCount += 1;
    conversionMap.set(sourceUrl, targetUrl);
  }

  const connection = await mysql.createConnection(DB_CONFIG);

  try {
    const { existingTargets, dbUpdates } = await updateDbUrls(connection, conversionMap);

    console.log(
      JSON.stringify(
        {
          totalImageFilesScanned: imageFiles.length,
          convertedToWebp: convertedCount,
          alreadyWebp: skippedCount,
          originalsDeleted: deletedOriginalCount,
          dbTargetsChecked: existingTargets,
          dbUpdates,
          dbUpdateCount: dbUpdates.length,
        },
        null,
        2
      )
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});
