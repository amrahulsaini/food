import { errorResponse } from "@/lib/api-response";
import { saveImageToCdn } from "@/lib/cdn-storage";
import { InputError } from "@/lib/restro-data";
import {
  createRestaurantSlug,
  ensureRestroAuthSchema,
  getRestaurantAccountBySlug,
  listRestaurantAccounts,
  normalizeRestaurantSlug,
  parseRestaurantRegistrationPayload,
  registerRestaurantAccount,
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

    // Fast path: image pre-uploaded from client, submit only JSON payload.
    if (contentType.toLowerCase().includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      const payload = parseRestaurantRegistrationPayload(body);

      const restaurantSlug = normalizeRestaurantSlug(body.restaurantSlug);
      const restaurantImageUrl = String(body.restaurantImageUrl ?? "").trim();

      if (!restaurantImageUrl.startsWith(`/cdn/${restaurantSlug}/images/`)) {
        throw new InputError("Uploaded restaurant image is missing or invalid.");
      }

      const restaurant = await registerRestaurantAccount(payload, {
        restaurantSlug,
        restaurantImageUrl,
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
    }

    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      throw new InputError("Restaurant image is mandatory during registration.");
    }

    const formData = await request.formData();

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

    const preUploadedSlugRaw = formData.get("restaurantSlug");
    const preUploadedImageUrlRaw = formData.get("restaurantImageUrl");

    if (
      typeof preUploadedSlugRaw === "string" &&
      typeof preUploadedImageUrlRaw === "string" &&
      preUploadedSlugRaw.trim() &&
      preUploadedImageUrlRaw.trim()
    ) {
      const restaurantSlug = normalizeRestaurantSlug(preUploadedSlugRaw);
      const restaurantImageUrl = preUploadedImageUrlRaw.trim();

      if (!restaurantImageUrl.startsWith(`/cdn/${restaurantSlug}/images/`)) {
        throw new InputError("Uploaded restaurant image is missing or invalid.");
      }

      const restaurant = await registerRestaurantAccount(payload, {
        restaurantSlug,
        restaurantImageUrl,
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
    }

    const restaurantImage = formData.get("restaurantImage");

    if (!(restaurantImage instanceof File) || restaurantImage.size <= 0) {
      throw new InputError("Restaurant image is mandatory during registration.");
    }

    let restaurant = null;
    let attempts = 0;

    while (!restaurant && attempts < 12) {
      attempts += 1;
      const restaurantSlug = createRestaurantSlug();

      try {
        const restaurantImageUrl = await saveImageToCdn(restaurantSlug, restaurantImage);
        restaurant = await registerRestaurantAccount(payload, {
          restaurantSlug,
          restaurantImageUrl,
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
