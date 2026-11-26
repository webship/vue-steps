import type { LaunchOptions, BrowserContextOptions } from 'playwright';

type BrowserName = 'chromium' | 'firefox' | 'webkit';

const browser = (process.env.BROWSER || 'chromium') as BrowserName;

// No --disable-web-security: a browser started with it sends a form's action without its Origin header,
// and the app refuses every action of an enhanced form with 403 (its check against cross-site posts).
const chromiumArgs: string[] = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-setuid-sandbox',
  '--ignore-certificate-errors',
  '--disable-extensions',
  '--incognito',
  '--disable-infobars',
];

interface PlaywrightConfig {
  browser: BrowserName;
  launchOptions: LaunchOptions;
  contextOptions: BrowserContextOptions;
}

const config: PlaywrightConfig = {
  browser,
  launchOptions: {
    headless: process.env.HEADLESS !== 'false',
    // SLOW_MO: milliseconds between browser actions. The steps wait on the page, not on the clock, so 0 works; 800 is comfortable to watch a headed run.
    slowMo: parseInt(process.env.SLOW_MO || (process.env.HEADLESS === 'false' ? '800' : '0'), 10),
    args: browser === 'chromium' ? chromiumArgs : [],
  },
  contextOptions: {
    viewport: { width: 1366, height: 900 },
    ignoreHTTPSErrors: true,
    // JAVASCRIPT=off runs the suite in a browser without JavaScript: the server's pages, links that load
    // whole pages, forms that post them (the lane of the scenarios tagged @no-javascript).
    javaScriptEnabled: process.env.JAVASCRIPT !== 'off',
  },
};

export = config;
