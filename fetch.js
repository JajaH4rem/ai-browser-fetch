#!/usr/bin/env node

'use strict';

const EXIT = {
  SUCCESS: 0,
  INVALID_ARGS: 1,
  NAV_TIMEOUT: 2,
  BROWSER_FAILED: 3,
  SELECTOR_NOT_FOUND: 4,
  EXTRACTION_FAILED: 5,
};

const MIN_READABLE_CHARS = 200;
const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

function parseArgs(argv) {
  const args = {
    url: null,
    timeout: 30000,
    retry: 1,
    waitUntil: 'load',
    wait: 0,
    waitFor: null,
    waitForTimeout: 10000,
    selector: null,
    maxChars: null,
    json: false,
    markdown: false,
    printUrl: false,
    stealth: false,
    headed: false,
    ua: DEFAULT_UA,
    noUa: false,
    screenshot: null,
  };
  const rest = argv.slice(2);

  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--timeout') args.timeout = Number(rest[++i]);
    else if (rest[i] === '--retry') args.retry = Number(rest[++i]);
    else if (rest[i] === '--wait-until') args.waitUntil = rest[++i];
    else if (rest[i] === '--wait') args.wait = Number(rest[++i]);
    else if (rest[i] === '--wait-for') args.waitFor = rest[++i];
    else if (rest[i] === '--wait-for-timeout') args.waitForTimeout = Number(rest[++i]);
    else if (rest[i] === '--selector') args.selector = rest[++i];
    else if (rest[i] === '--max-chars') args.maxChars = Number(rest[++i]);
    else if (rest[i] === '--json') args.json = true;
    else if (rest[i] === '--markdown') args.markdown = true;
    else if (rest[i] === '--url') args.printUrl = true;
    else if (rest[i] === '--stealth') args.stealth = true;
    else if (rest[i] === '--headed') args.headed = true;
    else if (rest[i] === '--ua') args.ua = rest[++i];
    else if (rest[i] === '--no-ua') args.noUa = true;
    else if (rest[i] === '--screenshot') args.screenshot = rest[++i];
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

function toMarkdown(html, url) {
  const { JSDOM } = require('jsdom');
  const { Readability } = require('@mozilla/readability');
  const TurndownService = require('turndown');

  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();

  if (!article || !article.textContent || article.textContent.trim().length < MIN_READABLE_CHARS) {
    return null;
  }

  const turndown = new TurndownService();
  return turndown.turndown(article.content);
}

function emitJson(data, maxChars) {
  if (data.success === false) {
    console.log(JSON.stringify(data));
    return;
  }
  const text = maxChars !== null && data.text && data.text.length > maxChars
    ? data.text.slice(0, maxChars)
    : (data.text || '');
  console.log(JSON.stringify({ ...data, text, length: text.length }));
}

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

async function fetchPage(url, args) {
  const { timeout, retry, waitUntil, wait, waitFor, waitForTimeout, selector, json, markdown, maxChars, noUa, ua, screenshot } = args;

  let browser;
  try {
    browser = await launchBrowser(args);
  } catch (err) {
    if (json) {
      emitJson({ success: false, url, error: `Browser launch failed: ${err.message}` }, maxChars);
    } else {
      console.error(`Browser launch failed: ${err.message}`);
    }
    process.exit(EXIT.BROWSER_FAILED);
  }

  const contextOptions = {
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
  };
  if (!noUa) {
    contextOptions.userAgent = ua;
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  let lastErr;
  let response = null;
  for (let attempt = 0; attempt <= retry; attempt++) {
    const t = Math.round(timeout * (1 + attempt * 0.5));
    try {
      response = await page.goto(url, { waitUntil: waitUntil || 'load', timeout: t });
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
    }
  }

  if (lastErr) {
    await browser.close();
    const msg = `Navigation failed: ${lastErr.message}`;
    if (json) {
      emitJson({ success: false, url, error: msg }, maxChars);
    } else {
      console.error(msg);
    }
    process.exit(EXIT.NAV_TIMEOUT);
  }

  if (wait > 0) {
    await page.waitForTimeout(wait);
  }

  if (waitFor) {
    try {
      await page.waitForSelector(waitFor, { timeout: waitForTimeout });
    } catch {
      await browser.close();
      const msg = `Timed out waiting for selector: ${waitFor}`;
      if (json) {
        emitJson({ success: false, url, error: msg }, maxChars);
      } else {
        console.error(msg);
      }
      process.exit(EXIT.NAV_TIMEOUT);
    }
  }

  // Screenshot after navigation/wait, before extraction
  if (screenshot) {
    await page.screenshot({ path: screenshot, fullPage: true });
  }

  const finalUrl = page.url();
  const title = await page.title();
  const status = response ? response.status() : null;
  const contentType = response ? (response.headers()['content-type'] || null) : null;

  // Resolve content frame (iframe detection) — used by plain and markdown modes
  const contentFrame =
    page.frames().find((f) => f !== page.mainFrame() && f.url() !== 'about:blank') || page;

  let text;
  try {
    if (selector) {
      const el = await page.$(selector);
      if (!el) {
        await browser.close();
        const msg = `Selector not found: ${selector}`;
        if (json) {
          emitJson({ success: false, url: finalUrl, error: msg }, maxChars);
        } else {
          console.error(msg);
        }
        process.exit(EXIT.SELECTOR_NOT_FOUND);
      }
      text = await el.evaluate((node) => node.innerText);
    } else if (markdown) {
      const html = await contentFrame.content();
      const md = toMarkdown(html, finalUrl);
      text = md !== null ? md : await contentFrame.evaluate(() => document.body.innerText);
    } else {
      text = await contentFrame.evaluate(() => document.body.innerText);
    }
  } catch (err) {
    await browser.close();
    const msg = `Extraction failed: ${err.message}`;
    if (json) {
      emitJson({ success: false, url: finalUrl, error: msg }, maxChars);
    } else {
      console.error(msg);
    }
    process.exit(EXIT.EXTRACTION_FAILED);
  }

  await browser.close();
  return { finalUrl, title, status, contentType, text };
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.url) {
    console.error('Usage: node fetch.js <url> [--json] [--markdown] [--url] [--stealth] [--headed] [--ua <string>] [--no-ua] [--screenshot <path>] [--selector <css>] [--max-chars <n>] [--wait <ms>] [--wait-for <selector>] [--timeout <ms>] [--retry <n>]');
    process.exit(EXIT.INVALID_ARGS);
  }

  if (!isValidUrl(args.url)) {
    console.error(`Invalid URL: ${args.url}`);
    console.error('Usage: node fetch.js <url> [--json] [--markdown] [--url] [--stealth] [--headed] [--ua <string>] [--no-ua] [--screenshot <path>] [--selector <css>] [--max-chars <n>] [--wait <ms>] [--wait-for <selector>] [--timeout <ms>] [--retry <n>]');
    process.exit(EXIT.INVALID_ARGS);
  }

  const { finalUrl, title, status, contentType, text: rawText } = await fetchPage(args.url, args);

  if (args.json) {
    emitJson({
      success: true,
      url: finalUrl,
      title,
      status,
      contentType,
      timestamp: new Date().toISOString(),
      text: rawText,
    }, args.maxChars);
  } else {
    let text = rawText;
    if (args.maxChars !== null && text.length > args.maxChars) {
      text = text.slice(0, args.maxChars);
    }
    if (args.printUrl) {
      console.log(finalUrl);
    }
    console.log(text);
  }

  process.exit(EXIT.SUCCESS);
}

main();
