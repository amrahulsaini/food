import { errorResponse } from "@/lib/api-response";
import { query } from "@/lib/db";
import {
  ensureRestroAuthSchema,
  loginRestaurantAccount,
  parseRestaurantLoginPayload,
} from "@/lib/restroAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const warmOnly = new URL(request.url).searchParams.get("warm") === "1";

    if (!warmOnly) {
      return Response.json({ ok: true });
    }

    const startedAt = Date.now();

    await Promise.all([ensureRestroAuthSchema(), query("SELECT 1 AS ok")]);

    return Response.json({
      ok: true,
      warmed: true,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = parseRestaurantLoginPayload(body);
    const restaurant = await loginRestaurantAccount(payload);

    return Response.json({
      ok: true,
      restaurant,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
