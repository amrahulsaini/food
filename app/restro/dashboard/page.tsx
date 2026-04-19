"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";

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

function ThreeDotSpinner({ className = "" }: { className?: string }) {
  return (
    <span className={`dot-spinner ${className}`} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function SidebarIcon({
  name,
}: {
  name: "home" | "categories" | "items" | "preview" | "sync" | "login";
}) {
  if (name === "home") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V20h14V9.5" />
      </svg>
    );
  }

  if (name === "categories") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="7" height="7" rx="1.5" />
        <rect x="14" y="4" width="7" height="7" rx="1.5" />
        <rect x="3" y="13" width="7" height="7" rx="1.5" />
        <rect x="14" y="13" width="7" height="7" rx="1.5" />
      </svg>
    );
  }

  if (name === "items") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 4h12l1.5 4H4.5L6 4Z" />
        <path d="M5 8h14v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8Z" />
        <path d="M9 12h6" />
      </svg>
    );
  }

  if (name === "preview") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }

  if (name === "sync") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M20 6v5h-5" />
        <path d="M4 18v-5h5" />
        <path d="M18.5 11A6.5 6.5 0 0 0 7 7.5" />
        <path d="M5.5 13A6.5 6.5 0 0 0 17 16.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5h16v14H4z" />
      <path d="m9 10 3 3 3-3" />
    </svg>
  );
}

