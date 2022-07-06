/* eslint-env node */

// eslint-disable-next-line import/no-nodejs-modules
const crypto = require('crypto');
const peg = require('pegjs');

function getCacheKey(fileData, _filePath, config, _options) {
  return crypto
    .createHash('md5')
    .update(fileData)
    .update(config.configString)
    .digest('hex');
}

function process(sourceText) {
  return {
    code: `module.exports = ${peg.generate(sourceText, {output: 'source'})}`,
  };
}

module.exports = {getCacheKey, process};
