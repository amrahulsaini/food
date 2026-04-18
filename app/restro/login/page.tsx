"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

interface Restaurant {
  id: number;
  name: string;
  city: string | null;
  slug: string;
}

async function readMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

export default function RestroLoginPage() {
  const router = useRouter();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [newRestaurantName, setNewRestaurantName] = useState("");
  const [newRestaurantCity, setNewRestaurantCity] = useState("");
  const [status, setStatus] = useState(
    "Click Bootstrap to initialize schema and restaurants."
  );
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  async function loadRestaurants(): Promise<void> {
    const response = await fetch("/api/restro/restaurants", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(await readMessage(response));
    }

    const payload = (await response.json()) as {
      restaurants?: Restaurant[];
    };

    const list = payload.restaurants ?? [];
    setRestaurants(list);

    if (list.length > 0) {
      setRestaurantId((prev) => prev || String(list[0].id));
      setStatus("Restaurants loaded. Continue to dashboard.");
      return;
    }

    setStatus("No restaurant found. Create your first one below.");
  }

  async function bootstrapSchema(): Promise<void> {
    setIsBootstrapping(true);
    setStatus("Creating schema and default records...");

    try {
      const response = await fetch("/api/restro/bootstrap", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await readMessage(response));
      }

      await loadRestaurants();
      setStatus("Schema ready. You can log in now.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Bootstrap failed unexpectedly."
      );
    } finally {
      setIsBootstrapping(false);
    }
  }

  async function createNewRestaurant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newRestaurantName.trim()) {
      setStatus("Restaurant name is required.");
      return;
    }

    setIsCreating(true);
    setStatus("Creating restaurant...");

    try {
      const response = await fetch("/api/restro/restaurants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newRestaurantName,
          city: newRestaurantCity,
        }),
      });

      if (!response.ok) {
        throw new Error(await readMessage(response));
      }

      const payload = (await response.json()) as {
        restaurant?: Restaurant;
      };

      const created = payload.restaurant;

      if (created) {
        setRestaurantId(String(created.id));
      }

      setNewRestaurantName("");
      setNewRestaurantCity("");
      await loadRestaurants();
      setStatus("Restaurant created. Continue to dashboard.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create restaurant.");
    } finally {
      setIsCreating(false);
    }
  }

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!restaurantId) {
      setStatus("Select a restaurant before opening dashboard.");
      return;
    }

    const owner = ownerName.trim() || "Manager";

    router.push(
      `/restro/dashboard?restaurantId=${encodeURIComponent(
        restaurantId
      )}&owner=${encodeURIComponent(owner)}`
    );
  }

  return (
    <div className="soft-grid-bg flex flex-1">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-5 pb-12 pt-10 md:px-8">
        <section className="glass-panel p-6 md:p-8">
          <p className="brand-badge">Restro Login</p>
          <h1 className="mt-4 text-3xl font-black text-[var(--brand-deep)]">
            Manage Menu, Stock, Variants, and Offers
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#5f3828]">
            Use this web portal as the admin cockpit for the
            foodisthan-restro app. The same APIs will be consumed by your Flutter
            apps.
          </p>
          <div className="mt-4 rounded-xl bg-[#fff3e4] px-4 py-3 text-sm text-[#6f4028]">
            {status}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              className="food-btn"
              onClick={() => {
                bootstrapSchema().catch(() => {
                  setStatus("Unable to initialize schema.");
                });
              }}
              disabled={isBootstrapping}
            >
              {isBootstrapping ? "Bootstrapping..." : "Bootstrap MySQL Schema"}
            </button>
            <button
              type="button"
              className="food-btn-outline"
              onClick={() => {
                loadRestaurants().catch((error) => {
                  setStatus(
                    error instanceof Error
                      ? error.message
                      : "Unable to load restaurants."
                  );
                });
              }}
            >
              Load Restaurants
            </button>
            <Link href="/" className="food-btn-outline">
              Back to Platform Home
            </Link>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <article className="elevated-card p-5">
            <h2 className="section-title text-[var(--brand-deep)]">Login</h2>
            <form className="mt-4 space-y-3" onSubmit={submitLogin}>
              <label className="text-sm font-semibold text-[#60372a]">
                Restaurant
              </label>
              <select
                className="food-select"
                value={restaurantId}
                onChange={(event) => {
                  setRestaurantId(event.target.value);
                }}
              >
                <option value="">Select restaurant</option>
                {restaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                    {restaurant.city ? ` - ${restaurant.city}` : ""}
                  </option>
                ))}
              </select>

              <label className="text-sm font-semibold text-[#60372a]">
                Owner Name
              </label>
              <input
                className="food-input"
                placeholder="Owner or manager"
                value={ownerName}
                onChange={(event) => {
                  setOwnerName(event.target.value);
                }}
              />

              <button type="submit" className="food-btn w-full">
                Open Restro Dashboard
              </button>
            </form>
          </article>

          <article className="elevated-card p-5">
            <h2 className="section-title text-[var(--brand-deep)]">
              Create New Restaurant
            </h2>
            <form className="mt-4 space-y-3" onSubmit={createNewRestaurant}>
              <label className="text-sm font-semibold text-[#60372a]">
                Restaurant Name
              </label>
              <input
                className="food-input"
                placeholder="Foodisthan Downtown"
                value={newRestaurantName}
                onChange={(event) => {
                  setNewRestaurantName(event.target.value);
                }}
              />

              <label className="text-sm font-semibold text-[#60372a]">City</label>
              <input
                className="food-input"
                placeholder="Kolkata"
                value={newRestaurantCity}
                onChange={(event) => {
                  setNewRestaurantCity(event.target.value);
                }}
              />

              <button type="submit" className="food-btn w-full" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Restaurant"}
              </button>
            </form>
          </article>
        </section>
      </main>
    </div>
  );
}
