import { InputError } from "@/lib/restro-data";

export function errorResponse(error: unknown): Response {
  if (error instanceof InputError) {
    return Response.json(
      {
        ok: false,
        message: error.message,
      },
      {
        status: error.status,
      }
    );
  }

  console.error("Unhandled API error", error);

  return Response.json(
    {
      ok: false,
      message: "Unexpected server error.",
    },
    {
      status: 500,
    }
  );
}
