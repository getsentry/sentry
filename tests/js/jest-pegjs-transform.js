'use strict';

import {createHash} from 'node:crypto';

import peggy from 'peggy';

const TRANSFORM_VERSION = 'peggy-allowed-start-rules-v1';
const ALLOWED_START_RULES_DIRECTIVE = /@peggy-loader\s+allowedStartRules:\s*([^\n]+)/;

/**
 * @param {string} sourceText
 * @returns {string[]}
 */
function getAllowedStartRules(sourceText) {
  const match = sourceText.match(ALLOWED_START_RULES_DIRECTIVE);
  const directiveValue = match?.[1];
  if (directiveValue) {
    return directiveValue
      .split(',')
      .map(rule => rule.trim())
      .filter(Boolean);
  }
  return [];
}

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
  return createHash('md5')
    .update(TRANSFORM_VERSION)
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
    code: `module.exports = ${peggy.generate(sourceText, {allowedStartRules: getAllowedStartRules(sourceText), output: 'source'})}`,
  };
}

const transform = {getCacheKey, process};

export default transform;
