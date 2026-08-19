'use strict';

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
    links: false,
    metadata: false,
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
    else if (rest[i] === '--links') args.links = true;
    else if (rest[i] === '--metadata') args.metadata = true;
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

module.exports = { parseArgs, isValidUrl, DEFAULT_UA };
