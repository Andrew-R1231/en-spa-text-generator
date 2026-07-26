import { cookies } from "next/headers";
import {
  OPERATIONS_SESSION_COOKIE,
  verifyOperationsSessionToken,
} from "@/lib/operations-session";
import { getDailyBoulevardAppointments } from "@/lib/boulevard";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const authenticated = await verifyOperationsSessionToken(
    cookieStore.get(OPERATIONS_SESSION_COOKIE)?.value,
    process.env.OPS_SESSION_SECRET,
  );

  if (!authenticated) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const date = new URL(request.url).searchParams.get("date") || "";

  try {
    const result = await getDailyBoulevardAppointments(date);
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to import appointments.";
    return Response.json({ error: message }, { status: 400 });
  }
}
