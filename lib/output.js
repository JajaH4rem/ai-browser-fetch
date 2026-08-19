'use strict';

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

module.exports = { emitJson };
