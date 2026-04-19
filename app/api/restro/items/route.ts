import { errorResponse } from "@/lib/api-response";
import {
  createItem,
  ensureRestroSchema,
  getItemsByRestaurant,
  parseItemPayload,
  parseRestaurantId,
} from "@/lib/restro-data";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

function isMissingSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const dbError = error as { code?: string; message?: string };
  const message = String(dbError.message ?? "").toLowerCase();

  return (
    dbError.code === "ER_NO_SUCH_TABLE" ||
    dbError.code === "ER_BAD_FIELD_ERROR" ||
    message.includes("doesn't exist") ||
    message.includes("unknown column")
  );
}

async function withSchemaFallback<T>(runner: () => Promise<T>): Promise<T> {
  try {
    return await runner();
  } catch (error) {
    if (!isMissingSchemaError(error)) {
      throw error;
    }

    await ensureRestroSchema();
    return await runner();
  }
}

export async function GET(request: NextRequest) {
  try {
    const restaurantId = parseRestaurantId(
      request.nextUrl.searchParams.get("restaurantId")
    );

    const items = await withSchemaFallback(async () =>
      await getItemsByRestaurant(restaurantId)
    );

    return Response.json({
      ok: true,
      items,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const startedAt = Date.now();

    const parseStartedAt = Date.now();
    const body = await request.json();
    const payload = parseItemPayload(body);
    const parseMs = Date.now() - parseStartedAt;

    const createStartedAt = Date.now();
    const item = await withSchemaFallback(async () => await createItem(payload));
    const createMs = Date.now() - createStartedAt;
    const totalMs = Date.now() - startedAt;

    if (totalMs >= 900) {
      console.info("[restro-items] slow-post-route", {
        totalMs,
        parseMs,
        createMs,
        variantCount: payload.variants.length,
        addonCount: payload.addons.length,
      });
    }

    return Response.json(
      {
        ok: true,
        item,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
