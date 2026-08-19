#!/usr/bin/env node

'use strict';

const { parseArgs, isValidUrl } = require('./lib/args');
const { launchBrowser } = require('./lib/browser');
const { toMarkdown } = require('./lib/markdown');
const { emitJson } = require('./lib/output');

const EXIT = {
  SUCCESS: 0,
  INVALID_ARGS: 1,
  NAV_TIMEOUT: 2,
  BROWSER_FAILED: 3,
  SELECTOR_NOT_FOUND: 4,
  EXTRACTION_FAILED: 5,
};

function extractLinks(pageUrl, anchors) {
  const seen = new Set();
  const result = [];
  for (const href of anchors) {
    if (!href) continue;
    try {
      const abs = new URL(href, pageUrl).href;
      if ((abs.startsWith('http:') || abs.startsWith('https:')) && !seen.has(abs)) {
        seen.add(abs);
        result.push(abs);
      }
    } catch {
      // skip unparseable hrefs
    }
  }
  return result;
}

function extractMeta(metaTags, title) {
  const FIELDS = ['description', 'canonical', 'og:title', 'og:description', 'og:image'];
  const meta = { title };
  for (const { name, property, content } of metaTags) {
    const key = name || property;
    if (key && content && FIELDS.includes(key)) {
      meta[key] = content;
    }
  }
  return meta;
}

async function fetchPage(url, args) {
  const {
    timeout, retry, waitUntil, wait, waitFor, waitForTimeout,
    selector, json, markdown, maxChars, noUa, ua, screenshot,
    links, metadata,
  } = args;

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

  // Resolve content frame (iframe detection)
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

  // Extract links if requested
  let pageLinks = null;
  if (links) {
    const anchors = await page.$$eval('a[href]', (els) => els.map((el) => el.getAttribute('href')));
    pageLinks = extractLinks(finalUrl, anchors);
  }

  // Extract metadata if requested
  let pageMeta = null;
  if (metadata) {
    const metaTags = await page.$$eval('meta', (els) =>
      els.map((el) => ({
        name: el.getAttribute('name'),
        property: el.getAttribute('property'),
        content: el.getAttribute('content'),
      }))
    );
    pageMeta = extractMeta(metaTags, title);
  }

  await browser.close();
  return { finalUrl, title, status, contentType, text, links: pageLinks, meta: pageMeta };
}

async function main() {
  const args = parseArgs(process.argv);

  if (!args.url) {
    console.error('Usage: node fetch.js <url> [--json] [--markdown] [--url] [--links] [--metadata] [--stealth] [--headed] [--ua <string>] [--no-ua] [--screenshot <path>] [--selector <css>] [--max-chars <n>] [--wait <ms>] [--wait-for <selector>] [--timeout <ms>] [--retry <n>]');
    process.exit(EXIT.INVALID_ARGS);
  }

  if (!isValidUrl(args.url)) {
    console.error(`Invalid URL: ${args.url}`);
    console.error('Usage: node fetch.js <url> [--json] [--markdown] [--url] [--links] [--metadata] [--stealth] [--headed] [--ua <string>] [--no-ua] [--screenshot <path>] [--selector <css>] [--max-chars <n>] [--wait <ms>] [--wait-for <selector>] [--timeout <ms>] [--retry <n>]');
    process.exit(EXIT.INVALID_ARGS);
  }

  const { finalUrl, title, status, contentType, text: rawText, links, meta } = await fetchPage(args.url, args);

  if (args.json) {
    const payload = {
      success: true,
      url: finalUrl,
      title,
      status,
      contentType,
      timestamp: new Date().toISOString(),
      text: rawText,
    };
    if (links !== null) payload.links = links;
    if (meta !== null) payload.meta = meta;
    emitJson(payload, args.maxChars);
  } else if (args.links) {
    console.log(JSON.stringify(links));
  } else if (args.metadata) {
    console.log(JSON.stringify(meta));
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
