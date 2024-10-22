/* eslint-env node */

const crypto = require('node:crypto');
const peggy = require('peggy');

function getCacheKey(fileData, _filePath, config, _options) {
  return crypto
    .createHash('md5')
    .update(fileData)
    .update(config.configString)
    .digest('hex');
}

function process(sourceText) {
  return {
    code: `module.exports = ${peggy.generate(sourceText, {output: 'source'})}`,
  };
}

module.exports = {getCacheKey, process};
