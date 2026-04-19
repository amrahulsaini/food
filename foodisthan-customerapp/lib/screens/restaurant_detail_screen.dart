import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../config/theme.dart';
import '../models/restaurant.dart';
import '../models/cart.dart';
import '../services/api_service.dart';
import 'cart_screen.dart';

class RestaurantDetailScreen extends StatefulWidget {
  final Restaurant restaurant;
  final CartProvider cart;

  const RestaurantDetailScreen({
    super.key,
    required this.restaurant,
    required this.cart,
  });

  @override
  State<RestaurantDetailScreen> createState() => _RestaurantDetailScreenState();
}

class _RestaurantDetailScreenState extends State<RestaurantDetailScreen> {
  List<Category> _categories = [];
  bool _isLoading = true;
  bool _vegOnly = false;
  String _sortBy = 'default'; // default, price_low, price_high
  double? _maxPriceFilter;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _loadMenu();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadMenu() async {
    final result = await ApiService.getRestaurantMenu(widget.restaurant.id);
    if (!mounted) return;
    setState(() {
      _categories = result.categories;
      _isLoading = false;
    });
  }

  List<MenuItem> _getFilteredItems(List<MenuItem> items) {
    var filtered = items.toList();
    if (_vegOnly) {
      filtered = filtered.where((i) => i.isVeg).toList();
    }
    if (_maxPriceFilter != null) {
      filtered = filtered.where((i) => i.basePrice <= _maxPriceFilter!).toList();
    }
    switch (_sortBy) {
      case 'price_low':
        filtered.sort((a, b) => a.basePrice.compareTo(b.basePrice));
        break;
      case 'price_high':
        filtered.sort((a, b) => b.basePrice.compareTo(a.basePrice));
        break;
    }
    return filtered;
  }

