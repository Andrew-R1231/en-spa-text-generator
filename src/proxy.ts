import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  OPERATIONS_SESSION_COOKIE,
  verifyOperationsSessionToken,
} from "@/lib/operations-session";

export async function proxy(request: NextRequest) {
  const sessionToken = request.cookies.get(OPERATIONS_SESSION_COOKIE)?.value;
  const authenticated = await verifyOperationsSessionToken(
    sessionToken,
    process.env.OPS_SESSION_SECRET,
  );

  if (authenticated) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    "/((?!login|api/auth/login|_next/static|_next/image|favicon.ico).*)",
  ],
};
