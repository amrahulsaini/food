"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";

async function readMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

export default function RestroAccessPage() {
  const router = useRouter();
  const toastTimerRef = useRef<number | null>(null);

  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(
    "Enter restro access password to continue."
  );
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function notify(message: string): void {
    setStatus(message);
    setToast(message);

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3000);
  }

  async function submitAccess(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    setSubmitting(true);
    notify("Verifying access password...");

    try {
      const response = await fetch("/api/restro/gate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error(await readMessage(response));
      }

      notify("Access granted. Opening restro portal...");

      const params = new URLSearchParams(window.location.search);
      const nextPath = params.get("next");

      if (nextPath && nextPath.startsWith("/restro")) {
        router.push(nextPath);
        return;
      }

      router.push("/restro/login");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to verify access.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="soft-grid-bg flex flex-1">
      {toast ? (
        <div className="toast-success fixed right-4 top-4 z-40 max-w-md px-4 py-3 text-sm font-semibold text-[#124f2d] shadow-lg">
          {toast}
        </div>
      ) : null}

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 pb-12 pt-14">
        <section className="glass-panel p-6 md:p-8">
          <p className="brand-badge">Restro Access Control</p>
          <h1 className="mt-3 text-3xl font-black text-[var(--brand-deep)]">
            Protected Restaurant Portal
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#5f3828]">
            This section is restricted. Enter your restro access password to open
            restaurant login and management pages.
          </p>

          <div className="mt-4 rounded-xl bg-[#f8efe8] px-4 py-3 text-sm text-[#68404d]">
            {status}
          </div>

          <form className="mt-5 space-y-3" onSubmit={submitAccess}>
            <label className="text-sm font-semibold text-[#60372a]">
              Restro Access Password
            </label>
            <input
              type="password"
              className="food-input"
              placeholder="Enter access password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
            />

            <button type="submit" className="food-btn w-full" disabled={submitting}>
              {submitting ? "Verifying..." : "Unlock Restro Portal"}
            </button>
          </form>

          <div className="mt-4 flex justify-center">
            <Link href="/" className="food-btn-outline">
              Back Home
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
