import { errorResponse } from "@/lib/api-response";
import { ensureRestroAuthSchema, listRestaurantAccounts } from "@/lib/restroAuth";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureRestroAuthSchema();
    const restaurants = await listRestaurantAccounts();

    return Response.json({
      ok: true,
      message: "Restaurant onboarding schema is ready.",
      restaurants,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST() {
  return GET();
}
