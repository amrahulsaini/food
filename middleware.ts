import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isRestroGateAuthorized,
  RESTRO_GATE_COOKIE_NAME,
} from "@/lib/restro-gate";

function isPublicRestroPath(pathname: string): boolean {
  return pathname === "/restro/access" || pathname === "/api/restro/gate";
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicRestroPath(pathname)) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(RESTRO_GATE_COOKIE_NAME)?.value;
  const authorized = isRestroGateAuthorized(cookieValue);

  if (authorized) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/restro")) {
    return NextResponse.json(
      {
        ok: false,
        message: "Restro portal is protected. Enter access password first.",
      },
      { status: 401 }
    );
  }

  const redirectUrl = new URL("/restro/access", request.url);
  const nextPath = `${pathname}${search}`;

  if (nextPath !== "/restro/access") {
    redirectUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/restro/:path*", "/api/restro/:path*"],
};
