import { errorResponse } from "@/lib/api-response";
import {
  ensureRestroAuthSchema,
  listRestaurantAccounts,
  parseRestaurantRegistrationPayload,
  registerRestaurantAccount,
} from "@/lib/restro-auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureRestroAuthSchema();
    const restaurants = await listRestaurantAccounts();

    return Response.json({
      ok: true,
      restaurants,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await ensureRestroAuthSchema();
    const body = await request.json();
    const payload = parseRestaurantRegistrationPayload(body);
    const restaurant = await registerRestaurantAccount(payload);

    return Response.json(
      {
        ok: true,
        restaurant,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
