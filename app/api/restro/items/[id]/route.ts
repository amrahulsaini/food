import { errorResponse } from "@/lib/api-response";
import {
  deleteItem,
  ensureRestroSchema,
  parseItemPayload,
  parseRestaurantId,
  updateItem,
} from "@/lib/restro-data";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureRestroSchema();
    const params = await context.params;
    const itemId = parseRestaurantId(params.id);
    const body = await request.json();
    const payload = parseItemPayload(body);
    const item = await updateItem(itemId, payload);

    return Response.json({
      ok: true,
      item,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureRestroSchema();
    const params = await context.params;
    const itemId = parseRestaurantId(params.id);
    const restaurantId = parseRestaurantId(
      request.nextUrl.searchParams.get("restaurantId")
    );

    await deleteItem(itemId, restaurantId);

    return Response.json({
      ok: true,
      message: "Item deleted.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