  void _showFilterSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            return Container(
              decoration: const BoxDecoration(
                color: AppTheme.surface,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        color: AppTheme.divider,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const Text(
                    'Filters & Sort',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 20),
                  // Veg only toggle
                  SwitchListTile(
                    title: const Text('Veg Only', style: TextStyle(fontWeight: FontWeight.w600)),
                    secondary: const Icon(Icons.eco, color: AppTheme.vegGreen),
                    value: _vegOnly,
                    activeThumbColor: AppTheme.vegGreen,
                    contentPadding: EdgeInsets.zero,
                    onChanged: (val) {
                      setSheetState(() => _vegOnly = val);
                      setState(() {});
                    },
                  ),
                  const Divider(height: 24),
                  // Sort options
                  const Text(
                    'Sort by',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: [
                      ChoiceChip(
                        label: const Text('Relevance'),
                        selected: _sortBy == 'default',
                        selectedColor: AppTheme.primary.withValues(alpha: 0.15),
                        labelStyle: TextStyle(
                          color: _sortBy == 'default' ? AppTheme.primary : AppTheme.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                        onSelected: (_) {
                          setSheetState(() => _sortBy = 'default');
                          setState(() {});
                        },
                      ),
                      ChoiceChip(
                        label: const Text('Price: Low → High'),
                        selected: _sortBy == 'price_low',
                        selectedColor: AppTheme.primary.withValues(alpha: 0.15),
                        labelStyle: TextStyle(
                          color: _sortBy == 'price_low' ? AppTheme.primary : AppTheme.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                        onSelected: (_) {
                          setSheetState(() => _sortBy = 'price_low');
                          setState(() {});
                        },
                      ),
                      ChoiceChip(
                        label: const Text('Price: High → Low'),
                        selected: _sortBy == 'price_high',
                        selectedColor: AppTheme.primary.withValues(alpha: 0.15),
                        labelStyle: TextStyle(
                          color: _sortBy == 'price_high' ? AppTheme.primary : AppTheme.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                        onSelected: (_) {
                          setSheetState(() => _sortBy = 'price_high');
                          setState(() {});
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  // Max price filter
                  const Text(
                    'Max Price',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: [null, 100.0, 200.0, 300.0, 500.0].map((price) {
                      final isSelected = _maxPriceFilter == price;
                      return ChoiceChip(
                        label: Text(price == null ? 'Any' : '≤ ₹${price.toInt()}'),
                        selected: isSelected,
                        selectedColor: AppTheme.primary.withValues(alpha: 0.15),
                        labelStyle: TextStyle(
                          color: isSelected ? AppTheme.primary : AppTheme.textSecondary,
                          fontWeight: FontWeight.w600,
                        ),
                        onSelected: (_) {
                          setSheetState(() => _maxPriceFilter = price);
                          setState(() {});
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(ctx),
                      child: const Text('Apply Filters'),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomScrollView(
        controller: _scrollController,
        slivers: [
          // Restaurant header
          _buildSliverAppBar(),
          // Restaurant info
          SliverToBoxAdapter(child: _buildRestaurantInfo()),
          // Filter bar
          SliverToBoxAdapter(child: _buildFilterBar()),
          // Menu
          if (_isLoading)
            const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator(color: AppTheme.primary)),
            )
          else
            ..._buildMenuSlivers(),
          // Bottom padding
          const SliverToBoxAdapter(child: SizedBox(height: 100)),
        ],
      ),
      bottomNavigationBar: ListenableBuilder(
        listenable: widget.cart,
        builder: (context, _) {
          if (widget.cart.isEmpty) return const SizedBox.shrink();
          return _buildCartBar();
        },
      ),
    );
  }

  SliverAppBar _buildSliverAppBar() {
    return SliverAppBar(
      expandedHeight: 220,
      pinned: true,
      stretch: true,
      backgroundColor: AppTheme.surface,
      leading: Padding(
        padding: const EdgeInsets.all(8),
        child: CircleAvatar(
          backgroundColor: Colors.white,
          child: IconButton(
            icon: const Icon(Icons.arrow_back, color: AppTheme.textPrimary, size: 20),
            onPressed: () => Navigator.pop(context),
          ),
        ),
      ),
      actions: [
        Padding(
          padding: const EdgeInsets.all(8),
          child: CircleAvatar(
            backgroundColor: Colors.white,
            child: IconButton(
              icon: const Icon(Icons.share_outlined, color: AppTheme.textPrimary, size: 20),
              onPressed: () {},
            ),
          ),
        ),
      ],
      flexibleSpace: FlexibleSpaceBar(
        background: widget.restaurant.imageUrl != null
            ? CachedNetworkImage(
                imageUrl: widget.restaurant.imageUrl!,
                fit: BoxFit.cover,
                placeholder: (c, u) => Container(color: AppTheme.background),
                errorWidget: (c, u, e) => Container(
                  color: AppTheme.background,
                  child: const Center(
                    child: Icon(Icons.restaurant, size: 64, color: AppTheme.textHint),
                  ),
                ),
              )
            : Container(
                color: AppTheme.background,
                child: const Center(
                  child: Icon(Icons.restaurant, size: 64, color: AppTheme.textHint),
                ),
              ),
      ),
    );
  }

  Widget _buildRestaurantInfo() {
    return Container(
      color: AppTheme.surface,
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  widget.restaurant.name,
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.textPrimary,
                    letterSpacing: -0.5,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.vegGreen,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  children: [
                    Icon(Icons.star, color: Colors.white, size: 16),
                    SizedBox(width: 3),
                    Text(
                      '4.2',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (widget.restaurant.city != null)
            Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 16, color: AppTheme.textSecondary),
                const SizedBox(width: 4),
                Text(
                  widget.restaurant.city!,
                  style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary),
                ),
              ],
            ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppTheme.background,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _infoTile(Icons.access_time, '25-35', 'min'),
                Container(width: 1, height: 30, color: AppTheme.divider),
                _infoTile(Icons.delivery_dining, 'FREE', 'delivery'),
                Container(width: 1, height: 30, color: AppTheme.divider),
                _infoTile(
                  Icons.circle,
                  widget.restaurant.isOpen ? 'Open' : 'Closed',
                  'now',
                  iconColor: widget.restaurant.isOpen ? AppTheme.vegGreen : AppTheme.nonVegRed,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoTile(IconData icon, String title, String subtitle, {Color? iconColor}) {
    return Column(
      children: [
        Icon(icon, size: 18, color: iconColor ?? AppTheme.textSecondary),
        const SizedBox(height: 4),
        Text(
          title,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: AppTheme.textPrimary),
        ),
        Text(
          subtitle,
          style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
        ),
      ],
    );
  }

  Widget _buildFilterBar() {
    return Container(
      color: AppTheme.surface,
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
      child: Row(
        children: [
          Expanded(
            child: Container(
              height: 40,
              decoration: BoxDecoration(
                border: Border.all(color: AppTheme.divider),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  const SizedBox(width: 12),
                  const Icon(Icons.search, size: 20, color: AppTheme.textHint),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Search in menu',
                      style: TextStyle(color: AppTheme.textHint, fontSize: 14),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: _showFilterSheet,
            child: Container(
              height: 40,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                border: Border.all(
                  color: (_vegOnly || _sortBy != 'default' || _maxPriceFilter != null)
                      ? AppTheme.primary
                      : AppTheme.divider,
                ),
                borderRadius: BorderRadius.circular(10),
                color: (_vegOnly || _sortBy != 'default' || _maxPriceFilter != null)
                    ? AppTheme.primary.withValues(alpha: 0.05)
                    : null,
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.tune,
                    size: 18,
                    color: (_vegOnly || _sortBy != 'default' || _maxPriceFilter != null)
                        ? AppTheme.primary
                        : AppTheme.textSecondary,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'Filters',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: (_vegOnly || _sortBy != 'default' || _maxPriceFilter != null)
                          ? AppTheme.primary
                          : AppTheme.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildMenuSlivers() {
    final slivers = <Widget>[];
    for (final category in _categories) {
      final items = _getFilteredItems(category.items);
      if (items.isEmpty) continue;

      slivers.add(SliverToBoxAdapter(
        child: Container(
          color: AppTheme.background,
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
          child: Row(
            children: [
              Container(
                width: 4,
                height: 20,
                decoration: BoxDecoration(
                  color: AppTheme.primary,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                category.name,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.textPrimary,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '(${items.length})',
                style: const TextStyle(
                  fontSize: 14,
                  color: AppTheme.textHint,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ));

      slivers.add(SliverList(
        delegate: SliverChildBuilderDelegate(
          (context, index) {
            return _MenuItemCard(
              item: items[index],
              cart: widget.cart,
            );
          },
          childCount: items.length,
        ),
      ));
    }
    if (slivers.isEmpty) {
      slivers.add(const SliverFillRemaining(
        child: Center(
          child: Text(
            'No items match your filters',
            style: TextStyle(fontSize: 16, color: AppTheme.textSecondary),
          ),
        ),
      ));
    }
    return slivers;
  }

  Widget _buildCartBar() {
    return GestureDetector(
      onTap: () {
        Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => CartScreen(cart: widget.cart)),
        );
      },
      child: Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        decoration: BoxDecoration(
          color: AppTheme.primary,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: AppTheme.primary.withValues(alpha: 0.4),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '${widget.cart.itemCount} item${widget.cart.itemCount > 1 ? 's' : ''}',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '₹${widget.cart.totalAmount.toStringAsFixed(0)}',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 16,
              ),
            ),
            const Spacer(),
            Text(
              'View Cart',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
                fontSize: 16,
              ),
            ),
            const SizedBox(width: 4),
            const Icon(Icons.arrow_forward_ios, color: Colors.white, size: 14),
          ],
        ),
      ),
    );
  }
}

class _MenuItemCard extends StatelessWidget {
  final MenuItem item;
  final CartProvider cart;

  const _MenuItemCard({required this.item, required this.cart});

  @override
  Widget build(BuildContext context) {
    final hasOffer = item.offerTitle != null && item.offerTitle!.isNotEmpty;
    final hasDiscount = item.offerDiscountPercent != null && item.offerDiscountPercent! > 0;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Left: item info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Veg/Non-veg indicator
                Container(
                  width: 18,
                  height: 18,
                  decoration: BoxDecoration(
                    border: Border.all(
                      color: item.isVeg ? AppTheme.vegGreen : AppTheme.nonVegRed,
                      width: 2,
                    ),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Center(
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: item.isVeg ? AppTheme.vegGreen : AppTheme.nonVegRed,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  item.name,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                // Price row
                Row(
                  children: [
                    Text(
                      '₹${item.effectivePrice.toStringAsFixed(0)}',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimary,
                      ),
                    ),
                    if (hasDiscount) ...[
                      const SizedBox(width: 6),
                      Text(
                        '₹${item.basePrice.toStringAsFixed(0)}',
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppTheme.textHint,
                          decoration: TextDecoration.lineThrough,
                        ),
                      ),
                    ],
                  ],
                ),
                if (hasOffer) ...[
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: AppTheme.offerYellow.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      item.offerTitle!,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.offerYellow,
                      ),
                    ),
                  ),
                ],
                if (item.description != null && item.description!.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    item.description!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppTheme.textSecondary,
                      height: 1.4,
                    ),
                  ),
                ],
                if (item.variants.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    '${item.variants.length} variant${item.variants.length > 1 ? 's' : ''} available',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppTheme.primary.withValues(alpha: 0.8),
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          // Right: image + add button
          Column(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  width: 110,
                  height: 100,
                  child: item.imageUrl != null && item.imageUrl!.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: item.imageUrl!,
                          fit: BoxFit.cover,
                          placeholder: (c, u) => Container(color: AppTheme.background),
                          errorWidget: (c, u, e) => Container(
                            color: AppTheme.background,
                            child: const Icon(Icons.fastfood, color: AppTheme.textHint),
                          ),
                        )
                      : Container(
                          color: AppTheme.background,
                          child: const Center(
                            child: Icon(Icons.fastfood, size: 32, color: AppTheme.textHint),
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 8),
              // Add to cart button
              ListenableBuilder(
                listenable: cart,
                builder: (context, _) {
                  final qty = cart.getItemQuantity(item.id);
                  if (qty > 0) {
                    return _buildQuantityControl(qty);
                  }
                  return _buildAddButton();
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAddButton() {
    return GestureDetector(
      onTap: () => cart.addItem(item),
      child: Container(
        width: 110,
        height: 36,
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppTheme.primary, width: 1.5),
        ),
        child: const Center(
          child: Text(
            'ADD',
            style: TextStyle(
              color: AppTheme.primary,
              fontSize: 14,
              fontWeight: FontWeight.w800,
              letterSpacing: 1,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildQuantityControl(int qty) {
    return Container(
      width: 110,
      height: 36,
      decoration: BoxDecoration(
        color: AppTheme.primary,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          GestureDetector(
            onTap: () {
              final key = cart.items.keys.firstWhere(
                (k) => cart.items[k]!.menuItem.id == item.id,
              );
              cart.updateQuantity(key, cart.items[key]!.quantity - 1);
            },
            child: const Icon(Icons.remove, color: Colors.white, size: 18),
          ),
          Text(
            '$qty',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w800,
            ),
          ),
          GestureDetector(
            onTap: () => cart.addItem(item),
            child: const Icon(Icons.add, color: Colors.white, size: 18),
          ),
        ],
      ),
    );
  }
}
