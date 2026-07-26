"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error || "Unable to sign in.");
        return;
      }

      window.location.replace("/");
    } catch {
      setError("Unable to reach the app. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-4 text-stone-900">
      <Card className="w-full max-w-md rounded-3xl border-stone-200 shadow-sm">
        <CardContent className="space-y-6 p-7">
          <div className="space-y-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-900 text-white">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-stone-500">
                EN Spa Operations
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">
                Staff sign in
              </h1>
            </div>
            <p className="text-sm leading-6 text-stone-600">
              Enter the staff password to access daily client appointment
              information.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-stone-700">
                Staff password
              </span>
              <input
                autoComplete="current-password"
                autoFocus
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-stone-500"
                required
              />
            </label>

            {error && (
              <p
                role="alert"
                className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting || !password}
              className="w-full rounded-2xl"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
