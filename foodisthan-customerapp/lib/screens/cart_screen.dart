import 'package:flutter/material.dart';
import '../config/theme.dart';
import '../models/cart.dart';

class CartScreen extends StatefulWidget {
  final CartProvider cart;

  const CartScreen({super.key, required this.cart});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Your Cart'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ListenableBuilder(
        listenable: widget.cart,
        builder: (context, _) {
          if (widget.cart.isEmpty) {
            return _buildEmptyCart();
          }
          return _buildCartContent();
        },
      ),
      bottomNavigationBar: ListenableBuilder(
        listenable: widget.cart,
        builder: (context, _) {
          if (widget.cart.isEmpty) return const SizedBox.shrink();
          return _buildCheckoutBar();
        },
      ),
    );
  }

  Widget _buildEmptyCart() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.shopping_cart_outlined,
            size: 80,
            color: AppTheme.textHint.withValues(alpha: 0.4),
          ),
          const SizedBox(height: 16),
          const Text(
            'Your cart is empty',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Add items from a restaurant to get started',
            style: TextStyle(fontSize: 14, color: AppTheme.textSecondary),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Browse Restaurants'),
          ),
        ],
      ),
    );
  }

  Widget _buildCartContent() {
    final entries = widget.cart.items.entries.toList();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Cart items
        Container(
          decoration: BoxDecoration(
            color: AppTheme.surface,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: [
              for (int i = 0; i < entries.length; i++) ...[
                _buildCartItem(entries[i].key, entries[i].value),
                if (i < entries.length - 1)
                  const Divider(height: 1, indent: 16, endIndent: 16),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        // Bill details
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.surface,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Bill Details',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              _billRow('Item Total', '₹${widget.cart.totalAmount.toStringAsFixed(2)}'),
              const SizedBox(height: 8),
              _billRow('Delivery Fee', 'FREE', valueColor: AppTheme.vegGreen),
              const SizedBox(height: 8),
              _billRow('Platform Fee', '₹5.00'),
              const SizedBox(height: 8),
              _billRow('GST & Charges', '₹${(widget.cart.totalAmount * 0.05).toStringAsFixed(2)}'),
              const Divider(height: 20),
              _billRow(
                'To Pay',
                '₹${(widget.cart.totalAmount + 5 + widget.cart.totalAmount * 0.05).toStringAsFixed(2)}',
                isBold: true,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // Clear cart
        Center(
          child: TextButton.icon(
            onPressed: () {
              widget.cart.clear();
            },
            icon: const Icon(Icons.delete_outline, size: 18, color: AppTheme.nonVegRed),
            label: const Text(
              'Clear Cart',
              style: TextStyle(color: AppTheme.nonVegRed, fontWeight: FontWeight.w600),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCartItem(String key, CartItem cartItem) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Veg/Non-veg indicator
          Container(
            width: 16,
            height: 16,
            margin: const EdgeInsets.only(top: 2),
            decoration: BoxDecoration(
              border: Border.all(
                color: cartItem.menuItem.isVeg ? AppTheme.vegGreen : AppTheme.nonVegRed,
                width: 2,
              ),
              borderRadius: BorderRadius.circular(3),
            ),
            child: Center(
              child: Container(
                width: 7,
                height: 7,
                decoration: BoxDecoration(
                  color: cartItem.menuItem.isVeg ? AppTheme.vegGreen : AppTheme.nonVegRed,
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          // Item name and variant
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  cartItem.menuItem.name,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.textPrimary,
                  ),
                ),
                if (cartItem.selectedVariant != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    cartItem.selectedVariant!.name,
                    style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                  ),
                ],
                if (cartItem.selectedAddons.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    cartItem.selectedAddons.map((a) => a.name).join(', '),
                    style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                  ),
                ],
              ],
            ),
          ),
          // Quantity controls
          Container(
            decoration: BoxDecoration(
              color: AppTheme.primary,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                GestureDetector(
                  onTap: () => widget.cart.updateQuantity(key, cartItem.quantity - 1),
                  child: const Padding(
                    padding: EdgeInsets.all(6),
                    child: Icon(Icons.remove, color: Colors.white, size: 16),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    '${cartItem.quantity}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: () => widget.cart.updateQuantity(key, cartItem.quantity + 1),
                  child: const Padding(
                    padding: EdgeInsets.all(6),
                    child: Icon(Icons.add, color: Colors.white, size: 16),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          // Price
          Text(
            '₹${cartItem.totalPrice.toStringAsFixed(0)}',
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppTheme.textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _billRow(String label, String value, {bool isBold = false, Color? valueColor}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: isBold ? 15 : 14,
            fontWeight: isBold ? FontWeight.w700 : FontWeight.w400,
            color: isBold ? AppTheme.textPrimary : AppTheme.textSecondary,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: isBold ? 15 : 14,
            fontWeight: isBold ? FontWeight.w700 : FontWeight.w500,
            color: valueColor ?? (isBold ? AppTheme.textPrimary : AppTheme.textSecondary),
          ),
        ),
      ],
    );
  }

  Widget _buildCheckoutBar() {
    final total = widget.cart.totalAmount + 5 + widget.cart.totalAmount * 0.05;
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '₹${total.toStringAsFixed(0)}',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const Text(
                  'Total (incl. taxes)',
                  style: TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                ),
              ],
            ),
            const SizedBox(width: 20),
            Expanded(
              child: ElevatedButton(
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Order placed! 🎉'),
                      backgroundColor: AppTheme.vegGreen,
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: const Text('Place Order'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
