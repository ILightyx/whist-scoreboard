import { defineConfig, devices } from '@playwright/test';

// E2E_PORT avoids a clash with a preview server you already have running.
const port = Number(process.env.E2E_PORT ?? 4173);
const url = `http://127.0.0.1:${port}/`;

// End-to-end tests run against the production build (`vite preview`), so the
// service worker and offline behaviour are the real thing.
export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: url,
    viewport: { width: 1366, height: 1024 },
    hasTouch: true,
    // Tests find things by their English names; the Romanian test switches language itself.
    locale: 'en-US',
  },
  projects: [{ name: 'tablet-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 1024 }, hasTouch: true, locale: 'en-US' } }],
  webServer: {
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
