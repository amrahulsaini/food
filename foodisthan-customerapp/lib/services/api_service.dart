import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/restaurant.dart';
import '../config/constants.dart';

class ApiService {
  static Future<List<Restaurant>> getRestaurants() async {
    try {
      final response = await http
          .get(Uri.parse(ApiConfig.restaurantsUrl))
          .timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['ok'] == true) {
          return (data['restaurants'] as List)
              .map((e) => Restaurant.fromJson(e as Map<String, dynamic>))
              .toList();
        }
      }
      return [];
    } catch (_) {
      return [];
    }
  }

  static Future<({Restaurant? restaurant, List<Category> categories})>
      getRestaurantMenu(int restaurantId) async {
    try {
      final response = await http
          .get(Uri.parse(ApiConfig.menuUrl(restaurantId)))
          .timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data['ok'] == true) {
          final restaurant = data['restaurant'] != null
              ? Restaurant.fromJson(data['restaurant'] as Map<String, dynamic>)
              : null;
          final categories = (data['categories'] as List?)
                  ?.map(
                      (e) => Category.fromJson(e as Map<String, dynamic>))
                  .toList() ??
              [];
          return (restaurant: restaurant, categories: categories);
        }
      }
      return (restaurant: null, categories: <Category>[]);
    } catch (_) {
      return (restaurant: null, categories: <Category>[]);
    }
  }
}
