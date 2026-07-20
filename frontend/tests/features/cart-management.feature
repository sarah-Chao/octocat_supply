Feature: Cart management on the Products page
  As a supply chain planner
  I want to select quantities and add products to my cart
  So that I can place orders for the items I need

  Background:
    Given I am viewing the product catalog

  # ---------------------------------------------------------------------------
  # Happy path scenarios
  # ---------------------------------------------------------------------------

  Scenario: Add to Cart button is disabled when no quantity is selected
    Then the "Add to Cart" button for "SmartFeeder One" is disabled
    And the quantity shown for "SmartFeeder One" is 0

  Scenario: Increase quantity and enable the Add to Cart button
    When I increase the quantity of "SmartFeeder One" by 1
    Then the quantity shown for "SmartFeeder One" is 1
    And the "Add to Cart" button for "SmartFeeder One" is enabled

  Scenario: Add a single item to the cart
    Given I have set the quantity of "SmartFeeder One" to 1
    When I click "Add to Cart" for "SmartFeeder One"
    Then I see the confirmation message "Added 1 items to cart"
    And the quantity shown for "SmartFeeder One" resets to 0
    And the "Add to Cart" button for "SmartFeeder One" is disabled

  Scenario: Add multiple items of the same product to the cart
    Given I have set the quantity of "SmartFeeder One" to 3
    When I click "Add to Cart" for "SmartFeeder One"
    Then I see the confirmation message "Added 3 items to cart"
    And the quantity shown for "SmartFeeder One" resets to 0

  Scenario: Increase quantity multiple times
    When I increase the quantity of "SmartFeeder One" by 1
    And I increase the quantity of "SmartFeeder One" by 1
    And I increase the quantity of "SmartFeeder One" by 1
    Then the quantity shown for "SmartFeeder One" is 3

  # ---------------------------------------------------------------------------
  # Edge / boundary scenarios
  # ---------------------------------------------------------------------------

  Scenario: Quantity cannot go below zero
    When I decrease the quantity of "SmartFeeder One" by 1
    Then the quantity shown for "SmartFeeder One" is 0

  Scenario: Decrease quantity after increasing it
    When I increase the quantity of "SmartFeeder One" by 1
    And I increase the quantity of "SmartFeeder One" by 1
    And I decrease the quantity of "SmartFeeder One" by 1
    Then the quantity shown for "SmartFeeder One" is 1
    And the "Add to Cart" button for "SmartFeeder One" is enabled

  Scenario: Decrease quantity back to zero disables the Add to Cart button
    When I increase the quantity of "SmartFeeder One" by 1
    And I decrease the quantity of "SmartFeeder One" by 1
    Then the quantity shown for "SmartFeeder One" is 0
    And the "Add to Cart" button for "SmartFeeder One" is disabled

  Scenario Outline: Add a variety of quantities to the cart
    Given I have set the quantity of "SmartFeeder One" to <quantity>
    When I click "Add to Cart" for "SmartFeeder One"
    Then I see the confirmation message "Added <quantity> items to cart"
    And the quantity shown for "SmartFeeder One" resets to 0
    Examples:
      | quantity |
      | 1        |
      | 5        |

  Scenario: Manage cart quantities independently for two different products
    When I increase the quantity of "SmartFeeder One" by 1
    And I increase the quantity of "AutoClean Litter Dome" by 1
    And I increase the quantity of "AutoClean Litter Dome" by 1
    Then the quantity shown for "SmartFeeder One" is 1
    And the quantity shown for "AutoClean Litter Dome" is 2

  # ---------------------------------------------------------------------------
  # Accessibility scenarios
  # ---------------------------------------------------------------------------

  Scenario: Quantity controls have accessible labels
    Then the increase-quantity button for "SmartFeeder One" has an aria-label containing "Increase quantity"
    And the decrease-quantity button for "SmartFeeder One" has an aria-label containing "Decrease quantity"
    And the quantity display for "SmartFeeder One" has an aria-label containing "Quantity"

  Scenario: Add to Cart button aria-label reflects the current quantity
    When I increase the quantity of "SmartFeeder One" by 1
    Then the "Add to Cart" button aria-label for "SmartFeeder One" contains "1"

  Scenario: Keyboard-only user can increase quantity and add to cart
    When I focus the increase-quantity button for "SmartFeeder One" via keyboard
    And I press Enter to activate the increase-quantity button for "SmartFeeder One"
    Then the quantity shown for "SmartFeeder One" is 1
    And the "Add to Cart" button for "SmartFeeder One" is enabled
