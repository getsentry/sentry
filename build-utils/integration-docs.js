/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
const fs = require('fs');
const https = require('https');
const path = require('path');

const PLATFORMS_URL = 'https://docs.sentry.io/_platforms/_index.json';
const DOCS_FIXTURE_PATH = 'tests/fixtures/integration-docs/_platforms.json';

const {env} = process;
const IS_TEST = env.NODE_ENV === 'test' || env.TEST_SUITE;
const IS_STORYBOOK = env.STORYBOOK_BUILD === '1';

const alphaSortFromKey = function(keyExtractor) {
  return function(a, b) {
    const nameA = keyExtractor(a);
    const nameB = keyExtractor(b);
    if (nameA < nameB) {
      return -1;
    }
    if (nameA > nameB) {
      return 1;
    }

    // names must be equal
    return 0;
  };
};

const transformPlatformsToList = ({platforms}) =>
  Object.keys(platforms)
    .map(platformId => {
      const integrationMap = platforms[platformId];
      const integrations = Object.keys(integrationMap)
        .sort(alphaSortFromKey(key => integrationMap[key].name))
        .map(integrationId => {
          const {name, type, doc_link: link} = integrationMap[integrationId];
          const id =
            integrationId === '_self' ? platformId : `${platformId}-${integrationId}`;
          return {
            id,
            name,
            type,
            link,
          };
        });
      return {
        id: platformId,
        name: integrationMap._self.name,
        integrations,
      };
    })
    .sort(alphaSortFromKey(item => item.name));

let __cache = null;

const fromLocal = (basePath, callback) =>
  fs.readFile(path.join(basePath, DOCS_FIXTURE_PATH), (err, contents) =>
    callback(err, (__cache = contents))
  );

const fromRemote = (_basePath, callback) =>
  https
    .get(PLATFORMS_URL, res => {
      res.setEncoding('utf8');
      let buffer = '';
      res
        .on('data', data => {
          buffer += data;
        })
        .on('end', () =>
          callback(
            null,
            (__cache = JSON.stringify({
              platforms: transformPlatformsToList(JSON.parse(buffer)),
            }))
          )
        );
    })
    .on('error', callback);

const fetcher = IS_TEST || IS_STORYBOOK ? fromLocal : fromRemote;
module.exports = (basePath, callback) =>
  __cache !== null ? __cache : fetcher(basePath, callback);
