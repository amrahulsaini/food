import { errorResponse } from "@/lib/api-response";
import {
  createRestaurant,
  ensureRestroSchema,
  listRestaurants,
} from "@/lib/restro-data";

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

export async function POST(request: Request) {
  try {
    await ensureRestroSchema();
    const body = (await request.json()) as {
      name?: unknown;
      city?: unknown;
      slug?: unknown;
    };

    const restaurant = await createRestaurant({
      name: body.name,
      city: body.city,
      slug: body.slug,
    });

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
