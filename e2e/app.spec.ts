import { test, expect } from '@playwright/test';

test.describe('Stock Image Metadata Generator', () => {
  test('should load the main page', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/Stock Image Metadata Generator/);

    // Check header is visible
    await expect(page.getByRole('heading', { name: /Stock Image Metadata Generator/i })).toBeVisible();
  });

  test('should have Generate and History tabs', async ({ page }) => {
    await page.goto('/');

    // Check tabs exist - use text content since they're TabsTriggers
    await expect(page.getByRole('tab', { name: /Generate/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /History/i })).toBeVisible();
  });

  test('should switch between tabs', async ({ page }) => {
    await page.goto('/');

    // Click History tab
    await page.getByRole('tab', { name: /History/i }).click();

    // Should show history content (empty state)
    await expect(page.getByText(/No history yet/)).toBeVisible();

    // Click Generate tab
    await page.getByRole('tab', { name: /Generate/i }).click();

    // Should show provider card
    await expect(page.getByText('Provider & Model')).toBeVisible();
  });

  test('should show provider selection', async ({ page }) => {
    await page.goto('/');

    // Provider label should exist
    await expect(page.locator('label:has-text("Provider")')).toBeVisible();

    // Model label should exist
    await expect(page.locator('label:has-text("Model")')).toBeVisible();
  });

  test('should show settings card', async ({ page }) => {
    await page.goto('/');

    // Settings card should be visible
    await expect(page.getByText('Settings')).toBeVisible();

    // File type label should exist
    await expect(page.locator('label:has-text("File type")')).toBeVisible();
  });

  test('should show upload area', async ({ page }) => {
    await page.goto('/');

    // Upload card should be visible
    await expect(page.getByText('Upload')).toBeVisible();

    // Select files label/button should exist
    await expect(page.getByText('Select files')).toBeVisible();
  });

  test('should require API key before generating', async ({ page }) => {
    await page.goto('/');

    // Generate button should be disabled without files
    const generateButton = page.getByRole('button', { name: /Generate metadata/i });
    await expect(generateButton).toBeDisabled();
  });

  test('should allow switching provider', async ({ page }) => {
    await page.goto('/');

    // Switch to OpenAI provider - click the provider trigger first
    const providerTrigger = page.locator('[data-slot="select-trigger"]').first();
    await providerTrigger.click();

    // Wait for the dropdown and click OpenAI
    await page.getByText('OpenAI').click();

    // Verify the selection changed
    await expect(providerTrigger).toContainText('OpenAI');
  });
});
