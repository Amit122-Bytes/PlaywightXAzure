import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    // Makes each Playwright action visible when the suite is run headed.
    launchOptions: { slowMo: 750 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
