"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";

type AuthPanel = "login" | "register";

interface RestaurantAuthProfile {
  restaurantId: number;
  restaurantSlug: string;
  ownerName: string;
  ownerEmail: string;
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

function buildBusinessAddress(form: RegistrationFormState): string {
  return [form.addressLine1, form.addressLine2, form.landmark]
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .join(", ");
}

function createClientSlug(length = 8): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const random = new Uint32Array(length);
  crypto.getRandomValues(random);

  return Array.from(random)
    .map((value) => alphabet[value % alphabet.length])
    .join("");
}

export default function RestroLoginPage() {
  const router = useRouter();
  const toastTimerRef = useRef<number | null>(null);
  const imageUploadRequestRef = useRef(0);
  const loginWarmupPromiseRef = useRef<Promise<void> | null>(null);

  const [activePanel, setActivePanel] = useState<AuthPanel>("login");
  const [status, setStatus] = useState(
    "Sign in if your account is approved, or register with mandatory restaurant image."
  );
  const [toast, setToast] = useState<string | null>(null);
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
  const [imageInputKey, setImageInputKey] = useState(0);
  const [restaurantImage, setRestaurantImage] = useState<File | null>(null);
  const [preparedRestaurantSlug, setPreparedRestaurantSlug] = useState("");
  const [uploadedRestaurantImageUrl, setUploadedRestaurantImageUrl] = useState("");
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [isImageUploading, setIsImageUploading] = useState(false);

  useEffect(() => {
    const warmupPromise = Promise.all([
      fetch("/api/restro/auth/login?warm=1", {
        cache: "no-store",
      }),
      fetch("/api/restro/bootstrap?warm=1", {
        cache: "no-store",
      }),
    ])
      .then(() => undefined)
      .catch(() => {
        // Warm-up is best-effort.
      });

    loginWarmupPromiseRef.current = warmupPromise;

    void warmupPromise.finally(() => {
      if (loginWarmupPromiseRef.current === warmupPromise) {
        loginWarmupPromiseRef.current = null;
      }
    });
  }, []);

  function notify(message: string): void {
    setStatus(message);
    setToast(message);

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3200);
  }

  async function uploadRegistrationImage(
    file: File,
    slug: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const formData = new FormData();
      formData.append("slug", slug);
      formData.append("file", file);
      formData.append("allowUnregistered", "1");

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/restro/upload");

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          return;
        }

        const percentage = Math.min(
          100,
          Math.max(1, Math.round((event.loaded / event.total) * 100))
        );
        onProgress?.(percentage);
      };

      xhr.onerror = () => {
        reject(new Error("Image upload failed. Check your connection and retry."));
      };

      xhr.onload = () => {
        let payload: { imageUrl?: string; message?: string } = {};

        try {
          payload = JSON.parse(xhr.responseText) as {
            imageUrl?: string;
            message?: string;
          };
        } catch {
          payload = {};
        }

        if (xhr.status >= 200 && xhr.status < 300 && payload.imageUrl) {
          resolve(payload.imageUrl);
          return;
        }

        reject(
          new Error(payload.message ?? `Image upload failed with status ${xhr.status}.`)
        );
      };

      xhr.send(formData);
    });
  }

  async function handleRestaurantImageChange(file: File | null): Promise<void> {
    setRestaurantImage(file);
    setPreparedRestaurantSlug("");
    setUploadedRestaurantImageUrl("");
    setImageUploadProgress(0);

    if (!file) {
      return;
    }

    const uploadId = imageUploadRequestRef.current + 1;
    imageUploadRequestRef.current = uploadId;

    const slug = createClientSlug(8);
    setPreparedRestaurantSlug(slug);
    setIsImageUploading(true);
    notify("Uploading restaurant image...");

    try {
      const imageUrl = await uploadRegistrationImage(file, slug, (progress) => {
        if (uploadId === imageUploadRequestRef.current) {
          setImageUploadProgress(progress);
        }
      });

      if (uploadId !== imageUploadRequestRef.current) {
        return;
      }

      setUploadedRestaurantImageUrl(imageUrl);
      setImageUploadProgress(100);
      notify("Restaurant image uploaded. Submit is now ready.");
    } catch (error) {
      if (uploadId !== imageUploadRequestRef.current) {
        return;
      }

      setRestaurantImage(null);
      setPreparedRestaurantSlug("");
      setUploadedRestaurantImageUrl("");
      setImageUploadProgress(0);
      notify(error instanceof Error ? error.message : "Restaurant image upload failed.");
    } finally {
      if (uploadId === imageUploadRequestRef.current) {
        setIsImageUploading(false);
      }
    }
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const pendingWarmup = loginWarmupPromiseRef.current;

    if (pendingWarmup) {
      notify("Preparing secure login...");
      await pendingWarmup;
    }

    setIsSigningIn(true);
    notify("Signing in...");

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

      notify("Login successful. Opening dashboard...");

      const ownerQuery = encodeURIComponent(restaurant.ownerName);
      const slugQuery = encodeURIComponent(restaurant.restaurantSlug);
      const restaurantIdQuery = encodeURIComponent(String(restaurant.restaurantId));
      const emailQuery = encodeURIComponent(restaurant.ownerEmail);

      router.push(
        `/restro/dashboard?slug=${slugQuery}&owner=${ownerQuery}&rid=${restaurantIdQuery}&email=${emailQuery}`
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setIsSigningIn(false);
    }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (registrationForm.password !== registrationForm.confirmPassword) {
      notify("Password and confirm password do not match.");
      return;
    }

    if (isImageUploading) {
      notify("Please wait, restaurant image is still uploading.");
      return;
    }

    if (!restaurantImage || !uploadedRestaurantImageUrl || !preparedRestaurantSlug) {
      notify("Restaurant image upload is mandatory before registration.");
      return;
    }

    const businessAddress = buildBusinessAddress(registrationForm);

    if (businessAddress.length < 6) {
      notify("Provide a full business address before submitting.");
      return;
    }

    setIsRegistering(true);
    notify("Creating restaurant account...");

    try {
      const response = await fetch("/api/restro/restaurants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurantName: registrationForm.restaurantName,
          ownerName: registrationForm.ownerName,
          ownerMobile: registrationForm.mobileNumber,
          ownerEmail: registrationForm.email,
          ownerPassword: registrationForm.password,
          businessAddress,
          city: [registrationForm.city.trim(), registrationForm.state.trim()]
            .filter((value) => value.length > 0)
            .join(", "),
          postalCode: registrationForm.pincode,
          gstin: registrationForm.gstin,
          sgstPercent: registrationForm.sgstPercent,
          cgstPercent: registrationForm.cgstPercent,
          restaurantSlug: preparedRestaurantSlug,
          restaurantImageUrl: uploadedRestaurantImageUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(await readMessage(response));
      }

      const payload = (await response.json()) as {
        restaurant?: RestaurantAuthProfile;
      };

      const restaurantSlug = payload.restaurant?.restaurantSlug ?? "";

      setLoginForm({
        email: registrationForm.email,
        password: registrationForm.password,
      });

      setRegistrationForm((prev) => ({
        ...prev,
        password: "",
        confirmPassword: "",
      }));

      imageUploadRequestRef.current += 1;
      setRestaurantImage(null);
      setPreparedRestaurantSlug("");
      setUploadedRestaurantImageUrl("");
      setImageUploadProgress(0);
      setImageInputKey((prev) => prev + 1);
      setActivePanel("login");
      notify(
        restaurantSlug
          ? `Registration submitted with slug ${restaurantSlug}. Account stays on hold until admin approves.`
          : "Registration submitted. Account stays on hold until admin approves."
      );
    } catch (error) {
      notify(error instanceof Error ? error.message : "Registration failed.");
    } finally {
      setIsRegistering(false);
    }
  }

  return (
    <div className="soft-grid-bg flex flex-1">
      {toast ? (
        <div className="toast-success fixed right-4 top-4 z-40 max-w-md px-4 py-3 text-sm font-semibold text-[#124f2d] shadow-lg">
          {toast}
        </div>
      ) : null}

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
          <p className="mt-4 rounded-xl bg-[#f8efe8] px-4 py-3 text-sm text-[#68404d]">
            {status}
          </p>
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
                Fill all business details and upload restaurant image. Account starts
                on hold.
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
                    Restaurant Image (mandatory)
                  </label>
                  <input
                    key={imageInputKey}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="food-input"
                    onChange={(event) => {
                      const selectedFile = event.target.files?.[0] ?? null;
                      handleRestaurantImageChange(selectedFile).catch(() => {
                        notify("Restaurant image upload failed.");
                      });
                    }}
                  />

                  <div className="mt-2 rounded-lg bg-[#f3eadf] p-2">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#e5d5c0]">
                      <div
                        className="h-full rounded-full bg-[var(--brand)] transition-all duration-200"
                        style={{ width: `${Math.min(100, Math.max(0, imageUploadProgress))}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-[#5d3a2e]">
                      {isImageUploading
                        ? `Uploading image... ${imageUploadProgress}%`
                        : uploadedRestaurantImageUrl
                          ? "Image uploaded successfully."
                          : restaurantImage
                            ? "Image selected."
                            : "Choose image to start auto upload."}
                    </p>
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
                    <label className="text-sm font-semibold text-[#60372a]">
                      GSTIN (Optional)
                    </label>
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
                  disabled={isRegistering || isImageUploading}
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
