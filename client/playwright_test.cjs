const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const screenshotsDir = 'C:/Users/admin/Documents/GitHub/RWManager/client/pw_screenshots';
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // Intercept API requests and return mock data
  await context.route('**/api/**', async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    // Mock auth/login
    if (url.includes('/auth/login') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ access_token: 'mock-jwt-token-12345' })
      });
    }

    // Mock secrets - return some secrets so lock button appears
    if (url.includes('/secrets') && !url.includes('/value') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'secret-1', name: 'Remnawave API Key', type: 'token' },
          { id: 'secret-2', name: 'SSH Password', type: 'password' },
        ])
      });
    }

    // Mock secrets value
    if (url.includes('/secrets') && url.includes('/value') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ value: 'mock-secret-value-xyz' })
      });
    }

    // Mock settings
    if (url.includes('/settings') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          remnawave_url: 'https://panel.example.com',
          remnawave_api_key: '',
          admin_login: 'admin',
          telegram_bot_token: '',
          telegram_chat_id: '',
          telegram_topic_id: '',
          telegram_notify_on_error: 'true',
          telegram_notify_on_success: 'false',
        })
      });
    }

    // Mock other settings POST, check etc.
    if (url.includes('/settings')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    }

    // Default: pass through
    return route.continue();
  });

  const page = await context.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  try {
    // 1. Open the app and set auth token directly in localStorage
    console.log('Step 1: Opening http://localhost:5173 and setting mock auth token...');
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Set token in localStorage to bypass login
    await page.evaluate(() => {
      localStorage.setItem('token', 'mock-jwt-token-12345');
    });

    // Navigate to settings directly
    console.log('Step 2: Navigating to /settings...');
    await page.goto('http://localhost:5173/settings', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    await page.screenshot({ path: `${screenshotsDir}/01_settings_page.png`, fullPage: true });
    console.log('Screenshot: 01_settings_page.png');

    // Check for console errors
    console.log('Console errors:', errors.length > 0 ? errors.join('\n') : 'None');

    // Check page title/content
    const pageTitle = await page.locator('h4, h5').first().textContent().catch(() => '');
    console.log('Page title:', pageTitle);

    // 3. Look for API key field
    console.log('Step 3: Looking for API ключ field...');
    const apiKeyLabel = page.locator('label:has-text("API ключ")').first();
    const apiKeyCount = await apiKeyLabel.count();
    console.log('API ключ label found:', apiKeyCount > 0 ? 'YES' : 'NO');

    // Look specifically for MUI icon buttons
    const iconButtons = await page.locator('.MuiIconButton-root').all();
    console.log(`MUI IconButton elements found: ${iconButtons.length}`);

    for (let i = 0; i < iconButtons.length; i++) {
      const btn = iconButtons[i];
      const ariaLabel = await btn.getAttribute('aria-label').catch(() => '');
      const title = await btn.getAttribute('title').catch(() => '');
      const isVisible = await btn.isVisible();
      console.log(`  IconButton[${i}]: aria-label="${ariaLabel}", title="${title}", visible=${isVisible}`);
    }

    // Step 4: Find the LockOpen button inside InputAdornment
    console.log('Step 4: Looking for LockOpen button...');

    const adornmentBtn = page.locator('.MuiInputAdornment-root button').first();
    const adornmentCount = await adornmentBtn.count();
    console.log('InputAdornment button found:', adornmentCount > 0 ? 'YES' : 'NO');

    await page.screenshot({ path: `${screenshotsDir}/02_settings_with_secrets.png`, fullPage: true });

    // Step 5: Click the lock button and check for Dialog
    const secretBtn = page.locator('button[aria-label="Вставить из секретов"]').first();
    const secretBtnCount = await secretBtn.count();
    console.log('Button "Вставить из секретов" found:', secretBtnCount > 0 ? 'YES' : 'NO');

    let clickedBtn = null;
    if (secretBtnCount > 0) {
      clickedBtn = secretBtn;
      console.log('Step 5: Clicking "Вставить из секретов" button...');
    } else if (adornmentCount > 0) {
      clickedBtn = adornmentBtn;
      console.log('Step 5: Clicking InputAdornment (LockOpen) button...');
    } else if (iconButtons.length > 0) {
      clickedBtn = iconButtons[0];
      console.log('Step 5: Clicking first MUI IconButton...');
    }

    if (clickedBtn) {
      await clickedBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${screenshotsDir}/03_after_lock_click.png`, fullPage: true });
      console.log('Screenshot: 03_after_lock_click.png');

      // Check if Dialog opened
      const dialog = page.locator('[role="dialog"]').first();
      const dialogVisible = await dialog.isVisible().catch(() => false);
      console.log('Dialog opened:', dialogVisible ? 'YES - Dialog is visible!' : 'NO - Dialog not found');

      if (dialogVisible) {
        const dialogTitle = await page.locator('[role="dialog"] h2, .MuiDialogTitle-root').first().textContent().catch(() => '');
        console.log('Dialog title:', dialogTitle);

        const dialogItems = await page.locator('[role="dialog"] .MuiMenuItem-root').all();
        console.log(`Dialog items count: ${dialogItems.length}`);
        for (let i = 0; i < dialogItems.length; i++) {
          const text = await dialogItems[i].textContent().catch(() => '');
          console.log(`  Item[${i}]: ${text.trim()}`);
        }

        await page.screenshot({ path: `${screenshotsDir}/04_dialog_open.png`, fullPage: true });
        console.log('Screenshot: 04_dialog_open.png');

        // Check it's a Dialog, not a dropdown menu
        const isDialog = await page.locator('.MuiDialog-root').count() > 0;
        const isPopover = await page.locator('.MuiPopover-root').count() > 0;
        console.log('Is MUI Dialog (.MuiDialog-root):', isDialog ? 'YES' : 'NO');
        console.log('Is MUI Popover (.MuiPopover-root):', isPopover ? 'YES' : 'NO');
      }
    } else {
      console.log('Step 5: No clickable button found.');
    }

    console.log('\n=== SUMMARY ===');
    console.log('Frontend running: YES (http://localhost:5173)');
    console.log('Settings page URL:', currentUrl);
    const significantErrors = errors.filter(e => !e.includes('404') && !e.includes('401'));
    console.log('Significant console errors:', significantErrors.length === 0 ? 'None' : significantErrors.join('\n'));

  } catch (err) {
    console.error('PLAYWRIGHT ERROR:', err.message);
    await page.screenshot({ path: `${screenshotsDir}/error.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
})();
