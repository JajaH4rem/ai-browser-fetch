#!/usr/bin/env node

'use strict';

const EXIT = {
  SUCCESS: 0,
  INVALID_ARGS: 1,
  NAV_TIMEOUT: 2,
  BROWSER_FAILED: 3,
  EXTRACTION_FAILED: 5,
};

function parseArgs(argv) {
  const args = { url: null, timeout: 30000, retry: 1, waitUntil: 'load' };
  const rest = argv.slice(2);

  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--timeout') args.timeout = Number(rest[++i]);
    else if (rest[i] === '--retry') args.retry = Number(rest[++i]);
    else if (rest[i] === '--wait-until') args.waitUntil = rest[++i];
    else if (!rest[i].startsWith('--')) args.url = rest[i];
  }

  return args;
}

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function fetchPage(url, { timeout, retry, waitUntil }) {
  const { chromium } = require('playwright');

  let browser;
  try {
    browser = await chromium.launch();
  } catch (err) {
    console.error(`Browser launch failed: ${err.message}`);
    process.exit(EXIT.BROWSER_FAILED);
  }

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  });

  const page = await context.newPage();

  let lastErr;
  for (let attempt = 0; attempt <= retry; attempt++) {
    const t = Math.round(timeout * (1 + attempt * 0.5));
    try {
      await page.goto(url, { waitUntil: waitUntil || 'load', timeout: t });
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
    }
  }

  if (lastErr) {
    await browser.close();
    console.error(`Navigation failed: ${lastErr.message}`);
    process.exit(EXIT.NAV_TIMEOUT);
  }

  let text;
  try {
    // Auto iframe detection: use first non-blank child frame if present
    const contentFrame =
      page.frames().find((f) => f !== page.mainFrame() && f.url() !== 'about:blank') || page;
    text = await contentFrame.evaluate(() => document.body.innerText);
  } catch (err) {
    await browser.close();
    console.error(`Extraction failed: ${err.message}`);
    process.exit(EXIT.EXTRACTION_FAILED);
  }

  await browser.close();
  return text;
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.url) {
    console.error('Usage: node fetch.js <url> [--timeout <ms>] [--retry <n>]');
    process.exit(EXIT.INVALID_ARGS);
  }

  if (!isValidUrl(args.url)) {
    console.error(`Invalid URL: ${args.url}`);
    console.error('Usage: node fetch.js <url> [--timeout <ms>] [--retry <n>]');
    process.exit(EXIT.INVALID_ARGS);
  }

  const text = await fetchPage(args.url, args);
  console.log(text);
  process.exit(EXIT.SUCCESS);
}

main();
