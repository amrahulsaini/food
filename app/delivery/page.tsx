import Link from "next/link";

export default function DeliveryRoadmapPage() {
  const modules = [
    "Rider onboarding and profile",
    "Assigned order queue and acceptance",
    "Pickup confirmation with OTP",
    "Live order status and route map",
    "Daily earnings, payout and settlements",
  ];

  return (
    <div className="soft-grid-bg flex flex-1">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-5 pb-12 pt-10 md:px-8">
        <section className="glass-panel p-6 md:p-8">
          <p className="brand-badge">foodisthan-delivery</p>
          <h1 className="mt-3 text-3xl font-black text-[var(--brand-deep)]">
            Delivery App Blueprint
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#6a3f2b]">
            This module is the implementation plan for your Flutter delivery app. Use
            the restro + customer APIs as the base, then add assignment and tracking
            endpoints for riders.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-[#6b4131]">
            {modules.map((module) => (
              <li key={module} className="rounded-lg bg-[#fff4e6] px-3 py-2">
                {module}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/restro/login" className="food-btn">
              Open Restro Portal
            </Link>
            <Link href="/" className="food-btn-outline">
              Back to Home
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
