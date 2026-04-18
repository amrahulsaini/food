import { errorResponse } from "@/lib/api-response";
import { saveImageToCdn } from "@/lib/cdn-storage";
import { InputError } from "@/lib/restro-data";
import {
  createRestaurantSlug,
  ensureRestroAuthSchema,
  getRestaurantAccountBySlug,
  listRestaurantAccounts,
  parseRestaurantRegistrationPayload,
  registerRestaurantAccount,
  setRestaurantImageBySlug,
} from "@/lib/restroAuth";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await ensureRestroAuthSchema();
    const slug = request.nextUrl.searchParams.get("slug")?.trim();

    if (slug) {
      const restaurant = await getRestaurantAccountBySlug(slug);

      if (!restaurant) {
        throw new InputError("Restaurant account not found.", 404);
      }

      return Response.json({
        ok: true,
        restaurant,
      });
    }

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
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      throw new InputError("Restaurant image is mandatory during registration.");
    }

    const formData = await request.formData();
    const restaurantImage = formData.get("restaurantImage");

    if (!(restaurantImage instanceof File) || restaurantImage.size <= 0) {
      throw new InputError("Restaurant image is mandatory during registration.");
    }

    const payload = parseRestaurantRegistrationPayload({
      restaurantName: formData.get("restaurantName"),
      ownerName: formData.get("ownerName"),
      ownerMobile: formData.get("ownerMobile"),
      ownerEmail: formData.get("ownerEmail"),
      ownerPassword: formData.get("ownerPassword"),
      businessAddress: formData.get("businessAddress"),
      city: formData.get("city"),
      postalCode: formData.get("postalCode"),
      gstin: formData.get("gstin"),
      sgstPercent: formData.get("sgstPercent"),
      cgstPercent: formData.get("cgstPercent"),
    });

    let restaurant = null;
    let attempts = 0;

    while (!restaurant && attempts < 12) {
      attempts += 1;
      const restaurantSlug = createRestaurantSlug();
      const placeholderImage = `/cdn/${restaurantSlug}/images/pending.jpg`;

      try {
        restaurant = await registerRestaurantAccount(payload, {
          restaurantSlug,
          restaurantImageUrl: placeholderImage,
        });
      } catch (error) {
        if (
          error instanceof InputError &&
          error.status === 409 &&
          error.message.toLowerCase().includes("slug")
        ) {
          continue;
        }

        throw error;
      }
    }

    if (!restaurant) {
      throw new InputError("Unable to generate unique restaurant slug. Try again.", 500);
    }

    const imageUrl = await saveImageToCdn(restaurant.restaurantSlug, restaurantImage);
    await setRestaurantImageBySlug(restaurant.restaurantSlug, imageUrl);

    const updatedRestaurant = await getRestaurantAccountBySlug(restaurant.restaurantSlug);

    if (!updatedRestaurant) {
      throw new InputError("Restaurant created but profile lookup failed.", 500);
    }

    return Response.json(
      {
        ok: true,
        restaurant: updatedRestaurant,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
