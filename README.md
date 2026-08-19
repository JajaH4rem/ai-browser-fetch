# ai-browser-fetch

**A drop-in browser fetch for AI agents.**

---

## The problem it solves

```bash
# Normal fetch
curl https://example.com
→ Please enable JavaScript

# ai-browser-fetch
node fetch.js https://example.com
→ Actual rendered page content
```

---

## Why this exists

HTTP fetch works fine for static sites. But modern websites increasingly require JavaScript execution, browser APIs, or anti-bot handling before meaningful content appears.

AI agents — Claude Code, Cursor, Cline, Roo Code, OpenHands, Codex, Gemini CLI, OpenAI Agents — all eventually hit pages where their built-in fetch tool returns nothing useful.

ai-browser-fetch is the fallback. One command. Predictable output. The agent doesn't think about Playwright.

---

## Features

- ✅ JavaScript-rendered pages (React, Next.js, SPAs)
- ✅ Real Chromium browser via Playwright
- ✅ Waits for network to settle before extracting
- ✅ Auto iframe detection
- ✅ Stealth mode to reduce bot detection on some sites
- ✅ Custom user-agent and screenshot support
- ✅ Simple CLI — works with any agent that can run a shell command

---

## What it doesn't do

- ❌ Bypass CAPTCHA
- ❌ Log into authenticated pages
- ❌ Guarantee bypass of aggressive anti-bot systems
- ❌ Handle sites that require real user interaction

---

## Install

**Use without installing (recommended):**
```bash
npx playwright install chromium  # one-time browser setup
npx ai-browser-fetch https://example.com
```

**Install globally:**
```bash
npm install -g ai-browser-fetch
npx playwright install chromium  # one-time browser setup
ai-fetch https://example.com
```

**Clone and run locally:**
```bash
git clone https://github.com/JajaH4rem/ai-browser-fetch
cd ai-browser-fetch
npm install
npx playwright install chromium
node fetch.js https://example.com
```

> Chromium must be installed separately. If you see a "Chromium not found" error, run `npx playwright install chromium`.

---

## Quick start

```bash
npx ai-browser-fetch https://example.com
```

---

## Usage

```
node fetch.js <url> [flags]
```

### Output
| Flag | Description |
|------|-------------|
| *(default)* | Plain text (`innerText`) |
| `--json` | Structured JSON: `{success, url, title, status, contentType, timestamp, text, length}` |
| `--markdown` | Clean markdown via Readability, fallback to plain text |
| `--url` | Print final URL as first line (after redirects) |
| `--max-chars <n>` | Truncate output to N characters (from the start) |

### Rendering
| Flag | Description | Default |
|------|-------------|---------|
| `--wait <ms>` | Extra wait after page load | `0` |
| `--wait-for <selector>` | Wait until element appears | — |
| `--wait-until <event>` | `load` \| `networkidle` \| `domcontentloaded` | `load` |

### Content
| Flag | Description |
|------|-------------|
| `--selector <css>` | Extract a specific element only |

### Browser
| Flag | Description |
|------|-------------|
| `--stealth` | Enable stealth plugin to reduce bot detection on some sites |
| `--headed` | Open a visible browser window |
| `--ua <string>` | Set a custom user-agent string |
| `--no-ua` | Use the browser's default user-agent (skip spoofing) |
| `--screenshot <path>` | Save a screenshot after page load, before extraction |

### Reliability
| Flag | Description | Default |
|------|-------------|---------|
| `--retry <n>` | Retry on failure with escalating timeout | `1` |
| `--timeout <ms>` | Navigation timeout | `30000` |

---

## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Invalid arguments |
| `2` | Navigation timeout |
| `3` | Browser launch failed |
| `4` | Selector not found |
| `5` | Extraction failed |

---

## AI integration

The recommended fallback pattern for agents:

```
try HTTP fetch
       ↓
empty / JS-required / challenge page?
       ↓
node fetch.js <url>
       ↓
continue reasoning
```

**Claude Code** — add to memory or CLAUDE.md:
```
When WebFetch returns little or no useful content, use:
node /path/to/fetch.js <url> --json

If the result still looks empty or incomplete, retry with:
node /path/to/fetch.js <url> --json --wait-until networkidle --wait 3000
```

**Cursor** — add to system prompt:
```
If a webpage appears JS-rendered or returns no content, invoke ai-browser-fetch.
If initial fetch returns little content, retry with --wait-until networkidle --wait 3000.
```

**OpenAI Agents / Cline / Roo Code** — tool description:
```
Fallback browser fetch. Use when HTTP fetch returns empty or challenge content.
For heavily JS-driven pages, add --wait-until networkidle --wait 3000.
```

---

## Roadmap

- **Phase 1 — MVP** ✅: reliable browser-backed fetch, plain text output
- **Phase 2 — AI-friendly** ✅: `--json`, `--markdown`, `--url`, structured output
- **Phase 3 — Reliability** ✅: `--stealth`, `--ua`, `--no-ua`, `--headed`, `--screenshot`
- **Phase 4 — Advanced**: `--links`, `--metadata`, cookies, global `ai-fetch` binary

---

## License

MIT
