import 'package:flutter/material.dart';
import '../models/restaurant.dart';

class CartItem {
  final MenuItem menuItem;
  final ItemVariant? selectedVariant;
  final List<ItemAddon> selectedAddons;
  int quantity;

  CartItem({
    required this.menuItem,
    this.selectedVariant,
    this.selectedAddons = const [],
    this.quantity = 1,
  });

  double get unitPrice {
    double price = menuItem.effectivePrice;
    if (selectedVariant != null) {
      price += selectedVariant!.priceDelta;
    }
    for (final addon in selectedAddons) {
      price += addon.price;
    }
    return price;
  }

  double get totalPrice => unitPrice * quantity;
}

class CartProvider extends ChangeNotifier {
  final Map<String, CartItem> _items = {};

  Map<String, CartItem> get items => Map.unmodifiable(_items);
  int get itemCount => _items.values.fold(0, (sum, item) => sum + item.quantity);
  double get totalAmount => _items.values.fold(0.0, (sum, item) => sum + item.totalPrice);
  bool get isEmpty => _items.isEmpty;

  String _cartKey(MenuItem item, ItemVariant? variant, List<ItemAddon> addons) {
    final addonIds = addons.map((a) => a.id).toList()..sort();
    return '${item.id}_${variant?.id ?? 0}_${addonIds.join(',')}';
  }

  void addItem(MenuItem item, {ItemVariant? variant, List<ItemAddon> addons = const []}) {
    final key = _cartKey(item, variant, addons);
    if (_items.containsKey(key)) {
      _items[key]!.quantity++;
    } else {
      _items[key] = CartItem(
        menuItem: item,
        selectedVariant: variant,
        selectedAddons: addons,
      );
    }
    notifyListeners();
  }

  void removeItem(String key) {
    _items.remove(key);
    notifyListeners();
  }

  void updateQuantity(String key, int quantity) {
    if (_items.containsKey(key)) {
      if (quantity <= 0) {
        _items.remove(key);
      } else {
        _items[key]!.quantity = quantity;
      }
      notifyListeners();
    }
  }

  void clear() {
    _items.clear();
    notifyListeners();
  }

  int getItemQuantity(int menuItemId) {
    return _items.values
        .where((ci) => ci.menuItem.id == menuItemId)
        .fold(0, (sum, ci) => sum + ci.quantity);
  }
}
