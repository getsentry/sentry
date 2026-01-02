'use strict';

const nodeCrypto = require('node:crypto');
const peggy = require('peggy');

/**
 * Generate cache key for Jest transformer
 * @param {string} fileData - The file content to transform
 * @param {string} _filePath - Path to the file (unused)
 * @param {Object} config - Jest configuration object
 * @param {string} config.configString - Stringified Jest config
 * @param {Object} _options - Transform options (unused)
 * @returns {string} MD5 hash for cache key
 */
function getCacheKey(fileData, _filePath, config, _options) {
  return nodeCrypto
    .createHash('md5')
    .update(fileData)
    .update(config.configString)
    .digest('hex');
}

/**
 * Transform PEG.js grammar file into JavaScript module
 * @param {string} sourceText - The PEG.js grammar source code
 * @returns {{code: string}} Transform result with generated JavaScript module code
 */
function process(sourceText) {
  return {
    code: `module.exports = ${peggy.generate(sourceText, {output: 'source'})}`,
  };
}

module.exports = {getCacheKey, process};
