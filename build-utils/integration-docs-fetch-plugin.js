/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
const fs = require('fs');
const https = require('https');
const path = require('path');

const PLATFORMS_URL = 'https://docs.sentry.io/_platforms/_index.json';
const DOCS_INDEX_PATH = 'src/sentry/integration-docs/_platforms.json';

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

class IntegrationDocsFetchPlugin {
  constructor({basePath}) {
    this.modulePath = path.join(basePath, DOCS_INDEX_PATH);
  }
  apply(compiler) {
    compiler.hooks.beforeRun.tapAsync(
      'IntegrationDocsFetchPlugin',
      (compilation, callback) => {
        https
          .get(PLATFORMS_URL, res => {
            res.setEncoding('utf8');
            let buffer = '';
            res
              .on('data', data => {
                buffer += data;
              })
              .on('end', () =>
                fs.writeFile(
                  this.modulePath,
                  JSON.stringify({
                    platforms: transformPlatformsToList(JSON.parse(buffer)),
                  }),
                  callback
                )
              );
          })
          .on('error', callback);
      }
    );
  }
}

module.exports = IntegrationDocsFetchPlugin;
