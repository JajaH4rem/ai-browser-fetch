const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const SCRIPT = path.join(__dirname, 'fetch.js');

function run(args, timeout = 30000) {
  return spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8', timeout });
}

describe('core fetch', () => {
  // existing tests unchanged below
  it('exits with code 1 and prints usage when no URL given', () => {
    const result = run([]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage:/);
  });

  it('exits with code 1 on an invalid URL', () => {
    const result = run(['not-a-url']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Invalid URL/);
  });

  it('fetches a real page and returns text content', () => {
    // Uses example.com — stable, static, no JS required
    const result = run(['https://example.com', '--retry', '0'], 30000);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Example Domain/);
  });

  it('exits with code 2 on navigation timeout', () => {
    // Non-routable IP forces a timeout
    const result = spawnSync(
      'node',
      [SCRIPT, 'http://10.255.255.1', '--timeout', '3000', '--retry', '0'],
      { encoding: 'utf8', timeout: 15000 }
    );
    assert.equal(result.status, 2);
  });
});

describe('--max-chars', () => {
  it('truncates output to the specified number of characters', () => {
    const result = run(['https://example.com', '--retry', '0', '--max-chars', '10'], 30000);
    assert.equal(result.status, 0);
    assert.ok(result.stdout.length <= 11); // 10 chars + newline
  });

  it('does not truncate when output is shorter than --max-chars', () => {
    const result = run(['https://example.com', '--retry', '0', '--max-chars', '99999'], 30000);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Example Domain/);
  });
});

describe('--selector', () => {
  it('extracts only the matched element text', () => {
    const result = run(['https://example.com', '--retry', '0', '--selector', 'h1'], 30000);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Example Domain/);
    // h1 text only — should not contain paragraph text
    assert.doesNotMatch(result.stdout, /More information/);
  });

  it('exits with code 4 when selector matches nothing', () => {
    const result = run(
      ['https://example.com', '--retry', '0', '--selector', '#does-not-exist-xyz'],
      30000
    );
    assert.equal(result.status, 4);
  });
});

describe('--wait', () => {
  it('accepts --wait flag without error', () => {
    // Just verify the flag is accepted and fetch succeeds — timing is hard to assert
    const result = run(['https://example.com', '--retry', '0', '--wait', '500'], 30000);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Example Domain/);
  });
});

describe('--wait-for', () => {
  it('succeeds when the selector appears on the page', () => {
    const result = run(['https://example.com', '--retry', '0', '--wait-for', 'h1'], 30000);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Example Domain/);
  });

  it('exits with code 2 when --wait-for selector never appears', () => {
    const result = run(
      ['https://example.com', '--retry', '0', '--wait-for', '#never-exists-xyz', '--wait-for-timeout', '2000'],
      30000
    );
    assert.equal(result.status, 2);
  });
});

describe('--json', () => {
  it('outputs valid JSON with required fields on success', () => {
    const result = run(['https://example.com', '--retry', '0', '--json'], 30000);
    assert.equal(result.status, 0);
    const json = JSON.parse(result.stdout);
    assert.equal(json.success, true);
    assert.equal(typeof json.url, 'string');
    assert.equal(typeof json.title, 'string');
    assert.equal(typeof json.text, 'string');
    assert.equal(typeof json.length, 'number');
    assert.equal(typeof json.timestamp, 'string');
    assert.match(json.text, /Example Domain/);
  });

  it('includes status code', () => {
    const result = run(['https://example.com', '--retry', '0', '--json'], 30000);
    const json = JSON.parse(result.stdout);
    assert.equal(json.status, 200);
  });

  it('outputs JSON with success:false on navigation failure, no text/length fields', () => {
    const result = spawnSync(
      'node',
      [SCRIPT, 'http://10.255.255.1', '--timeout', '3000', '--retry', '0', '--json'],
      { encoding: 'utf8', timeout: 15000 }
    );
    assert.equal(result.status, 2);
    const json = JSON.parse(result.stdout);
    assert.equal(json.success, false);
    assert.equal(typeof json.error, 'string');
    assert.equal(json.text, undefined);
    assert.equal(json.length, undefined);
  });

  it('text field contains markdown when --json and --markdown combined', () => {
    const result = run(['https://example.com', '--retry', '0', '--json', '--markdown'], 30000);
    assert.equal(result.status, 0);
    const json = JSON.parse(result.stdout);
    assert.equal(json.success, true);
    assert.match(json.text, /Example Domain/);
  });
});

describe('--markdown', () => {
  it('returns content as markdown', () => {
    const result = run(['https://example.com', '--retry', '0', '--markdown'], 30000);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Example Domain/);
  });
});

describe('--url', () => {
  it('prints final URL on its own line without a prefix', () => {
    const result = run(['https://example.com', '--retry', '0', '--url'], 30000);
    assert.equal(result.status, 0);
    const lines = result.stdout.split('\n');
    // First line must be the bare URL, no "URL: " prefix
    assert.match(lines[0], /^https:\/\/example\.com/);
  });
});

describe('--json + --max-chars', () => {
  it('length field reflects truncated text length', () => {
    const result = run(['https://example.com', '--retry', '0', '--json', '--max-chars', '20'], 30000);
    assert.equal(result.status, 0);
    const json = JSON.parse(result.stdout);
    assert.equal(json.text.length, 20);
    assert.equal(json.length, 20);
  });
});

describe('--json + --selector not found', () => {
  it('outputs JSON error when selector matches nothing', () => {
    const result = run(
      ['https://example.com', '--retry', '0', '--json', '--selector', '#does-not-exist-xyz'],
      30000
    );
    assert.equal(result.status, 4);
    const json = JSON.parse(result.stdout);
    assert.equal(json.success, false);
    assert.equal(typeof json.error, 'string');
  });
});
