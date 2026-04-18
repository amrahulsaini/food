import { errorResponse } from "@/lib/api-response";
import {
  createCategory,
  ensureRestroSchema,
  getCategoriesByRestaurant,
  parseCategoryPayload,
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
    const categories = await getCategoriesByRestaurant(restaurantId);

    return Response.json({
      ok: true,
      categories,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await ensureRestroSchema();
    const body = await request.json();
    const payload = parseCategoryPayload(body);
    const category = await createCategory(payload);

    return Response.json(
      {
        ok: true,
        category,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
