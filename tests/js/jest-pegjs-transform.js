'use strict';

function getCacheKey(fileData, _filePath, config, _options) {
  return require('node:crypto')
    .createHash('md5')
    .update(fileData)
    .update(config.configString)
    .digest('hex');
}

function process(sourceText) {
  return {
    code: `module.exports = ${require('peggy').generate(sourceText, {output: 'source'})}`,
  };
}

module.exports = {getCacheKey, process};
