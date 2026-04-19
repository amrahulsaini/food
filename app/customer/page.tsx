"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

interface ItemVariant {
  id: number;
  name: string;
  priceDelta: number;
  stockQty: number;
  isDefault: boolean;
}

interface ItemAddon {
  id: number;
  name: string;
  price: number;
  maxSelect: number;
  isRequired: boolean;
}

interface Item {
  id: number;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
  stockQty: number;
  isVeg: boolean;
  offerTitle: string | null;
  offerDiscountPercent: number | null;
  variants: ItemVariant[];
  addons: ItemAddon[];
}

interface MenuCategory {
  id: number;
  name: string;
  imageUrl: string | null;
  items: Item[];
}

interface MenuResponse {
  restaurant: {
    id: number;
    name: string;
    city: string | null;
  } | null;
  categories: MenuCategory[];
}

async function readMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

export default function CustomerPreviewPage() {
  const [restaurantId, setRestaurantId] = useState("1");
  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [status, setStatus] = useState("Select restaurantId and click Load Menu.");
  const [loading, setLoading] = useState(false);

  async function fetchMenu(targetRestaurantId: string): Promise<void> {
    setLoading(true);

    try {
      const response = await fetch(
        `/api/customer/menu?restaurantId=${encodeURIComponent(targetRestaurantId)}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(await readMessage(response));
      }

      const payload = (await response.json()) as MenuResponse;

      setMenu(payload);
      setStatus("Customer menu synced.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to load menu.");
    } finally {
      setLoading(false);
    }
  }

  function handleLoad(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    fetchMenu(restaurantId).catch(() => {
      setStatus("Unable to load menu.");
    });
  }

  return (
    <div className="soft-grid-bg flex flex-1">
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-5 pb-12 pt-9 md:px-8">
        <section className="glass-panel p-6">
          <p className="brand-badge">Customer App Preview</p>
          <h1 className="mt-3 text-3xl font-black text-[var(--brand-deep)]">
            foodisthan-customer menu feed
          </h1>
          <p className="mt-2 text-sm text-[#6b4131]">
            This endpoint response is what your Flutter customer app can consume for
            category and item listing.
          </p>

          <form className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto]" onSubmit={handleLoad}>
            <input
              className="food-input"
              value={restaurantId}
              onChange={(event) => {
                setRestaurantId(event.target.value);
              }}
              placeholder="restaurantId"
            />
            <p className="rounded-xl bg-[#fff5e7] px-3 py-2 text-sm text-[#70432e]">
              {status}
            </p>
            <button type="submit" className="food-btn" disabled={loading}>
              {loading ? "Loading..." : "Load Menu"}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/restro/login" className="food-btn-outline">
              Open Restro Login
            </Link>
            <Link href="/" className="food-btn-outline">
              Back Home
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {menu?.restaurant ? (
            menu.categories.map((category) => (
              <article key={category.id} className="elevated-card p-4">
                <div className="flex items-center gap-3">
                  {category.imageUrl ? (
                    <img
                      src={category.imageUrl}
                      alt={category.name}
                      loading="lazy"
                      className="h-12 w-12 rounded-lg border border-[#ead3bd] object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg border border-dashed border-[#d6bca3] bg-[#fff2e3]" />
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-[var(--brand-deep)]">{category.name}</h2>
                    <p className="mt-1 text-xs text-[#754934]">{category.items.length} items</p>
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  {category.items.map((item) => (
                    <div key={item.id} className="rounded-xl bg-[#fff5e9] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-3">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              loading="lazy"
                              className="h-14 w-14 shrink-0 rounded-lg border border-[#ead3bd] object-cover"
                            />
                          ) : (
                            <div className="h-14 w-14 shrink-0 rounded-lg border border-dashed border-[#d6bca3] bg-[#fff2e3]" />
                          )}
                          <p className="truncate font-semibold text-[#5b2e1e]">{item.name}</p>
                        </div>
                        <span className="text-xs text-[#6d3f2f]">Rs. {item.basePrice}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#7d4f3a]">
                        Stock: {item.stockQty} | {item.isVeg ? "Veg" : "Non-veg"}
                      </p>
                      {item.offerTitle ? (
                        <p className="mt-1 text-xs font-semibold text-[#b03f0c]">
                          {item.offerTitle}
                          {item.offerDiscountPercent
                            ? ` (${item.offerDiscountPercent}% off)`
                            : ""}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-[#7d4f3a]">
                        Variants: {item.variants.length} | Add-ons: {item.addons.length}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <article className="elevated-card col-span-full p-5 text-sm text-[#734633]">
              No restaurant/menu found for the selected restaurantId.
            </article>
          )}
        </section>
      </main>
    </div>
  );
}
