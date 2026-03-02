'use strict';

//
// This script is intended to be used to extract the device names from the supported_devices.csv file.
// The mapping is necessary to translate device models to their more human readable marketing names during query time for several discover events and tags endpoints.
// The supported_devices.csv file is obtained from this link: https://support.google.com/googleplay/answer/1727131
// Steps on how to generate this mapping
// 1. Download the List of Supported Android Devices csv file (https://storage.googleapis.com/play_public/supported_devices.csv)
// 2. Run this script to convert the contents of the csv to a dict
// 3. Paste dict into src/sentry/api/helpers/android_models.py
//

const fs = require('node:fs');

const LF = String.fromCharCode(10);

/**
 * Transform CSV results into device mapping object
 * @param {Array<{name: string, model: string}>} res - Array of device objects
 * @returns {Record<string, string>} Device mapping where key is model and value is name
 */
const transformResults = res => {
  /** @type {Record<string, string>} */
  const deviceMapping = {};
  res.forEach(({name, model}) => {
    if (name && model && name !== model) {
      deviceMapping[model] = name;
    }
  });
  return deviceMapping;
};

/**
 * Parse a CSV line
 * @param {string} line
 * @returns {string[]}
 */
const parseCsvLine = line => {
  /** @type {string[]} */
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
};

const content = fs.readFileSync('supported_devices.csv');
const text = content.toString('utf16le').slice(1);
const lines = text.split(LF);

const headers = parseCsvLine(lines[0]);

const nameIdx = headers.indexOf('Marketing Name');
const modelIdx = headers.indexOf('Model');

if (nameIdx === -1 || modelIdx === -1) {
  console.error('Could not find "Marketing Name" or "Model" columns in CSV headers');
  console.error('Found headers:', headers);
  process.exit(1);
}

/** @type {Array<{name: string, model: string}>} */
const results = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) {
    continue;
  }
  const fields = parseCsvLine(line);
  results.push({name: fields[nameIdx], model: fields[modelIdx]});
}

fs.writeFileSync('devices.json', JSON.stringify(transformResults(results), null, 4));
