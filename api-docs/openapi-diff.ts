/* global process */
/* eslint import/no-nodejs-modules:0 */
/* eslint import/no-unresolved:0 */

const fs = require('fs');
const yaml = require('js-yaml');
const jsonDiff = require('json-diff');
const https = require('https');

async function main() {
  const request = new Promise((resolve, reject) =>
    https.get(
      `https://raw.githubusercontent.com/getsentry/sentry-api-schema/main/openapi-derefed.json`,
      res => {
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', chunk => (rawData += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(rawData));
          } catch (e) {
            reject(e.message);
          }
        });
      }
    )
  );

  const openApiData = await request;
  const readFile = fs.readFileSync('tests/apidocs/openapi-derefed.json', 'utf8');
  const target = yaml.safeLoad(readFile);

  // eslint-disable-next-line no-console
  console.log('JSON DIFF: ', jsonDiff.diffString(openApiData, target));
}

main();
