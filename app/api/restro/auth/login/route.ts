import { errorResponse } from "@/lib/api-response";
import {
  loginRestaurantAccount,
  parseRestaurantLoginPayload,
} from "@/lib/restroAuth";

export const runtime = "nodejs";

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
