import { errorResponse } from "@/lib/api-response";
import { ensureRestroSchema, listRestaurants } from "@/lib/restro-data";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureRestroSchema();
    const restaurants = await listRestaurants();

    return Response.json({
      ok: true,
      restaurants,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
