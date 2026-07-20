import { test, expect } from '@playwright/test';

/**
 * Cart management E2E tests
 * Implements: frontend/tests/features/cart-management.feature
 *
 * Covers:
 * - Add to Cart button disabled state when quantity is 0
 * - Increasing / decreasing quantity per product
 * - Quantity cannot go below zero
 * - Adding items to cart (confirmation alert + quantity reset)
 * - Independent quantity tracking for multiple products
 * - Accessibility: aria-labels on quantity controls and Add to Cart button
 * - Keyboard-only navigation for quantity controls
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Locator for the "Increase quantity" button of a named product */
function increaseBtn(page: import('@playwright/test').Page, productName: string) {
  return page.locator(`button[aria-label="Increase quantity of ${productName}"]`);
}

/** Locator for the "Decrease quantity" button of a named product */
function decreaseBtn(page: import('@playwright/test').Page, productName: string) {
  return page.locator(`button[aria-label="Decrease quantity of ${productName}"]`);
}

/** Locator for the quantity display span of a named product */
function quantityDisplay(page: import('@playwright/test').Page, productName: string) {
  return page.locator(`span[aria-label="Quantity of ${productName}"]`);
}

/** Locator for the "Add to Cart" button of a named product */
function addToCartBtn(page: import('@playwright/test').Page, productName: string) {
  // The aria-label changes with quantity, so we match by id prefix via the product card context
  return page.locator(`button[aria-label^="Add"][aria-label*="${productName}"][aria-label*="to cart"]`);
}

/** Increase quantity N times for a named product */
async function increaseQty(page: import('@playwright/test').Page, productName: string, times: number) {
  const btn = increaseBtn(page, productName);
  for (let i = 0; i < times; i++) {
    await btn.click();
  }
}