function RestroDashboardContent() {
  const searchParams = useSearchParams();
  const initialRestaurantSlug =
    searchParams.get("slug")?.trim().toLowerCase() ?? "";
  const ownerName = searchParams.get("owner")?.trim() || "Manager";
  const toastTimerRef = useRef<number | null>(null);
  const autoSyncDoneRef = useRef(false);
  const categoryUploadRequestRef = useRef(0);
  const itemUploadRequestRef = useRef(0);
  const itemImageInputRef = useRef<HTMLInputElement | null>(null);

  const [restaurantSlugInput] = useState(initialRestaurantSlug);
  const [restaurantId, setRestaurantId] = useState<number | null>(null);
  const [status, setStatus] = useState("Enter restaurant slug and click Sync Data.");
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<"categories" | "items">(
    "categories"
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm);
  const [categoryImageFile, setCategoryImageFile] = useState<File | null>(null);
  const [categoryUploadProgress, setCategoryUploadProgress] = useState(0);
  const [isCategoryImageUploading, setIsCategoryImageUploading] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);

  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm(null));
  const [itemImageFile, setItemImageFile] = useState<File | null>(null);
  const [itemUploadProgress, setItemUploadProgress] = useState(0);
  const [isItemImageUploading, setIsItemImageUploading] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  function clearItemImageSelection(): void {
    itemUploadRequestRef.current += 1;
    setItemImageFile(null);
    setItemUploadProgress(0);
    setIsItemImageUploading(false);

    if (itemImageInputRef.current) {
      itemImageInputRef.current.value = "";
    }
  }

  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? null;

  const visibleItems = selectedCategoryId
    ? items.filter((item) => item.categoryId === selectedCategoryId)
    : [];

  const itemCountByCategory = items.reduce<Record<number, number>>((acc, item) => {
    acc[item.categoryId] = (acc[item.categoryId] ?? 0) + 1;
    return acc;
  }, {});

  useEffect(() => {
    if (categories.length === 0) {
      setSelectedCategoryId(null);
      return;
    }

    setSelectedCategoryId((current) => {
      if (current && categories.some((category) => category.id === current)) {
        return current;
      }

      return categories[0].id;
    });
  }, [categories]);

  useEffect(() => {
    if (editingItemId !== null) {
      return;
    }

    setItemForm((prev) => {
      if (prev.categoryId === selectedCategoryId) {
        return prev;
      }

      return {
        ...prev,
        categoryId: selectedCategoryId,
      };
    });
  }, [selectedCategoryId, editingItemId]);

  useEffect(() => {
    if (autoSyncDoneRef.current) {
      return;
    }

    if (!/^[a-z0-9]{6,8}$/.test(restaurantSlugInput)) {
      updateStatus("Restaurant slug missing. Open dashboard through approved login.");
      return;
    }

    autoSyncDoneRef.current = true;
    refreshData().catch(() => {
      updateStatus("Unable to sync dashboard.");
    });
  }, [restaurantSlugInput]);

  function scrollToSection(section: "categories" | "items"): void {
    setActiveSection(section);
  }

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

  async function uploadImageForCurrentSlug(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    const normalizedSlug = restaurantSlugInput.trim().toLowerCase();

    if (!/^[a-z0-9]{6,8}$/.test(normalizedSlug)) {
      throw new Error("Sync with a valid restaurant slug before uploading images.");
    }

    return await new Promise<string>((resolve, reject) => {
      const formData = new FormData();
      formData.append("slug", normalizedSlug);
      formData.append("file", file);

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
          payload = JSON.parse(xhr.responseText) as { imageUrl?: string; message?: string };
        } catch {
          payload = {};
        }

        if (xhr.status >= 200 && xhr.status < 300 && payload.imageUrl) {
          resolve(payload.imageUrl);
          return;
        }

        reject(new Error(payload.message ?? `Image upload failed with status ${xhr.status}.`));
      };

      xhr.send(formData);
    });
  }

  async function handleCategoryImageChange(file: File | null): Promise<void> {
    setCategoryImageFile(file);
    setCategoryUploadProgress(0);

    if (!file) {
      return;
    }

    const uploadId = categoryUploadRequestRef.current + 1;
    categoryUploadRequestRef.current = uploadId;
    setIsCategoryImageUploading(true);
    updateStatus("Uploading category image...");

    try {
      const imageUrl = await uploadImageForCurrentSlug(file, setCategoryUploadProgress);

      if (uploadId !== categoryUploadRequestRef.current) {
        return;
      }

      setCategoryUploadProgress(100);
      setCategoryForm((prev) => ({
        ...prev,
        imageUrl,
      }));
      updateStatus("Category image uploaded.");
    } catch (error) {
      if (uploadId !== categoryUploadRequestRef.current) {
        return;
      }

      setCategoryImageFile(null);
      setCategoryUploadProgress(0);
      updateStatus(error instanceof Error ? error.message : "Category image upload failed.");
    } finally {
      if (uploadId === categoryUploadRequestRef.current) {
        setIsCategoryImageUploading(false);
      }
    }
  }

  async function handleItemImageChange(file: File | null): Promise<void> {
    setItemImageFile(file);
    setItemUploadProgress(0);

    if (!file) {
      return;
    }

    const uploadId = itemUploadRequestRef.current + 1;
    itemUploadRequestRef.current = uploadId;
    setIsItemImageUploading(true);
    updateStatus("Uploading item image...");

    try {
      const imageUrl = await uploadImageForCurrentSlug(file, setItemUploadProgress);

      if (uploadId !== itemUploadRequestRef.current) {
        return;
      }

      setItemUploadProgress(100);
      setItemForm((prev) => ({
        ...prev,
        imageUrl,
      }));
      updateStatus("Item image uploaded.");
    } catch (error) {
      if (uploadId !== itemUploadRequestRef.current) {
        return;
      }

      setItemImageFile(null);
      setItemUploadProgress(0);
      updateStatus(error instanceof Error ? error.message : "Item image upload failed.");
    } finally {
      if (uploadId === itemUploadRequestRef.current) {
        setIsItemImageUploading(false);
      }
    }
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!restaurantId) {
      updateStatus("Sync data with a valid restaurant slug before saving category.");
      return;
    }

    if (isCategoryImageUploading) {
      updateStatus("Wait for category image upload to finish.");
      return;
    }

    try {
      setIsSavingCategory(true);

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
          imageUrl: categoryForm.imageUrl,
          parentCategoryId: categoryForm.parentCategoryId,
        }),
      });

      if (!response.ok) {
        throw new Error(await readMessage(response));
      }

      const payload = (await response.json()) as { category?: Category };
      const savedCategory = payload.category;

      if (!savedCategory) {
        throw new Error("Category save response is invalid.");
      }

      setCategories((prev) => {
        const withoutCurrent = prev.filter((category) => category.id !== savedCategory.id);
        const merged = [...withoutCurrent, savedCategory];

        return merged.sort((left, right) => {
          if (left.sortOrder !== right.sortOrder) {
            return left.sortOrder - right.sortOrder;
          }

          return left.id - right.id;
        });
      });

      setItemForm((prev) => {
        if (prev.categoryId) {
          return prev;
        }

        return {
          ...prev,
          categoryId: savedCategory.id,
        };
      });
      setSelectedCategoryId((current) => current ?? savedCategory.id);

      setCategoryForm(emptyCategoryForm);
      setCategoryImageFile(null);
      setCategoryUploadProgress(0);
      setEditingCategoryId(null);
      updateStatus(editingCategoryId ? "Category updated." : "Category created.");
    } catch (error) {
      updateStatus(error instanceof Error ? error.message : "Unable to save category.");
    } finally {
      setIsSavingCategory(false);
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
      setDeletingCategoryId(categoryId);

      const response = await fetch(
        `/api/restro/categories/${categoryId}?restaurantId=${restaurantId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(await readMessage(response));
      }

      setCategories((prev) => prev.filter((category) => category.id !== categoryId));
      setItemForm((prev) => {
        if (prev.categoryId !== categoryId) {
          return prev;
        }

        return {
          ...prev,
          categoryId: null,
        };
      });
      updateStatus("Category deleted.");
    } catch (error) {
      updateStatus(error instanceof Error ? error.message : "Unable to delete category.");
    } finally {
      setDeletingCategoryId(null);
    }
  }

  function editCategory(category: Category): void {
    categoryUploadRequestRef.current += 1;
    setActiveSection("categories");
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
    setCategoryUploadProgress(0);
    setIsCategoryImageUploading(false);
  }

  async function submitItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!restaurantId) {
      updateStatus("Sync data with a valid restaurant slug before saving item.");
      return;
    }

    const resolvedCategoryId = itemForm.categoryId ?? selectedCategoryId;

    if (!resolvedCategoryId) {
      updateStatus("Choose a category for the item.");
      return;
    }

    if (isItemImageUploading) {
      updateStatus("Wait for item image upload to finish.");
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

    const selectedCategoryName = categories.find(
      (category) => category.id === resolvedCategoryId
    )?.name;
    const existingEditingItem = editingItemId
      ? items.find((item) => item.id === editingItemId)
      : null;
    const shouldSkipVariantAddonSync =
      editingItemId !== null &&
      cleanedVariants.length === 0 &&
      cleanedAddons.length === 0 &&
      (existingEditingItem?.variants.length ?? 0) === 0 &&
      (existingEditingItem?.addons.length ?? 0) === 0;

    try {
      setIsSavingItem(true);

      const endpoint = editingItemId ? `/api/restro/items/${editingItemId}` : "/api/restro/items";
      const method = editingItemId ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurantId,
          categoryId: resolvedCategoryId,
          categoryName: selectedCategoryName ?? null,
          skipVariantAddonSync: shouldSkipVariantAddonSync,
          name: itemForm.name,
          description: itemForm.description,
          imageUrl: itemForm.imageUrl,
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

      const payload = (await response.json()) as { item?: Item };
      const savedItem = payload.item;

      if (!savedItem) {
        throw new Error("Item save response is invalid.");
      }

      const normalizedItem: Item = {
        ...savedItem,
        categoryName:
          savedItem.categoryName?.trim() ||
          categories.find((category) => category.id === savedItem.categoryId)?.name ||
          "Category",
      };

      setItems((prev) => {
        const withoutCurrent = prev.filter((item) => item.id !== normalizedItem.id);
        return [normalizedItem, ...withoutCurrent];
      });

      setEditingItemId(null);
      clearItemImageSelection();
      setItemForm(emptyItemForm(selectedCategoryId));
      updateStatus(editingItemId ? "Item updated." : "Item created.");
    } catch (error) {
      updateStatus(error instanceof Error ? error.message : "Unable to save item.");
    } finally {
      setIsSavingItem(false);
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
      setDeletingItemId(itemId);

      const response = await fetch(
        `/api/restro/items/${itemId}?restaurantId=${restaurantId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(await readMessage(response));
      }

      setItems((prev) => prev.filter((item) => item.id !== itemId));
      updateStatus("Item deleted.");
    } catch (error) {
      updateStatus(error instanceof Error ? error.message : "Unable to delete item.");
    } finally {
      setDeletingItemId(null);
    }
  }

  function editItem(item: Item): void {
    clearItemImageSelection();
    setActiveSection("items");
    setSelectedCategoryId(item.categoryId);
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

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="soft-grid-bg flex flex-1">
      {toast ? (
        <div className="toast-success fixed right-4 top-4 z-40 max-w-md px-4 py-3 text-sm font-semibold text-[#124f2d] shadow-lg">
          {toast}
        </div>
      ) : null}

      <main className="flex w-full flex-1 flex-col gap-6 pb-10 pt-6">
        <section className="dashboard-shell grid gap-5 xl:grid-cols-[280px_1fr]">
          <aside className="dashboard-side-menu elevated-card p-4">
            <p className="brand-badge">Navigation</p>
            <div className="sidebar-owner mt-3">
              <p className="sidebar-owner-name">{ownerName}</p>
              <p className="sidebar-owner-slug">Slug: {restaurantSlugInput}</p>
            </div>

            <div className="sidebar-menu-list mt-4">
              <button
                type="button"
                className={`dashboard-nav-btn ${
                  activeSection === "categories" ? "dashboard-nav-btn-active" : ""
                }`}
                onClick={() => {
                  scrollToSection("categories");
                }}
              >
                <span className="sidebar-menu-left">
                  <SidebarIcon name="categories" />
                  Categories
                </span>
                <span className="status-pill">{categories.length}</span>
              </button>

              <button
                type="button"
                className={`dashboard-nav-btn ${
                  activeSection === "items" ? "dashboard-nav-btn-active" : ""
                }`}
                onClick={() => {
                  scrollToSection("items");
                }}
              >
                <span className="sidebar-menu-left">
                  <SidebarIcon name="items" />
                  Items
                </span>
                <span className="status-pill">{items.length}</span>
              </button>

              <Link href="/customer" className="dashboard-nav-btn">
                <span className="sidebar-menu-left">
                  <SidebarIcon name="preview" />
                  Customer Preview
                </span>
              </Link>
            </div>

            <div className="sidebar-divider" />

            <div className="menu-sidebar-panel mt-3">
              <p className="menu-sidebar-title">Categories</p>

              {categories.length === 0 ? (
                <p className="mt-2 text-xs text-[#6c4633]">
                  Create categories first, then select one to manage items.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {categories.map((category) => {
                    const isSelected = selectedCategoryId === category.id;

                    return (
                      <button
                        type="button"
                        key={category.id}
                        className={`menu-category-btn ${
                          isSelected ? "menu-category-btn-active" : ""
                        }`}
                        onClick={() => {
                          setSelectedCategoryId(category.id);
                          scrollToSection("items");
                        }}
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          {category.imageUrl ? (
                            <img
                              src={category.imageUrl}
                              alt={category.name}
                              loading="lazy"
                              className="h-8 w-8 rounded-md border border-[#ead3bd] object-cover"
                            />
                          ) : (
                            <span className="h-8 w-8 rounded-md border border-dashed border-[#d8bda6] bg-[#fff2e4]" />
                          )}
                          <span className="truncate text-left text-sm font-semibold text-[#522819]">
                            {category.name}
                          </span>
                        </span>
                        <span className="status-pill">{itemCountByCategory[category.id] ?? 0}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="sidebar-divider" />

            <div className="sidebar-utility-list mt-3">
              <button
                type="button"
                className="dashboard-nav-btn"
                onClick={() => {
                  refreshData().catch(() => {
                    updateStatus("Unable to sync dashboard.");
                  });
                }}
                disabled={loading}
              >
                <span className="sidebar-menu-left">
                  {loading ? <ThreeDotSpinner /> : <SidebarIcon name="sync" />}
                  {loading ? "Refreshing" : "Refresh"}
                </span>
              </button>

              <Link href="/restro/login" className="dashboard-nav-btn">
                <span className="sidebar-menu-left">
                  <SidebarIcon name="login" />
                  Back to Login
                </span>
              </Link>
            </div>

            <div className="sidebar-status mt-3">
              <p className="sidebar-status-title">Status</p>
              <p className="sidebar-status-text">{status}</p>
            </div>
          </aside>

          <div className="grid gap-5 px-4 md:px-6 xl:pl-6 xl:pr-8">
            <article
              className={`elevated-card p-5 ${
                activeSection === "categories" ? "block" : "hidden"
              }`}
            >
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
                    handleCategoryImageChange(selectedFile).catch(() => {
                      updateStatus("Category image upload failed.");
                    });
                  }}
                />

                <div className="rounded-lg bg-[#f3eadf] p-2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#e5d5c0]">
                    <div
                      className="h-full rounded-full bg-[var(--brand)] transition-all duration-200"
                      style={{
                        width: `${Math.min(100, Math.max(0, categoryUploadProgress))}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[#5d3a2e]">
                    {isCategoryImageUploading
                      ? `Uploading category image... ${categoryUploadProgress}%`
                      : categoryForm.imageUrl
                        ? "Category image uploaded and ready."
                        : "Choose image to auto-upload (optional)."}
                  </p>
                </div>

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
                <button
                  type="submit"
                  className="food-btn"
                  disabled={isCategoryImageUploading || isSavingCategory}
                >
                  {isSavingCategory ? (
                    <span className="inline-flex items-center gap-2">
                      <ThreeDotSpinner />
                      Saving
                    </span>
                  ) : editingCategoryId ? (
                    "Update Category"
                  ) : (
                    "Create Category"
                  )}
                </button>
                {editingCategoryId ? (
                  <button
                    type="button"
                    className="food-btn-outline"
                    onClick={() => {
                      categoryUploadRequestRef.current += 1;
                      setEditingCategoryId(null);
                      setCategoryForm(emptyCategoryForm);
                      setCategoryImageFile(null);
                      setCategoryUploadProgress(0);
                      setIsCategoryImageUploading(false);
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
                      <div className="flex min-w-0 items-start gap-3">
                        {category.imageUrl ? (
                          <img
                            src={category.imageUrl}
                            alt={category.name}
                            loading="lazy"
                            className="h-12 w-12 shrink-0 rounded-lg border border-[#edd7c4] object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 shrink-0 rounded-lg border border-dashed border-[#ddc2ab] bg-[#fff0df]" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#5b2e1e]">{category.name}</p>
                          <p className="text-xs text-[#7d4f3a]">
                            Parent: {category.parentCategoryId ?? "none"} | Sort: {" "}
                            {category.sortOrder}
                          </p>
                        </div>
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
                          disabled={deletingCategoryId === category.id}
                          onClick={() => {
                            removeCategory(category.id).catch(() => {
                              updateStatus("Unable to delete category.");
                            });
                          }}
                        >
                          {deletingCategoryId === category.id ? (
                            <span className="inline-flex items-center gap-2">
                              <ThreeDotSpinner />
                              Deleting
                            </span>
                          ) : (
                            "Delete"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>

          <article
            className={`elevated-card p-5 ${
              activeSection === "items" ? "block" : "hidden"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="section-title text-[var(--brand-deep)]">Item Management</h2>
                <p className="mt-1 text-sm text-[#6a3f2c]">
                  Items are scoped to the category selected in the menu sidebar.
                </p>
              </div>
              <span className="status-pill">
                {selectedCategory
                  ? `${visibleItems.length} items`
                  : `${items.length} total items`}
              </span>
            </div>

            {selectedCategory ? (
              <>
                <div className="menu-selected-category mt-4">
                  <div className="flex items-center gap-3">
                    {selectedCategory.imageUrl ? (
                      <img
                        src={selectedCategory.imageUrl}
                        alt={selectedCategory.name}
                        loading="lazy"
                        className="h-12 w-12 rounded-lg border border-[#ead3bd] object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg border border-dashed border-[#d8bda6] bg-[#fff2e4]" />
                    )}
                    <div>
                      <p className="menu-selected-label">Selected Category</p>
                      <p className="menu-selected-value">{selectedCategory.name}</p>
                    </div>
                  </div>
                  <p className="text-xs text-[#6d4533]">
                    Add and manage only items that belong to this category.
                  </p>
                </div>

                <form className="mt-4 space-y-3" onSubmit={submitItem}>
                  <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
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

                    <div className="menu-category-locked">
                      <p className="menu-selected-label">Linked To</p>
                      <p className="menu-selected-value">{selectedCategory.name}</p>
                    </div>
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
                      ref={itemImageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="food-input"
                      onChange={(event) => {
                        const selectedFile = event.target.files?.[0] ?? null;
                        handleItemImageChange(selectedFile).catch(() => {
                          updateStatus("Item image upload failed.");
                        });
                      }}
                    />

                    <div className="rounded-lg bg-[#f3eadf] p-2">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[#e5d5c0]">
                        <div
                          className="h-full rounded-full bg-[var(--brand)] transition-all duration-200"
                          style={{
                            width: `${Math.min(100, Math.max(0, itemUploadProgress))}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-[#5d3a2e]">
                        {isItemImageUploading
                          ? `Uploading item image... ${itemUploadProgress}%`
                          : itemForm.imageUrl
                            ? "Item image uploaded and ready."
                            : "Choose image to auto-upload (optional)."}
                      </p>
                    </div>

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
                    <button
                      type="submit"
                      className="food-btn"
                      disabled={isItemImageUploading || isSavingItem}
                    >
                      {isSavingItem ? (
                        <span className="inline-flex items-center gap-2">
                          <ThreeDotSpinner />
                          Saving
                        </span>
                      ) : editingItemId ? (
                        "Update Item"
                      ) : (
                        "Create Item"
                      )}
                    </button>
                    {editingItemId ? (
                      <button
                        type="button"
                        className="food-btn-outline"
                        onClick={() => {
                          setEditingItemId(null);
                          clearItemImageSelection();
                          setItemForm(emptyItemForm(selectedCategoryId));
                        }}
                      >
                        Cancel Edit
                      </button>
                    ) : null}
                  </div>
                </form>

                <div className="mt-6 space-y-3">
                  {visibleItems.length === 0 ? (
                    <p className="text-sm text-[#70432e]">
                      No items yet in {selectedCategory.name}. Create your first one.
                    </p>
                  ) : (
                    visibleItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-[#f2d4bb] bg-[#fff8ef] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                loading="lazy"
                                className="h-14 w-14 shrink-0 rounded-lg border border-[#edd7c4] object-cover"
                              />
                            ) : (
                              <div className="h-14 w-14 shrink-0 rounded-lg border border-dashed border-[#ddc2ab] bg-[#fff0df]" />
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-[#5b2e1e]">{item.name}</p>
                              <p className="text-xs text-[#7d4f3a]">
                                Category: {item.categoryName} | Price: {item.basePrice} | Stock:{" "}
                                {item.stockQty}
                              </p>
                              <p className="text-xs text-[#7d4f3a]">
                                Variants: {item.variants.length} | Add-ons: {item.addons.length}
                              </p>
                            </div>
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
                              disabled={deletingItemId === item.id}
                              onClick={() => {
                                removeItem(item.id).catch(() => {
                                  updateStatus("Unable to delete item.");
                                });
                              }}
                            >
                              {deletingItemId === item.id ? (
                                <span className="inline-flex items-center gap-2">
                                  <ThreeDotSpinner />
                                  Deleting
                                </span>
                              ) : (
                                "Delete"
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="menu-empty-state mt-4">
                <p className="text-sm font-semibold text-[#512818]">
                  Select a category from the menu sidebar to open the item form.
                </p>
                <button
                  type="button"
                  className="food-btn-outline mt-3"
                  onClick={() => {
                    scrollToSection("categories");
                  }}
                >
                  Manage Categories
                </button>
              </div>
            )}
          </article>
          </div>
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
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-[#6b4131]">
              <ThreeDotSpinner />
              Loading dashboard...
            </p>
          </div>
        </div>
      }
    >
      <RestroDashboardContent />
    </Suspense>
  );
}
