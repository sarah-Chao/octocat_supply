Feature: Cart item count and subtotal management
  As a shopper
  I want cart quantities and subtotal to update as I add and remove products
  So that I can trust the cart summary before checkout

  Scenario: Add two products, verify subtotal, remove one, and verify badge updates
    Given I am viewing the product catalog
    When I add "SmartFeeder One" to the cart
    And I add "PurrView Camera" to the cart
    Then the cart badge shows "2"
    When I open the cart page
    Then the subtotal equals the sum of "SmartFeeder One" and "PurrView Camera"
    When I remove "PurrView Camera" from the cart
    Then the cart badge shows "1"