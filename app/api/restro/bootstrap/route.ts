import { errorResponse } from "@/lib/api-response";
import { ensureRestroAuthSchema, listRestaurantAccounts } from "@/lib/restroAuth";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await ensureRestroAuthSchema();

    const warmOnly = request.nextUrl.searchParams.get("warm") === "1";

    if (warmOnly) {
      return Response.json({
        ok: true,
        message: "Restaurant auth schema warmed.",
      });
    }

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

export async function POST(request: NextRequest) {
  return GET(request);
}
