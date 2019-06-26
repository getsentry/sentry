/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
const fs = require('fs');
const https = require('https');
const path = require('path');
const util = require('util');

const fsWriteFile = util.promisify(fs.writeFile);
const PLATFORMS_URL = 'https://docs.sentry.io/_platforms/_index.json';
const DOCS_INDEX_PATH = 'src/sentry/integration-docs/_platforms.json';
const DOCS_FIXTURE_PATH = 'tests/fixtures/integration-docs/_platforms.json';

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

const PLUGIN_NAME = 'IntegrationDocsResolver';

class IntegrationDocsResolver {
  constructor(options) {
    this.options = options;
    if (!this.options.moduleName) {
      this.options.moduleName = 'integration-docs-platforms';
    }
    this.resolve = this.options.local ? this._resovleLocal : this._resolveRemote;
  }
  async _resovleLocal() {
    return path.join(this.options.baseDir, DOCS_FIXTURE_PATH);
  }
  async _resolveRemote() {
    return new Promise((resolve, reject) =>
      https
        .get(PLATFORMS_URL, res => {
          res.setEncoding('utf8');
          let buffer = '';
          res
            .on('data', data => {
              buffer += data;
            })
            .on('end', async () => {
              const modulePath = path.join(this.options.baseDir, DOCS_INDEX_PATH);
              await fsWriteFile(
                modulePath,
                JSON.stringify({
                  platforms: transformPlatformsToList(JSON.parse(buffer)),
                })
              );
              resolve(modulePath);
            });
        })
        .on('error', reject)
    );
  }
  apply(resolver) {
    const target = resolver.ensureHook('resolve');

    resolver
      .getHook('described-resolve')
      .tapPromise(PLUGIN_NAME, async (request, resolveContext) => {
        const innerRequest = request.request || request.path;
        if (innerRequest !== 'integration-docs-platforms') {
          return;
        }

        const resolvedPath = await this.resolve();

        // eslint-disable-next-line consistent-return
        return util.promisify(resolver.doResolve.bind(resolver))(
          target,
          {...request, request: resolvedPath},
          'using path: ' + resolvedPath,
          resolveContext
        );
      });
  }
}

module.exports = IntegrationDocsResolver;
