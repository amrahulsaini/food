"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type AuthPanel = "login" | "register";

interface RestaurantAuthProfile {
  restaurantId: number;
  ownerName: string;
}

interface LoginFormState {
  email: string;
  password: string;
}

interface RegistrationFormState {
  restaurantName: string;
  ownerName: string;
  mobileNumber: string;
  email: string;
  password: string;
  confirmPassword: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  sgstPercent: string;
  cgstPercent: string;
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

  const [activePanel, setActivePanel] = useState<AuthPanel>("login");
  const [status, setStatus] = useState(
    "Sign in if already approved by admin, or register your restaurant account."
  );
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const [loginForm, setLoginForm] = useState<LoginFormState>({
    email: "",
    password: "",
  });

  const [registrationForm, setRegistrationForm] = useState<RegistrationFormState>({
    restaurantName: "",
    ownerName: "",
    mobileNumber: "",
    email: "",
    password: "",
    confirmPassword: "",
    addressLine1: "",
    addressLine2: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    gstin: "",
    sgstPercent: "9",
    cgstPercent: "9",
  });

  async function submitLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    setIsSigningIn(true);
    setStatus("Signing in...");

    try {
      const response = await fetch("/api/restro/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginForm),
      });

      if (!response.ok) {
        throw new Error(await readMessage(response));
      }

      const payload = (await response.json()) as {
        restaurant?: RestaurantAuthProfile;
      };

      const restaurant = payload.restaurant;

      if (!restaurant) {
        throw new Error("Unable to load restaurant profile.");
      }

      setStatus("Login successful. Opening dashboard...");

      router.push(
        `/restro/dashboard?restaurantId=${encodeURIComponent(
          String(restaurant.restaurantId)
        )}&owner=${encodeURIComponent(restaurant.ownerName)}`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setIsSigningIn(false);
    }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (registrationForm.password !== registrationForm.confirmPassword) {
      setStatus("Password and confirm password do not match.");
      return;
    }

    setIsRegistering(true);
    setStatus("Creating restaurant account...");

