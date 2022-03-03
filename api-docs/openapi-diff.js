/* global process */
/* eslint import/no-nodejs-modules:0 */
/* eslint import/no-unresolved:0 */

const fs = require('fs');
const yaml = require('js-yaml');

const jsonDiff = require('json-diff');

const https = require('https');

let sentry_api_schema_docs;
https.get(
  `https://raw.githubusercontent.com/getsentry/sentry-api-schema/main/openapi-derefed.json`,
  res => {
    res.setEncoding('utf8');
    let rawData = '';
    res.on('data', chunk => {
      rawData += chunk;
    });
    res.on('end', () => {
      try {
        const parsedData = JSON.parse(rawData);
        sentry_api_schema_docs = parsedData;
        // console.log('PARSED DATA: ', parsedData);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e.message);
      }
    });
  }
);

const file = 'tests/apidocs/openapi-derefed.json';
target = yaml.safeLoad(fs.readFileSync(file, 'utf8'));

// eslint-disable-next-line no-console
console.log('JSON DIFF: ', jsonDiff.diff(sentry_api_schema_docs, target));
