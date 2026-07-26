import { NextResponse } from "next/server";
import {
  createOperationsSessionToken,
  OPERATIONS_SESSION_COOKIE,
  operationsSessionCookieOptions,
  passwordsMatch,
} from "@/lib/operations-session";

export async function POST(request: Request) {
  const expectedPassword = process.env.OPS_ACCESS_PASSWORD;
  const sessionSecret = process.env.OPS_SESSION_SECRET;

  if (!expectedPassword || !sessionSecret) {
    return Response.json(
      { error: "Staff access has not been configured." },
      { status: 503 },
    );
  }

  let suppliedPassword = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    if (typeof body.password === "string") suppliedPassword = body.password;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!(await passwordsMatch(suppliedPassword, expectedPassword))) {
    return Response.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(
    OPERATIONS_SESSION_COOKIE,
    await createOperationsSessionToken(sessionSecret),
    operationsSessionCookieOptions,
  );
  return response;
}