/** Decrease quantity N times for a named product */
async function decreaseQty(page: import('@playwright/test').Page, productName: string, times: number) {
  const btn = decreaseBtn(page, productName);
  for (let i = 0; i < times; i++) {
    await btn.click();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('Cart management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate away from about:blank so localStorage context is available
    await page.goto('/products');
    // Wait for at least one product card to be visible
    await expect(page.locator('h3:has-text("SmartFeeder One")')).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  test('Add to Cart button is disabled when no quantity is selected', async ({ page }) => {
    // Given I am viewing the product catalog (beforeEach)
    // Then the Add to Cart button for SmartFeeder One is disabled
    await expect(addToCartBtn(page, 'SmartFeeder One')).toBeDisabled();

    // And the quantity shown is 0
    await expect(quantityDisplay(page, 'SmartFeeder One')).toHaveText('0');
  });

  test('Increase quantity and enable the Add to Cart button', async ({ page }) => {
    // When I increase the quantity of SmartFeeder One by 1
    await increaseQty(page, 'SmartFeeder One', 1);

    // Then the quantity shown is 1
    await expect(quantityDisplay(page, 'SmartFeeder One')).toHaveText('1');

    // And the Add to Cart button is enabled
    await expect(addToCartBtn(page, 'SmartFeeder One')).toBeEnabled();
  });

  test('Add a single item to the cart', async ({ page }) => {
    // Given I have set the quantity of SmartFeeder One to 1
    await increaseQty(page, 'SmartFeeder One', 1);
    await expect(addToCartBtn(page, 'SmartFeeder One')).toBeEnabled();

    // When I click "Add to Cart" for SmartFeeder One
    page.once('dialog', async (dialog) => {
      // Then I see the confirmation message
      expect(dialog.message()).toBe('Added 1 items to cart');
      await dialog.accept();
    });
    await addToCartBtn(page, 'SmartFeeder One').click();

    // And the quantity resets to 0
    await expect(quantityDisplay(page, 'SmartFeeder One')).toHaveText('0');

    // And the Add to Cart button is disabled again
    await expect(addToCartBtn(page, 'SmartFeeder One')).toBeDisabled();
  });

  test('Add multiple items of the same product to the cart', async ({ page }) => {
    // Given I have set the quantity of SmartFeeder One to 3
    await increaseQty(page, 'SmartFeeder One', 3);
    await expect(quantityDisplay(page, 'SmartFeeder One')).toHaveText('3');

    // When I click "Add to Cart"
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toBe('Added 3 items to cart');
      await dialog.accept();
    });
    await addToCartBtn(page, 'SmartFeeder One').click();

    // Then the quantity resets to 0
    await expect(quantityDisplay(page, 'SmartFeeder One')).toHaveText('0');
  });

  test('Increase quantity multiple times', async ({ page }) => {
    // When I increase the quantity three times
    await increaseQty(page, 'SmartFeeder One', 3);

    // Then the quantity shown is 3
    await expect(quantityDisplay(page, 'SmartFeeder One')).toHaveText('3');
  });

  // -------------------------------------------------------------------------
  // Edge / boundary cases
  // -------------------------------------------------------------------------

  test('Quantity cannot go below zero', async ({ page }) => {
    // When I decrease quantity when it is already 0
    await decreaseQty(page, 'SmartFeeder One', 1);

    // Then the quantity stays at 0
    await expect(quantityDisplay(page, 'SmartFeeder One')).toHaveText('0');
  });

  test('Decrease quantity after increasing it', async ({ page }) => {
    // When I increase twice and then decrease once
    await increaseQty(page, 'SmartFeeder One', 2);
    await decreaseQty(page, 'SmartFeeder One', 1);

    // Then quantity is 1 and Add to Cart is still enabled
    await expect(quantityDisplay(page, 'SmartFeeder One')).toHaveText('1');
    await expect(addToCartBtn(page, 'SmartFeeder One')).toBeEnabled();
  });

  test('Decrease quantity back to zero disables the Add to Cart button', async ({ page }) => {
    // When I increase then decrease back to 0
    await increaseQty(page, 'SmartFeeder One', 1);
    await decreaseQty(page, 'SmartFeeder One', 1);

    // Then quantity is 0 and Add to Cart is disabled
    await expect(quantityDisplay(page, 'SmartFeeder One')).toHaveText('0');
    await expect(addToCartBtn(page, 'SmartFeeder One')).toBeDisabled();
  });

  for (const qty of [1, 5]) {
    test(`Add ${qty} item(s) to the cart and see confirmation`, async ({ page }) => {
      await increaseQty(page, 'SmartFeeder One', qty);
      await expect(quantityDisplay(page, 'SmartFeeder One')).toHaveText(String(qty));

      page.once('dialog', async (dialog) => {
        expect(dialog.message()).toBe(`Added ${qty} items to cart`);
        await dialog.accept();
      });
      await addToCartBtn(page, 'SmartFeeder One').click();

      await expect(quantityDisplay(page, 'SmartFeeder One')).toHaveText('0');
    });
  }

  test('Manage cart quantities independently for two different products', async ({ page }) => {
    // When I set different quantities for two products
    await increaseQty(page, 'SmartFeeder One', 1);
    await increaseQty(page, 'AutoClean Litter Dome', 2);

    // Then each product shows its own quantity
    await expect(quantityDisplay(page, 'SmartFeeder One')).toHaveText('1');
    await expect(quantityDisplay(page, 'AutoClean Litter Dome')).toHaveText('2');
  });

  // -------------------------------------------------------------------------
  // Accessibility
  // -------------------------------------------------------------------------

  test('Quantity controls have accessible labels', async ({ page }) => {
    const productName = 'SmartFeeder One';

    // Increase button
    await expect(increaseBtn(page, productName)).toHaveAttribute(
      'aria-label',
      `Increase quantity of ${productName}`,
    );

    // Decrease button
    await expect(decreaseBtn(page, productName)).toHaveAttribute(
      'aria-label',
      `Decrease quantity of ${productName}`,
    );

    // Quantity display
    await expect(quantityDisplay(page, productName)).toHaveAttribute(
      'aria-label',
      `Quantity of ${productName}`,
    );
  });

  test('Add to Cart button aria-label reflects the current quantity', async ({ page }) => {
    const productName = 'SmartFeeder One';

    // When I increase quantity to 1
    await increaseQty(page, productName, 1);

    // Then the aria-label contains "1"
    await expect(addToCartBtn(page, productName)).toHaveAttribute(
      'aria-label',
      `Add 1 ${productName} to cart`,
    );
  });

  test('Keyboard-only user can increase quantity and add to cart', async ({ page }) => {
    const productName = 'SmartFeeder One';

    // Focus the increase-quantity button via keyboard (Tab until focused)
    await increaseBtn(page, productName).focus();

    // Press Enter to activate the button
    await page.keyboard.press('Enter');

    // Quantity should now be 1
    await expect(quantityDisplay(page, productName)).toHaveText('1');

    // Add to Cart button should be enabled
    await expect(addToCartBtn(page, productName)).toBeEnabled();
  });
});