    try {
      const response = await fetch("/api/restro/restaurants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurantName: registrationForm.restaurantName,
          ownerName: registrationForm.ownerName,
          mobileNumber: registrationForm.mobileNumber,
          email: registrationForm.email,
          password: registrationForm.password,
          addressLine1: registrationForm.addressLine1,
          addressLine2: registrationForm.addressLine2,
          landmark: registrationForm.landmark,
          city: registrationForm.city,
          state: registrationForm.state,
          pincode: registrationForm.pincode,
          gstin: registrationForm.gstin,
          sgstPercent: registrationForm.sgstPercent,
          cgstPercent: registrationForm.cgstPercent,
        }),
      });

      if (!response.ok) {
        throw new Error(await readMessage(response));
      }

      setLoginForm({
        email: registrationForm.email,
        password: registrationForm.password,
      });

      setRegistrationForm((prev) => ({
        ...prev,
        password: "",
        confirmPassword: "",
      }));

      setActivePanel("login");
      setStatus(
        "Registration submitted. Your account is on hold until admin approves it in database."
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setIsRegistering(false);
    }
  }

  return (
    <div className="soft-grid-bg flex flex-1">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 pb-12 pt-10 md:px-8">
        <section className="glass-panel p-6 md:p-8">
          <p className="brand-badge">Foodisthan Restro Portal</p>
          <h1 className="mt-3 text-3xl font-black text-[var(--brand-deep)] md:text-4xl">
            Restaurant Access And Approval Workflow
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5f3828]">
            New registrations stay on hold until admin sets account status to
            approved. Login works only after approval.
          </p>
          <div className="mt-4 rounded-xl bg-[#fff3e4] px-4 py-3 text-sm text-[#6f4028]">
            {status}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/" className="food-btn-outline">
              Back Home
            </Link>
            <Link href="/customer" className="food-btn-outline">
              Customer View
            </Link>
          </div>
        </section>

        <section className="elevated-card p-5">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={activePanel === "login" ? "food-btn" : "food-btn-outline"}
              onClick={() => {
                setActivePanel("login");
              }}
            >
              Login Card
            </button>
            <button
              type="button"
              className={activePanel === "register" ? "food-btn" : "food-btn-outline"}
              onClick={() => {
                setActivePanel("register");
              }}
            >
              Register Card
            </button>
          </div>

          {activePanel === "login" ? (
            <article className="mt-5 rounded-xl border border-[#efccb0] bg-[#fff8ef] p-4">
              <h2 className="section-title text-[var(--brand-deep)]">Login</h2>
              <p className="mt-1 text-sm text-[#6a3f2c]">
                Login with email and password after admin approval.
              </p>

              <form className="mt-4 space-y-3" onSubmit={submitLogin}>
                <label className="text-sm font-semibold text-[#60372a]">Email</label>
                <input
                  type="email"
                  className="food-input"
                  placeholder="owner@restaurant.com"
                  value={loginForm.email}
                  onChange={(event) => {
                    setLoginForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }));
                  }}
                />

                <label className="text-sm font-semibold text-[#60372a]">Password</label>
                <input
                  type="password"
                  className="food-input"
                  placeholder="Enter password"
                  value={loginForm.password}
                  onChange={(event) => {
                    setLoginForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }));
                  }}
                />

                <button type="submit" className="food-btn w-full" disabled={isSigningIn}>
                  {isSigningIn ? "Signing In..." : "Sign In To Dashboard"}
                </button>
              </form>
            </article>
          ) : (
            <article className="mt-5 rounded-xl border border-[#efccb0] bg-[#fff8ef] p-4">
              <h2 className="section-title text-[var(--brand-deep)]">
                Register Restaurant
              </h2>
              <p className="mt-1 text-sm text-[#6a3f2c]">
                Fill all business details. Account status starts as on hold.
              </p>

              <form className="mt-4 space-y-3" onSubmit={submitRegistration}>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-[#60372a]">
                      Restaurant Name
                    </label>
                    <input
                      className="food-input"
                      placeholder="Foodisthan Downtown"
                      value={registrationForm.restaurantName}
                      onChange={(event) => {
                        setRegistrationForm((prev) => ({
                          ...prev,
                          restaurantName: event.target.value,
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#60372a]">
                      Owner Name
                    </label>
                    <input
                      className="food-input"
                      placeholder="Rahul Saini"
                      value={registrationForm.ownerName}
                      onChange={(event) => {
                        setRegistrationForm((prev) => ({
                          ...prev,
                          ownerName: event.target.value,
                        }));
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-[#60372a]">
                      Mobile Number
                    </label>
                    <input
                      className="food-input"
                      placeholder="9876543210"
                      value={registrationForm.mobileNumber}
                      onChange={(event) => {
                        setRegistrationForm((prev) => ({
                          ...prev,
                          mobileNumber: event.target.value,
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#60372a]">Email</label>
                    <input
                      type="email"
                      className="food-input"
                      placeholder="owner@restaurant.com"
                      value={registrationForm.email}
                      onChange={(event) => {
                        setRegistrationForm((prev) => ({
                          ...prev,
                          email: event.target.value,
                        }));
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-[#60372a]">Password</label>
                    <input
                      type="password"
                      className="food-input"
                      placeholder="Minimum 8 characters"
                      value={registrationForm.password}
                      onChange={(event) => {
                        setRegistrationForm((prev) => ({
                          ...prev,
                          password: event.target.value,
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#60372a]">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      className="food-input"
                      placeholder="Re-enter password"
                      value={registrationForm.confirmPassword}
                      onChange={(event) => {
                        setRegistrationForm((prev) => ({
                          ...prev,
                          confirmPassword: event.target.value,
                        }));
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-[#60372a]">
                    Address Line 1
                  </label>
                  <input
                    className="food-input"
                    placeholder="Building, street, area"
                    value={registrationForm.addressLine1}
                    onChange={(event) => {
                      setRegistrationForm((prev) => ({
                        ...prev,
                        addressLine1: event.target.value,
                      }));
                    }}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-semibold text-[#60372a]">
                      Address Line 2
                    </label>
                    <input
                      className="food-input"
                      placeholder="Floor, unit, nearby"
                      value={registrationForm.addressLine2}
                      onChange={(event) => {
                        setRegistrationForm((prev) => ({
                          ...prev,
                          addressLine2: event.target.value,
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#60372a]">Landmark</label>
                    <input
                      className="food-input"
                      placeholder="Near metro or mall"
                      value={registrationForm.landmark}
                      onChange={(event) => {
                        setRegistrationForm((prev) => ({
                          ...prev,
                          landmark: event.target.value,
                        }));
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-semibold text-[#60372a]">City</label>
                    <input
                      className="food-input"
                      placeholder="Kolkata"
                      value={registrationForm.city}
                      onChange={(event) => {
                        setRegistrationForm((prev) => ({
                          ...prev,
                          city: event.target.value,
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#60372a]">State</label>
                    <input
                      className="food-input"
                      placeholder="West Bengal"
                      value={registrationForm.state}
                      onChange={(event) => {
                        setRegistrationForm((prev) => ({
                          ...prev,
                          state: event.target.value,
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#60372a]">Pincode</label>
                    <input
                      className="food-input"
                      placeholder="700001"
                      value={registrationForm.pincode}
                      onChange={(event) => {
                        setRegistrationForm((prev) => ({
                          ...prev,
                          pincode: event.target.value,
                        }));
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="text-sm font-semibold text-[#60372a]">GSTIN</label>
                    <input
                      className="food-input"
                      placeholder="Optional"
                      value={registrationForm.gstin}
                      onChange={(event) => {
                        setRegistrationForm((prev) => ({
                          ...prev,
                          gstin: event.target.value,
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#60372a]">SGST %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      className="food-input"
                      value={registrationForm.sgstPercent}
                      onChange={(event) => {
                        setRegistrationForm((prev) => ({
                          ...prev,
                          sgstPercent: event.target.value,
                        }));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-[#60372a]">CGST %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      className="food-input"
                      value={registrationForm.cgstPercent}
                      onChange={(event) => {
                        setRegistrationForm((prev) => ({
                          ...prev,
                          cgstPercent: event.target.value,
                        }));
                      }}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="food-btn w-full"
                  disabled={isRegistering}
                >
                  {isRegistering ? "Submitting..." : "Submit For Admin Approval"}
                </button>
              </form>
            </article>
          )}
        </section>
      </main>
    </div>
  );
}
