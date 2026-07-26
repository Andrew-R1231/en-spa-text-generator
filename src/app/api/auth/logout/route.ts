import { NextResponse } from "next/server";
import {
  OPERATIONS_SESSION_COOKIE,
  operationsSessionCookieOptions,
} from "@/lib/operations-session";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(OPERATIONS_SESSION_COOKIE, "", {
    ...operationsSessionCookieOptions,
    maxAge: 0,
  });
  return response;
}
