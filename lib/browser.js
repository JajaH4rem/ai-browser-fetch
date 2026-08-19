'use strict';

async function launchBrowser(args) {
  const { stealth, headed } = args;

  if (stealth) {
    const { chromium } = require('playwright-extra');
    const stealth_plugin = require('puppeteer-extra-plugin-stealth')();
    chromium.use(stealth_plugin);
    return chromium.launch({ headless: !headed });
  }

  const { chromium } = require('playwright');
  return chromium.launch({ headless: !headed });
}

module.exports = { launchBrowser };
