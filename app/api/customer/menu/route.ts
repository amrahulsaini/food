import { errorResponse } from "@/lib/api-response";
import {
  ensureRestroSchema,
  getCustomerMenu,
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

    const menu = await getCustomerMenu(restaurantId);

    return Response.json({
      ok: true,
      ...menu,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
