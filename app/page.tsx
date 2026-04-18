import Link from "next/link";

export default function Home() {
  const appCards = [
    {
      title: "foodisthan-customer",
      route: "/customer",
      badge: "Flutter App",
      points: [
        "Browse parent/sub categories",
        "View item variants and add-ons",
        "See live offers with date-time windows",
      ],
    },
    {
      title: "foodisthan-restro",
      route: "/restro/login",
      badge: "Flutter + Web Portal",
      points: [
        "Manage categories and sub categories",
        "Add/edit item stock, SKU, pricing",
        "Configure variants, add-ons and offers",
      ],
    },
    {
      title: "foodisthan-delivery",
      route: "/delivery",
      badge: "Flutter App",
      points: [
        "Assigned order queue",
        "Pickup and delivery status",
        "Route and earnings tracking",
      ],
    },
  ];

  return (
    <div className="soft-grid-bg flex flex-1">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-5 pb-12 pt-10 md:px-8 lg:px-12">
        <section className="glass-panel fade-up p-6 md:p-9">
          <p className="brand-badge">Foodisthan Commerce Stack</p>
          <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-[var(--brand-deep)] md:text-5xl">
            Zomato-style multi-app base with MySQL APIs and Restro control panel.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#5f3828] md:text-base">
            This workspace now contains the backend and web portal starter so you can
            immediately build three Flutter apps: customer browsing, restaurant
            operations, and delivery execution.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/restro/login" className="food-btn">
              Open Restro Login
            </Link>
            <Link href="/customer" className="food-btn-outline">
              Preview Customer Menu
            </Link>
          </div>
        </section>

        <section className="fade-up-delay grid gap-5 md:grid-cols-3">
          {appCards.map((card) => (
            <article key={card.title} className="elevated-card p-5">
              <p className="status-pill">{card.badge}</p>
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
                Explore module -&gt;
              </Link>
            </article>
          ))}
        </section>

        <section className="glass-panel p-6 md:p-8">
          <h3 className="section-title text-[var(--brand-deep)]">Build Sequence</h3>
          <div className="mt-4 grid gap-3 text-sm text-[#643f30] md:grid-cols-3">
            <p className="rounded-xl bg-[#fff5e8] px-4 py-3">
              1. Use Restro Login to bootstrap schema and create your restaurants.
            </p>
            <p className="rounded-xl bg-[#fff5e8] px-4 py-3">
              2. Add categories/items with variants, add-ons, stock, and timed offers.
            </p>
            <p className="rounded-xl bg-[#fff5e8] px-4 py-3">
              3. Connect Flutter apps to customer menu and restro CRUD APIs.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
