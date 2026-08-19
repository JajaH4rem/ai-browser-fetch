'use strict';

async function launchBrowser(args) {
  const { stealth, headed } = args;

  try {
    if (stealth) {
      const { chromium } = require('playwright-extra');
      const stealth_plugin = require('puppeteer-extra-plugin-stealth')();
      chromium.use(stealth_plugin);
      return await chromium.launch({ headless: !headed });
    }

    const { chromium } = require('playwright');
    return await chromium.launch({ headless: !headed });
  } catch (err) {
    if (err.message && err.message.includes("Executable doesn't exist")) {
      throw new Error(
        'Chromium browser not found.\n\nRun:\n  npx playwright install chromium\n\nThen try again.'
      );
    }
    throw err;
  }
}

module.exports = { launchBrowser };
