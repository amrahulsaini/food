"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useRef, useState } from "react";

interface Category {
  id: number;
  restaurantId: number;
  name: string;
  description: string | null;
  parentCategoryId: number | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface ItemVariant {
  id: number;
  itemId: number;
  name: string;
  priceDelta: number;
  stockQty: number;
  isDefault: boolean;
  sortOrder: number;
}

interface ItemAddon {
  id: number;
  itemId: number;
  name: string;
  price: number;
  maxSelect: number;
  isRequired: boolean;
  isAvailable: boolean;
  sortOrder: number;
}

interface Item {
  id: number;
  restaurantId: number;
  categoryId: number;
  categoryName: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
  stockQty: number;
  sku: string | null;
  isVeg: boolean;
  isAvailable: boolean;
  offerTitle: string | null;
  offerDiscountPercent: number | null;
  offerStartAt: string | null;
  offerEndAt: string | null;
  variants: ItemVariant[];
  addons: ItemAddon[];
}

interface CategoryForm {
  name: string;
  description: string;
  parentCategoryId: number | null;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
}

interface VariantDraft {
  name: string;
  priceDelta: number;
  stockQty: number;
  isDefault: boolean;
  sortOrder: number;
}

interface AddonDraft {
  name: string;
  price: number;
  maxSelect: number;
  isRequired: boolean;
  isAvailable: boolean;
  sortOrder: number;
}

interface ItemForm {
  name: string;
  categoryId: number | null;
  description: string;
  imageUrl: string;
  basePrice: number;
  stockQty: number;
  sku: string;
  isVeg: boolean;
  isAvailable: boolean;
  offerTitle: string;
  offerDiscountPercent: number | null;
  offerStartAt: string;
  offerEndAt: string;
  variants: VariantDraft[];
  addons: AddonDraft[];
}

const emptyCategoryForm: CategoryForm = {
  name: "",
  description: "",
  parentCategoryId: null,
  imageUrl: "",
  sortOrder: 0,
  isActive: true,
};

function emptyVariant(index = 0): VariantDraft {
  return {
    name: "",
    priceDelta: 0,
    stockQty: 0,
    isDefault: index === 0,
    sortOrder: index,
  };
}

function emptyAddon(index = 0): AddonDraft {
  return {
    name: "",
    price: 0,
    maxSelect: 1,
    isRequired: false,
    isAvailable: true,
    sortOrder: index,
  };
}

function emptyItemForm(defaultCategoryId: number | null = null): ItemForm {
  return {
    name: "",
    categoryId: defaultCategoryId,
    description: "",
    imageUrl: "",
    basePrice: 0,
    stockQty: 0,
    sku: "",
    isVeg: false,
    isAvailable: true,
    offerTitle: "",
    offerDiscountPercent: null,
    offerStartAt: "",
    offerEndAt: "",
    variants: [emptyVariant(0)],
    addons: [emptyAddon(0)],
  };
}

function formatToDateTimeLocal(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

async function readMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message ?? `Request failed with status ${response.status}.`;
  } catch {
    return `Request failed with status ${response.status}.`;
  }
}

