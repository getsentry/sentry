import yaml from 'js-yaml';
import jsonDiff from 'json-diff';
import fs from 'node:fs';
import https from 'node:https';

async function main() {
  const openApiData = await new Promise((resolve, reject) =>
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

  const readFile = fs.readFileSync('tests/apidocs/openapi-derefed.json', 'utf8');
  // @ts-expect-error: Types do not match the version of js-yaml installed
  const target = yaml.safeLoad(readFile);

  // eslint-disable-next-line no-console
  console.log(jsonDiff.diffString(openApiData, target));
}

main();
