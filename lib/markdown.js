'use strict';

const MIN_READABLE_CHARS = 200;

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

module.exports = { toMarkdown };
