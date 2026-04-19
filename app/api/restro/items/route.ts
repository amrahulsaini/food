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

export async function GET(request: NextRequest) {
  try {
    await ensureRestroSchema();
    const restaurantId = parseRestaurantId(
      request.nextUrl.searchParams.get("restaurantId")
    );

    const items = await getItemsByRestaurant(restaurantId);

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
    await ensureRestroSchema();

    const parseStartedAt = Date.now();
    const body = await request.json();
    const payload = parseItemPayload(body);
    const parseMs = Date.now() - parseStartedAt;

    const createStartedAt = Date.now();
    const item = await createItem(payload);
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
