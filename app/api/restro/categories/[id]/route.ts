import { errorResponse } from "@/lib/api-response";
import {
  deleteCategory,
  ensureRestroSchema,
  parseCategoryPayload,
  parseRestaurantId,
  updateCategory,
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
    const categoryId = parseRestaurantId(params.id);
    const body = await request.json();
    const payload = parseCategoryPayload(body);
    const category = await updateCategory(categoryId, payload);

    return Response.json({
      ok: true,
      category,
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
    const categoryId = parseRestaurantId(params.id);
    const restaurantId = parseRestaurantId(
      request.nextUrl.searchParams.get("restaurantId")
    );

    await deleteCategory(categoryId, restaurantId);

    return Response.json({
      ok: true,
      message: "Category deleted.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
