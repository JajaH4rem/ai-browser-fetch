#!/usr/bin/env node
// Minimal UA echo server for testing --ua and --no-ua flags.
// Responds to any request with the User-Agent header as plain text.
// Usage: node test-ua-server.js <port>
'use strict';
const http = require('http');
const port = Number(process.argv[2]) || 9877;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<html><body>${req.headers['user-agent'] || 'no-ua'}</body></html>`);
});
server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`ready:${port}\n`);
});
