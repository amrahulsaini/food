import { errorResponse } from "@/lib/api-response";
import {
  ensureRestroSchema,
  getCustomerMenu,
  parseRestaurantId,
} from "@/lib/restro-data";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureRestroSchema();
    const { id } = await params;
    const restaurantId = parseRestaurantId(id);
    const menu = await getCustomerMenu(restaurantId);

    return Response.json({
      ok: true,
      ...menu,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
