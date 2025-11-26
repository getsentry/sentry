'use strict';

// @ts-expect-error csv-parser has no types
const csv = require('csv-parser');
const fs = require('node:fs');

/**
 * Transform CSV results into device mapping object
 * @param {Array<{name: string, model: string}>} res - Array of device objects
 * @returns {Record<string, string>} Device mapping where key is model and value is name
 */
const transformResults = res => {
  /** @type {Record<string, string>} */
  const deviceMapping = {};
  res.forEach(({name, model}) => {
    if (name && model) {
      deviceMapping[model] = name;
    }
  });
  return deviceMapping;
};
/** @type {Array<{name: string, model: string}>} */
const results = [];
fs.createReadStream('supported_devices.csv')
  .pipe(csv())
  .on('data', /** @param {any} data */ data => results.push(data))
  .on('end', () => {
    fs.writeFileSync('devices.json', JSON.stringify(transformResults(results)));
  });
