import { test, expect } from '@playwright/test';

function parseCurrency(text: string): number {
  return Number(text.replace('$', '').trim());
}

test.describe('Cart item count and subtotal management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('cart'));
  });

  test('Add two products, verify subtotal, remove one, and verify badge updates', async ({ page }) => {
    // 1) User adds two products to cart
    await page.goto('/products');
    await expect(page.locator('h1:has-text("Products")')).toBeVisible();

    const addToCartButtons = page.locator('button[id^="add-to-cart-"]');
    const increaseQtyButtons = page.locator('button[id^="increase-qty-"]');
    const productCount = await addToCartButtons.count();
    expect(productCount).toBeGreaterThanOrEqual(2);
    await expect(increaseQtyButtons).toHaveCount(productCount);

    for (const idx of [0, 1]) {
      await increaseQtyButtons.nth(idx).click();
      await addToCartButtons.nth(idx).click();
    }

    const cartLink = page.locator('a[aria-label^="Cart with "]');

    // 2) Verifies cart badge shows "2"
    await expect(cartLink.locator('span')).toHaveText('2');

    // 3) Opens cart page
    await cartLink.click();
    await expect(page).toHaveURL(/\/cart/);

    // 4) Verifies subtotal is correct
    const lineTotals = page.locator('tbody tr td.text-primary');
    await expect(lineTotals).toHaveCount(2);

    const lineTotal1 = parseCurrency(await lineTotals.nth(0).innerText());
    const lineTotal2 = parseCurrency(await lineTotals.nth(1).innerText());
    const expectedSubtotal = Number((lineTotal1 + lineTotal2).toFixed(2));

    const subtotalValue = page
      .locator('div.flex.justify-between')
      .filter({ has: page.locator('span:has-text("Subtotal")') })
      .first()
      .locator('span')
      .nth(1);

    const actualSubtotal = parseCurrency(await subtotalValue.innerText());
    const subtotalDiffInCents = Math.abs(Math.round(actualSubtotal * 100) - Math.round(expectedSubtotal * 100));
    expect(subtotalDiffInCents).toBeLessThanOrEqual(1);

    // 5) Removes one item
    await page.locator('button[aria-label^="Remove "][aria-label$=" from cart"]').first().click();

    // 6) Verifies badge updates to "1"
    await expect(cartLink.locator('span')).toHaveText('1');
  });
});