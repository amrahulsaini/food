import Image from "next/image";
import Link from "next/link";

export default function Home() {
  const highlights = [
    {
      title: "For Customers",
      subtitle: "Fast ordering",
      points: [
        "Browse cuisines and categories",
        "Choose variants and add-ons",
        "Get offers and live availability",
      ],
      route: "/customer",
      cta: "Explore Menu",
    },
    {
      title: "For Restaurants",
      subtitle: "Full control",
      points: [
        "Register business with tax details",
        "Manage menu, stock, and pricing",
        "Run time-based offers instantly",
      ],
      route: "/restro/login",
      cta: "Restaurant Login",
    },
    {
      title: "For Delivery",
      subtitle: "Reliable fulfillment",
      points: [
        "Accept and track assigned deliveries",
        "Pickup and drop status updates",
        "Daily order and payout visibility",
      ],
      route: "/delivery",
      cta: "View Delivery Flow",
    },
  ];

  return (
    <div className="soft-grid-bg flex flex-1">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-5 pb-12 pt-10 md:px-8 lg:px-12">
        <section className="glass-panel fade-up p-6 md:p-9">
          <div className="flex flex-wrap items-center gap-3">
            <Image
              src="/foodistha-main-logo.webp"
              alt="Foodisthan logo"
              width={280}
              height={80}
              priority
              className="h-12 w-auto object-contain md:h-14"
            />
            <p className="brand-badge">Official Website</p>
          </div>
          <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-[var(--brand-deep)] md:text-5xl">
            Delicious food discovery, restaurant growth, and delivery in one place.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#5f3828] md:text-base">
            Foodisthan connects hungry customers, smart restaurant teams, and
            dependable delivery partners through one smooth ordering experience.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/restro/login" className="food-btn">
              Start Restaurant Onboarding
            </Link>
            <Link href="/customer" className="food-btn-outline">
              Browse Customer Menu
            </Link>
          </div>
        </section>

        <section className="fade-up-delay grid gap-5 md:grid-cols-3">
          {highlights.map((card) => (
            <article key={card.title} className="elevated-card p-5">
              <p className="status-pill">{card.subtitle}</p>
              <h2 className="mt-3 text-xl font-bold text-[var(--brand-deep)]">
                {card.title}
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-[#6b4131]">
                {card.points.map((point) => (
                  <li key={point} className="rounded-lg bg-[#fff6ea] px-3 py-2">
                    {point}
                  </li>
                ))}
              </ul>
              <Link
                href={card.route}
                className="mt-5 inline-flex text-sm font-semibold text-[var(--brand)]"
              >
                {card.cta} -&gt;
              </Link>
            </article>
          ))}
        </section>

        <section className="glass-panel p-6 md:p-8">
          <h3 className="section-title text-[var(--brand-deep)]">Why Foodisthan</h3>
          <div className="mt-4 grid gap-3 text-sm text-[#643f30] md:grid-cols-3">
            <p className="rounded-xl bg-[#fff5e8] px-4 py-3">
              Smart catalog controls with category, variant, and add-on management.
            </p>
            <p className="rounded-xl bg-[#fff5e8] px-4 py-3">
              Complete business onboarding with contact, address, and tax details.
            </p>
            <p className="rounded-xl bg-[#fff5e8] px-4 py-3">
              Unified experience for ordering, operations, and last-mile delivery.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
