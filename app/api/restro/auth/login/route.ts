import { errorResponse } from "@/lib/api-response";
import {
  ensureRestroAuthSchema,
  loginRestaurantAccount,
  parseRestaurantLoginPayload,
} from "@/lib/restro-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await ensureRestroAuthSchema();
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
