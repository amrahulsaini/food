import { NextResponse } from "next/server";
import {
  getRestroGatePassword,
  isRestroGateEnabled,
  RESTRO_GATE_COOKIE_NAME,
} from "@/lib/restro-gate";

function buildCookieConfig() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}

export async function POST(request: Request) {
  if (!isRestroGateEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        message: "Restro gate password is not configured in environment.",
      },
      { status: 500 }
    );
  }

  let password = "";

  try {
    const body = (await request.json()) as { password?: unknown };

    if (typeof body.password === "string") {
      password = body.password;
    }
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid request body.",
      },
      { status: 400 }
    );
  }

  if (password !== getRestroGatePassword()) {
    return NextResponse.json(
      {
        ok: false,
        message: "Incorrect restro access password.",
      },
      { status: 401 }
    );
  }

  const response = NextResponse.json({
    ok: true,
    message: "Access granted.",
  });

  response.cookies.set(
    RESTRO_GATE_COOKIE_NAME,
    getRestroGatePassword(),
    buildCookieConfig()
  );

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({
    ok: true,
    message: "Access removed.",
  });

  response.cookies.set(RESTRO_GATE_COOKIE_NAME, "", {
    ...buildCookieConfig(),
    maxAge: 0,
  });

  return response;
}
