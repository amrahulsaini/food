class ApiConfig {
  // Change this to your actual server URL
  static const String baseUrl = 'http://10.0.2.2:3000/api/customerapp/v1';

  static String get restaurantsUrl => '$baseUrl/restaurants';
  static String menuUrl(int restaurantId) => '$baseUrl/restaurants/$restaurantId/menu';
}
