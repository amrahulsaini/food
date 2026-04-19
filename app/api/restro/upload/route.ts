import { errorResponse } from "@/lib/api-response";
import { saveImageToCdn } from "@/lib/cdn-storage";
import { InputError } from "@/lib/restro-data";
import {
  ensureRestroAuthSchema,
  getRestaurantAccountBySlug,
  normalizeRestaurantSlug,
} from "@/lib/restroAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const slug = formData.get("slug");
    const file = formData.get("file");
    const allowUnregistered = formData.get("allowUnregistered") === "1";

    if (!(file instanceof File) || file.size <= 0) {
      throw new InputError("Image file is required.");
    }

    const normalizedSlug = normalizeRestaurantSlug(String(slug ?? ""));

    if (allowUnregistered) {
      const imageUrl = await saveImageToCdn(normalizedSlug, file);

      return Response.json({
        ok: true,
        imageUrl,
        slug: normalizedSlug,
      });
    }

    await ensureRestroAuthSchema();

    const profile = await getRestaurantAccountBySlug(normalizedSlug);

    if (!profile) {
      throw new InputError("Restaurant profile not found for the provided slug.", 404);
    }

    const imageUrl = await saveImageToCdn(profile.restaurantSlug, file);

    return Response.json({
      ok: true,
      imageUrl,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
