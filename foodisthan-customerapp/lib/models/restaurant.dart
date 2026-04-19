class Restaurant {
  final int id;
  final String name;
  final String slug;
  final String? imageUrl;
  final String? city;
  final bool isOpen;

  Restaurant({
    required this.id,
    required this.name,
    required this.slug,
    this.imageUrl,
    this.city,
    required this.isOpen,
  });

  factory Restaurant.fromJson(Map<String, dynamic> json) {
    return Restaurant(
      id: json['id'] as int,
      name: json['name'] as String,
      slug: json['slug'] as String,
      imageUrl: json['imageUrl'] as String?,
      city: json['city'] as String?,
      isOpen: json['isOpen'] == true,
    );
  }
}

class Category {
  final int id;
  final int restaurantId;
  final String name;
  final String? description;
  final String? imageUrl;
  final int sortOrder;
  final bool isActive;
  final List<MenuItem> items;

  Category({
    required this.id,
    required this.restaurantId,
    required this.name,
    this.description,
    this.imageUrl,
    required this.sortOrder,
    required this.isActive,
    required this.items,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id'] as int,
      restaurantId: json['restaurantId'] as int,
      name: json['name'] as String,
      description: json['description'] as String?,
      imageUrl: json['imageUrl'] as String?,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
      isActive: json['isActive'] == true,
      items: (json['items'] as List?)
              ?.map((e) => MenuItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class MenuItem {
  final int id;
  final int restaurantId;
  final int categoryId;
  final String categoryName;
  final String name;
  final String? description;
  final String? imageUrl;
  final double basePrice;
  final int stockQty;
  final bool isVeg;
  final bool isAvailable;
  final String? offerTitle;
  final double? offerDiscountPercent;
  final List<ItemVariant> variants;
  final List<ItemAddon> addons;

  MenuItem({
    required this.id,
    required this.restaurantId,
    required this.categoryId,
    required this.categoryName,
    required this.name,
    this.description,
    this.imageUrl,
    required this.basePrice,
    required this.stockQty,
    required this.isVeg,
    required this.isAvailable,
    this.offerTitle,
    this.offerDiscountPercent,
    required this.variants,
    required this.addons,
  });

  double get effectivePrice {
    if (offerDiscountPercent != null && offerDiscountPercent! > 0) {
      return basePrice * (1 - offerDiscountPercent! / 100);
    }
    return basePrice;
  }

  factory MenuItem.fromJson(Map<String, dynamic> json) {
    return MenuItem(
      id: json['id'] as int,
      restaurantId: json['restaurantId'] as int,
      categoryId: json['categoryId'] as int,
      categoryName: (json['categoryName'] as String?) ?? '',
      name: json['name'] as String,
      description: json['description'] as String?,
      imageUrl: json['imageUrl'] as String?,
      basePrice: (json['basePrice'] as num).toDouble(),
      stockQty: (json['stockQty'] as num?)?.toInt() ?? 0,
      isVeg: json['isVeg'] == true,
      isAvailable: json['isAvailable'] == true,
      offerTitle: json['offerTitle'] as String?,
      offerDiscountPercent:
          (json['offerDiscountPercent'] as num?)?.toDouble(),
      variants: (json['variants'] as List?)
              ?.map((e) => ItemVariant.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      addons: (json['addons'] as List?)
              ?.map((e) => ItemAddon.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class ItemVariant {
  final int id;
  final int itemId;
  final String name;
  final double priceDelta;
  final bool isDefault;

  ItemVariant({
    required this.id,
    required this.itemId,
    required this.name,
    required this.priceDelta,
    required this.isDefault,
  });

  factory ItemVariant.fromJson(Map<String, dynamic> json) {
    return ItemVariant(
      id: json['id'] as int,
      itemId: json['itemId'] as int,
      name: json['name'] as String,
      priceDelta: (json['priceDelta'] as num).toDouble(),
      isDefault: json['isDefault'] == true,
    );
  }
}

class ItemAddon {
  final int id;
  final int itemId;
  final String name;
  final double price;
  final int maxSelect;
  final bool isRequired;
  final bool isAvailable;

  ItemAddon({
    required this.id,
    required this.itemId,
    required this.name,
    required this.price,
    required this.maxSelect,
    required this.isRequired,
    required this.isAvailable,
  });

  factory ItemAddon.fromJson(Map<String, dynamic> json) {
    return ItemAddon(
      id: json['id'] as int,
      itemId: json['itemId'] as int,
      name: json['name'] as String,
      price: (json['price'] as num).toDouble(),
      maxSelect: (json['maxSelect'] as num?)?.toInt() ?? 1,
      isRequired: json['isRequired'] == true,
      isAvailable: json['isAvailable'] == true,
    );
  }
}