function RestroDashboardContent() {
  const searchParams = useSearchParams();
  const initialRestaurantSlug =
    searchParams.get("slug")?.trim().toLowerCase() ?? "";
  const ownerName = searchParams.get("owner")?.trim() || "Manager";
  const toastTimerRef = useRef<number | null>(null);

  const [restaurantSlugInput, setRestaurantSlugInput] = useState(initialRestaurantSlug);
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [status, setStatus] = useState("Enter restaurant slug and click Sync Data.");
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm);
  const [categoryImageFile, setCategoryImageFile] = useState<File | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);

  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm(null));
  const [itemImageFile, setItemImageFile] = useState<File | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  function updateStatus(message: string): void {
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

  const resolveRestaurantId = useCallback(async (slugValue: string): Promise<number> => {
    const slug = slugValue.trim().toLowerCase();

    if (!/^[a-z0-9]{6,8}$/.test(slug)) {
      throw new Error("Enter a valid 6 to 8 character alphanumeric restaurant slug.");
    }

    const response = await fetch(`/api/restro/restaurants?slug=${encodeURIComponent(slug)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(await readMessage(response));
    }

    const payload = (await response.json()) as {
      restaurant?: {
        restaurantId?: number;
      };
    };

    const id = payload.restaurant?.restaurantId;

    if (!id || !Number.isFinite(id)) {
      throw new Error("Unable to resolve restaurant by slug.");
    }

    return Number(id);
  }, []);

  const loadData = useCallback(async (restaurantId: number) => {
    setLoading(true);

    try {
      const [categoryResponse, itemResponse] = await Promise.all([
        fetch(`/api/restro/categories?restaurantId=${restaurantId}`, {
          cache: "no-store",
        }),
        fetch(`/api/restro/items?restaurantId=${restaurantId}`, {
          cache: "no-store",
        }),
      ]);

      if (!categoryResponse.ok) {
        throw new Error(await readMessage(categoryResponse));
      }

      if (!itemResponse.ok) {
        throw new Error(await readMessage(itemResponse));
      }

      const categoryPayload = (await categoryResponse.json()) as {
        categories?: Category[];
      };
      const itemPayload = (await itemResponse.json()) as {
        items?: Item[];
      };

      const categoryList = categoryPayload.categories ?? [];
      const itemList = itemPayload.items ?? [];

      setCategories(categoryList);
      setItems(itemList);
      updateStatus("Dashboard synced with latest menu data.");

      setItemForm((prev) => {
        const fallbackCategory = categoryList[0]?.id ?? null;

        if (prev.categoryId) {
          return prev;
        }

        return {
          ...prev,
          categoryId: fallbackCategory,
        };
      });
    } catch (error) {
      updateStatus(error instanceof Error ? error.message : "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function refreshData(): Promise<void> {
    try {
      const resolvedRestaurantId = await resolveRestaurantId(restaurantSlugInput);
      setRestaurantId(resolvedRestaurantId);
      await loadData(resolvedRestaurantId);
    } catch (error) {
      updateStatus(error instanceof Error ? error.message : "Unable to sync dashboard.");
    }
  }

  async function uploadImageForCurrentSlug(file: File): Promise<string> {
    const normalizedSlug = restaurantSlugInput.trim().toLowerCase();

    if (!/^[a-z0-9]{6,8}$/.test(normalizedSlug)) {
      throw new Error("Sync with a valid restaurant slug before uploading images.");
    }

    const formData = new FormData();
    formData.append("slug", normalizedSlug);
    formData.append("file", file);

    const response = await fetch("/api/restro/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(await readMessage(response));
    }

    const payload = (await response.json()) as { imageUrl?: string };

    if (!payload.imageUrl) {
      throw new Error("Image upload failed.");
    }

    return payload.imageUrl;
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!restaurantId) {
      updateStatus("Sync data with a valid restaurant slug before saving category.");
      return;
    }

    try {
      const uploadedImageUrl = categoryImageFile
        ? await uploadImageForCurrentSlug(categoryImageFile)
        : categoryForm.imageUrl;

      const endpoint = editingCategoryId
        ? `/api/restro/categories/${editingCategoryId}`
        : "/api/restro/categories";
      const method = editingCategoryId ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurantId,
          ...categoryForm,
          imageUrl: uploadedImageUrl,
          parentCategoryId: categoryForm.parentCategoryId,
        }),
      });

      if (!response.ok) {
        throw new Error(await readMessage(response));
      }

      setCategoryForm(emptyCategoryForm);
      setCategoryImageFile(null);
      setEditingCategoryId(null);
      await loadData(restaurantId);
      updateStatus(editingCategoryId ? "Category updated." : "Category created.");
    } catch (error) {
      updateStatus(error instanceof Error ? error.message : "Unable to save category.");
    }
  }

  async function removeCategory(categoryId: number): Promise<void> {
    if (!restaurantId) {
      updateStatus("Sync data with a valid restaurant slug before deleting category.");
      return;
    }

    const confirmed = window.confirm("Delete this category?");
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/restro/categories/${categoryId}?restaurantId=${restaurantId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(await readMessage(response));
      }

      await loadData(restaurantId);
      updateStatus("Category deleted.");
    } catch (error) {
      updateStatus(error instanceof Error ? error.message : "Unable to delete category.");
    }
  }

  function editCategory(category: Category): void {
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      description: category.description ?? "",
      parentCategoryId: category.parentCategoryId,
      imageUrl: category.imageUrl ?? "",
      sortOrder: category.sortOrder,
      isActive: category.isActive,
    });
    setCategoryImageFile(null);
  }

  async function submitItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!restaurantId) {
      updateStatus("Sync data with a valid restaurant slug before saving item.");
      return;
    }

    if (!itemForm.categoryId) {
      updateStatus("Choose a category for the item.");
      return;
    }

    const cleanedVariants = itemForm.variants
      .filter((variant) => variant.name.trim())
      .map((variant, index) => ({
        ...variant,
        sortOrder: index,
      }));

    const cleanedAddons = itemForm.addons
      .filter((addon) => addon.name.trim())
      .map((addon, index) => ({
        ...addon,
        sortOrder: index,
      }));

    try {
      const uploadedImageUrl = itemImageFile
        ? await uploadImageForCurrentSlug(itemImageFile)
        : itemForm.imageUrl;

      const endpoint = editingItemId ? `/api/restro/items/${editingItemId}` : "/api/restro/items";
      const method = editingItemId ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurantId,
          categoryId: itemForm.categoryId,
          name: itemForm.name,
          description: itemForm.description,
          imageUrl: uploadedImageUrl,
          basePrice: itemForm.basePrice,
          stockQty: itemForm.stockQty,
          sku: itemForm.sku,
          isVeg: itemForm.isVeg,
          isAvailable: itemForm.isAvailable,
          offerTitle: itemForm.offerTitle,
          offerDiscountPercent: itemForm.offerDiscountPercent,
          offerStartAt: itemForm.offerStartAt || null,
          offerEndAt: itemForm.offerEndAt || null,
          variants: cleanedVariants,
          addons: cleanedAddons,
        }),
      });

      if (!response.ok) {
        throw new Error(await readMessage(response));
      }

      setEditingItemId(null);
      setItemImageFile(null);
      setItemForm(emptyItemForm(categories[0]?.id ?? null));
      await loadData(restaurantId);
      updateStatus(editingItemId ? "Item updated." : "Item created.");
    } catch (error) {
      updateStatus(error instanceof Error ? error.message : "Unable to save item.");
    }
  }

  async function removeItem(itemId: number): Promise<void> {
    if (!restaurantId) {
      updateStatus("Sync data with a valid restaurant slug before deleting item.");
      return;
    }

    const confirmed = window.confirm("Delete this item?");
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/restro/items/${itemId}?restaurantId=${restaurantId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(await readMessage(response));
      }

      await loadData(restaurantId);
      updateStatus("Item deleted.");
    } catch (error) {
      updateStatus(error instanceof Error ? error.message : "Unable to delete item.");
    }
  }

  function editItem(item: Item): void {
    setEditingItemId(item.id);

    setItemForm({
      name: item.name,
      categoryId: item.categoryId,
      description: item.description ?? "",
      imageUrl: item.imageUrl ?? "",
      basePrice: item.basePrice,
      stockQty: item.stockQty,
      sku: item.sku ?? "",
      isVeg: item.isVeg,
      isAvailable: item.isAvailable,
      offerTitle: item.offerTitle ?? "",
      offerDiscountPercent: item.offerDiscountPercent,
      offerStartAt: formatToDateTimeLocal(item.offerStartAt),
      offerEndAt: formatToDateTimeLocal(item.offerEndAt),
      variants:
        item.variants.length > 0
          ? item.variants.map((variant, index) => ({
              name: variant.name,
              priceDelta: variant.priceDelta,
              stockQty: variant.stockQty,
              isDefault: variant.isDefault,
              sortOrder: index,
            }))
          : [emptyVariant(0)],
      addons:
        item.addons.length > 0
          ? item.addons.map((addon, index) => ({
              name: addon.name,
              price: addon.price,
              maxSelect: addon.maxSelect,
              isRequired: addon.isRequired,
              isAvailable: addon.isAvailable,
              sortOrder: index,
            }))
          : [emptyAddon(0)],
    });
    setItemImageFile(null);

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="soft-grid-bg flex flex-1">
      {toast ? (
        <div className="toast-success fixed right-4 top-4 z-40 max-w-md px-4 py-3 text-sm font-semibold text-[#124f2d] shadow-lg">
          {toast}
        </div>
      ) : null}

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 pb-10 pt-8 md:px-8">
        <section className="glass-panel p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="brand-badge">Restro Dashboard</p>
              <h1 className="mt-3 text-2xl font-black text-[var(--brand-deep)] md:text-4xl">
                Welcome, {ownerName}
              </h1>
              <p className="mt-2 text-sm text-[#6a3f2c]">
                Control categories, menu items, stock, variants, add-ons, and offer
                windows.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/restro/login" className="food-btn-outline">
                Back to Login
              </Link>
              <Link href="/customer" className="food-btn-outline">
                Customer Preview
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[220px_1fr_auto]">
            <input
              className="food-input"
              value={restaurantSlugInput}
              onChange={(event) => {
                setRestaurantSlugInput(event.target.value.toLowerCase());
              }}
              placeholder="restaurant slug"
            />
            <p className="rounded-xl bg-[#f8efe8] px-3 py-2 text-sm text-[#68404d]">
              {status}
            </p>
            <button
              type="button"
              className="food-btn"
              onClick={() => {
                refreshData().catch(() => {
                  updateStatus("Unable to sync dashboard.");
                });
              }}
              disabled={loading}
            >
              {loading ? "Syncing..." : "Sync Data"}
            </button>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <article className="elevated-card p-5">
            <h2 className="section-title text-[var(--brand-deep)]">
              Category Management
            </h2>

            <form className="mt-4 space-y-3" onSubmit={submitCategory}>
              <input
                className="food-input"
                placeholder="Category name"
                value={categoryForm.name}
                onChange={(event) => {
                  setCategoryForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }));
                }}
              />

              <textarea
                className="food-textarea"
                placeholder="Description"
                value={categoryForm.description}
                onChange={(event) => {
                  setCategoryForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }));
                }}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  className="food-select"
                  value={categoryForm.parentCategoryId ?? ""}
                  onChange={(event) => {
                    setCategoryForm((prev) => ({
                      ...prev,
                      parentCategoryId: event.target.value
                        ? Number(event.target.value)
                        : null,
                    }));
                  }}
                >
                  <option value="">No parent (top level)</option>
                  {categories
                    .filter((category) => category.id !== editingCategoryId)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                </select>

                <input
                  className="food-input"
                  type="number"
                  min={0}
                  value={categoryForm.sortOrder}
                  onChange={(event) => {
                    setCategoryForm((prev) => ({
                      ...prev,
                      sortOrder: Number(event.target.value || 0),
                    }));
                  }}
                  placeholder="Sort order"
                />
              </div>

              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="food-input"
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0] ?? null;
                    setCategoryImageFile(selectedFile);
                  }}
                />
                <p className="text-xs text-[#7a4d3a]">
                  {categoryImageFile
                    ? `Selected image: ${categoryImageFile.name}`
                    : categoryForm.imageUrl
                      ? "Existing category image will be kept unless you upload a new one."
                      : "Upload category image (optional)."}
                </p>
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-[#623729]">
                <input
                  type="checkbox"
                  checked={categoryForm.isActive}
                  onChange={(event) => {
                    setCategoryForm((prev) => ({
                      ...prev,
                      isActive: event.target.checked,
                    }));
                  }}
                />
                Active category
              </label>

              <div className="flex flex-wrap gap-2">
                <button type="submit" className="food-btn">
                  {editingCategoryId ? "Update Category" : "Create Category"}
                </button>
                {editingCategoryId ? (
                  <button
                    type="button"
                    className="food-btn-outline"
                    onClick={() => {
                      setEditingCategoryId(null);
                      setCategoryForm(emptyCategoryForm);
                      setCategoryImageFile(null);
                    }}
                  >
                    Cancel Edit
                  </button>
                ) : null}
              </div>
            </form>

            <div className="mt-6 space-y-3">
              {categories.length === 0 ? (
                <p className="text-sm text-[#70432e]">No categories yet.</p>
              ) : (
                categories.map((category) => (
                  <div
                    key={category.id}
                    className="rounded-xl border border-[#f2d4bb] bg-[#fff8ef] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#5b2e1e]">{category.name}</p>
                        <p className="text-xs text-[#7d4f3a]">
                          Parent: {category.parentCategoryId ?? "none"} | Sort: {" "}
                          {category.sortOrder}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="food-btn-outline"
                          onClick={() => {
                            editCategory(category);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="food-btn-outline"
                          onClick={() => {
                            removeCategory(category.id).catch(() => {
                              updateStatus("Unable to delete category.");
                            });
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="elevated-card p-5">
            <h2 className="section-title text-[var(--brand-deep)]">Item Management</h2>

            <form className="mt-4 space-y-3" onSubmit={submitItem}>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="food-input"
                  placeholder="Item name"
                  value={itemForm.name}
                  onChange={(event) => {
                    setItemForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }));
                  }}
                />

                <select
                  className="food-select"
                  value={itemForm.categoryId ?? ""}
                  onChange={(event) => {
                    setItemForm((prev) => ({
                      ...prev,
                      categoryId: event.target.value ? Number(event.target.value) : null,
                    }));
                  }}
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                className="food-textarea"
                placeholder="Item description"
                value={itemForm.description}
                onChange={(event) => {
                  setItemForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }));
                }}
              />

              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="food-input"
                  onChange={(event) => {
                    const selectedFile = event.target.files?.[0] ?? null;
                    setItemImageFile(selectedFile);
                  }}
                />
                <p className="text-xs text-[#7a4d3a]">
                  {itemImageFile
                    ? `Selected image: ${itemImageFile.name}`
                    : itemForm.imageUrl
                      ? "Existing item image will be kept unless you upload a new one."
                      : "Upload item image (optional)."}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  className="food-input"
                  type="number"
                  min={0}
                  step="0.01"
                  value={itemForm.basePrice}
                  onChange={(event) => {
                    setItemForm((prev) => ({
                      ...prev,
                      basePrice: Number(event.target.value || 0),
                    }));
                  }}
                  placeholder="Base price"
                />
                <input
                  className="food-input"
                  type="number"
                  min={0}
                  value={itemForm.stockQty}
                  onChange={(event) => {
                    setItemForm((prev) => ({
                      ...prev,
                      stockQty: Number(event.target.value || 0),
                    }));
                  }}
                  placeholder="Stock qty"
                />
                <input
                  className="food-input"
                  placeholder="SKU"
                  value={itemForm.sku}
                  onChange={(event) => {
                    setItemForm((prev) => ({
                      ...prev,
                      sku: event.target.value,
                    }));
                  }}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="food-input"
                  placeholder="Offer title"
                  value={itemForm.offerTitle}
                  onChange={(event) => {
                    setItemForm((prev) => ({
                      ...prev,
                      offerTitle: event.target.value,
                    }));
                  }}
                />
                <input
                  className="food-input"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={itemForm.offerDiscountPercent ?? ""}
                  onChange={(event) => {
                    setItemForm((prev) => ({
                      ...prev,
                      offerDiscountPercent: event.target.value
                        ? Number(event.target.value)
                        : null,
                    }));
                  }}
                  placeholder="Offer %"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="food-input"
                  type="datetime-local"
                  value={itemForm.offerStartAt}
                  onChange={(event) => {
                    setItemForm((prev) => ({
                      ...prev,
                      offerStartAt: event.target.value,
                    }));
                  }}
                />
                <input
                  className="food-input"
                  type="datetime-local"
                  value={itemForm.offerEndAt}
                  onChange={(event) => {
                    setItemForm((prev) => ({
                      ...prev,
                      offerEndAt: event.target.value,
                    }));
                  }}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="inline-flex items-center gap-2 text-sm text-[#623729]">
                  <input
                    type="checkbox"
                    checked={itemForm.isVeg}
                    onChange={(event) => {
                      setItemForm((prev) => ({
                        ...prev,
                        isVeg: event.target.checked,
                      }));
                    }}
                  />
                  Veg item
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-[#623729]">
                  <input
                    type="checkbox"
                    checked={itemForm.isAvailable}
                    onChange={(event) => {
                      setItemForm((prev) => ({
                        ...prev,
                        isAvailable: event.target.checked,
                      }));
                    }}
                  />
                  Available now
                </label>
              </div>

              <div className="rounded-xl border border-[#efccb0] bg-[#fff6eb] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#60372a]">Variants</h3>
                  <button
                    type="button"
                    className="food-btn-outline"
                    onClick={() => {
                      setItemForm((prev) => ({
                        ...prev,
                        variants: [...prev.variants, emptyVariant(prev.variants.length)],
                      }));
                    }}
                  >
                    Add Variant
                  </button>
                </div>
                <div className="space-y-2">
                  {itemForm.variants.map((variant, index) => (
                    <div key={`variant-${index}`} className="grid gap-2 sm:grid-cols-6">
                      <input
                        className="food-input sm:col-span-2"
                        placeholder="Name"
                        value={variant.name}
                        onChange={(event) => {
                          setItemForm((prev) => {
                            const next = [...prev.variants];
                            next[index] = { ...next[index], name: event.target.value };
                            return { ...prev, variants: next };
                          });
                        }}
                      />
                      <input
                        className="food-input"
                        type="number"
                        step="0.01"
                        value={variant.priceDelta}
                        onChange={(event) => {
                          setItemForm((prev) => {
                            const next = [...prev.variants];
                            next[index] = {
                              ...next[index],
                              priceDelta: Number(event.target.value || 0),
                            };
                            return { ...prev, variants: next };
                          });
                        }}
                      />
                      <input
                        className="food-input"
                        type="number"
                        value={variant.stockQty}
                        onChange={(event) => {
                          setItemForm((prev) => {
                            const next = [...prev.variants];
                            next[index] = {
                              ...next[index],
                              stockQty: Number(event.target.value || 0),
                            };
                            return { ...prev, variants: next };
                          });
                        }}
                      />
                      <label className="inline-flex items-center gap-2 text-xs text-[#613729]">
                        <input
                          type="checkbox"
                          checked={variant.isDefault}
                          onChange={(event) => {
                            setItemForm((prev) => {
                              const next = [...prev.variants];
                              next[index] = {
                                ...next[index],
                                isDefault: event.target.checked,
                              };
                              return { ...prev, variants: next };
                            });
                          }}
                        />
                        Default
                      </label>
                      <button
                        type="button"
                        className="food-btn-outline"
                        onClick={() => {
                          setItemForm((prev) => {
                            const next = prev.variants.filter((_, i) => i !== index);
                            return {
                              ...prev,
                              variants: next.length > 0 ? next : [emptyVariant(0)],
                            };
                          });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#efccb0] bg-[#fff6eb] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#60372a]">Add-ons</h3>
                  <button
                    type="button"
                    className="food-btn-outline"
                    onClick={() => {
                      setItemForm((prev) => ({
                        ...prev,
                        addons: [...prev.addons, emptyAddon(prev.addons.length)],
                      }));
                    }}
                  >
                    Add Add-on
                  </button>
                </div>
                <div className="space-y-2">
                  {itemForm.addons.map((addon, index) => (
                    <div key={`addon-${index}`} className="grid gap-2 sm:grid-cols-7">
                      <input
                        className="food-input sm:col-span-2"
                        placeholder="Name"
                        value={addon.name}
                        onChange={(event) => {
                          setItemForm((prev) => {
                            const next = [...prev.addons];
                            next[index] = { ...next[index], name: event.target.value };
                            return { ...prev, addons: next };
                          });
                        }}
                      />
                      <input
                        className="food-input"
                        type="number"
                        step="0.01"
                        value={addon.price}
                        onChange={(event) => {
                          setItemForm((prev) => {
                            const next = [...prev.addons];
                            next[index] = {
                              ...next[index],
                              price: Number(event.target.value || 0),
                            };
                            return { ...prev, addons: next };
                          });
                        }}
                      />
                      <input
                        className="food-input"
                        type="number"
                        min={1}
                        value={addon.maxSelect}
                        onChange={(event) => {
                          setItemForm((prev) => {
                            const next = [...prev.addons];
                            next[index] = {
                              ...next[index],
                              maxSelect: Number(event.target.value || 1),
                            };
                            return { ...prev, addons: next };
                          });
                        }}
                      />
                      <label className="inline-flex items-center gap-2 text-xs text-[#613729]">
                        <input
                          type="checkbox"
                          checked={addon.isRequired}
                          onChange={(event) => {
                            setItemForm((prev) => {
                              const next = [...prev.addons];
                              next[index] = {
                                ...next[index],
                                isRequired: event.target.checked,
                              };
                              return { ...prev, addons: next };
                            });
                          }}
                        />
                        Required
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs text-[#613729]">
                        <input
                          type="checkbox"
                          checked={addon.isAvailable}
                          onChange={(event) => {
                            setItemForm((prev) => {
                              const next = [...prev.addons];
                              next[index] = {
                                ...next[index],
                                isAvailable: event.target.checked,
                              };
                              return { ...prev, addons: next };
                            });
                          }}
                        />
                        Active
                      </label>
                      <button
                        type="button"
                        className="food-btn-outline"
                        onClick={() => {
                          setItemForm((prev) => {
                            const next = prev.addons.filter((_, i) => i !== index);
                            return {
                              ...prev,
                              addons: next.length > 0 ? next : [emptyAddon(0)],
                            };
                          });
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="submit" className="food-btn">
                  {editingItemId ? "Update Item" : "Create Item"}
                </button>
                {editingItemId ? (
                  <button
                    type="button"
                    className="food-btn-outline"
                    onClick={() => {
                      setEditingItemId(null);
                      setItemForm(emptyItemForm(categories[0]?.id ?? null));
                      setItemImageFile(null);
                    }}
                  >
                    Cancel Edit
                  </button>
                ) : null}
              </div>
            </form>

            <div className="mt-6 space-y-3">
              {items.length === 0 ? (
                <p className="text-sm text-[#70432e]">No items yet.</p>
              ) : (
                items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#f2d4bb] bg-[#fff8ef] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#5b2e1e]">{item.name}</p>
                        <p className="text-xs text-[#7d4f3a]">
                          Category: {item.categoryName} | Price: {item.basePrice} | Stock:{" "}
                          {item.stockQty}
                        </p>
                        <p className="text-xs text-[#7d4f3a]">
                          Variants: {item.variants.length} | Add-ons: {item.addons.length}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="food-btn-outline"
                          onClick={() => {
                            editItem(item);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="food-btn-outline"
                          onClick={() => {
                            removeItem(item.id).catch(() => {
                              updateStatus("Unable to delete item.");
                            });
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

export default function RestroDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="soft-grid-bg flex flex-1 items-center justify-center px-6">
          <div className="glass-panel w-full max-w-xl p-6 text-center">
            <p className="brand-badge">Restro Dashboard</p>
            <p className="mt-3 text-sm text-[#6b4131]">Loading dashboard...</p>
          </div>
        </div>
      }
    >
      <RestroDashboardContent />
    </Suspense>
  );
}
