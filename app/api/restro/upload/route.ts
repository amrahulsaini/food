import { errorResponse } from "@/lib/api-response";
import { saveImageToCdn } from "@/lib/cdn-storage";
import { InputError } from "@/lib/restro-data";
import { ensureRestroAuthSchema, getRestaurantAccountBySlug } from "@/lib/restroAuth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await ensureRestroAuthSchema();

    const formData = await request.formData();
    const slug = formData.get("slug");
    const file = formData.get("file");

    if (!(file instanceof File) || file.size <= 0) {
      throw new InputError("Image file is required.");
    }

    const profile = await getRestaurantAccountBySlug(String(slug ?? ""));

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
