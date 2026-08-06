const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const SCRIPT = path.join(__dirname, 'fetch.js');

function run(args, timeout = 30000) {
  return spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8', timeout });
}

describe('core fetch', () => {
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
