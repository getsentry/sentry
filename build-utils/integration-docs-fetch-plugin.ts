/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */

import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import url from 'url';

import webpack from 'webpack';

const INTEGRATIONS_DOC_URL =
  process.env.INTEGRATION_DOCS_URL || 'https://docs.sentry.io/_platforms/';
const PLATFORMS_URL = INTEGRATIONS_DOC_URL + '_index.json';
const DOCS_INDEX_PATH = 'src/sentry/integration-docs/_platforms.json';

const alphaSortFromKey =
  <T>(keyExtractor: (key: T) => string) =>
  (a: T, b: T) =>
    keyExtractor(a).localeCompare(keyExtractor(b));

type Platform = {
  aliases: string[];
  categories: string[];
  details: string;
  doc_link: string;
  key: string;
  name: string;
  type: 'language' | 'framework';
};

type PlatformItem = {_self: Platform} & Record<string, Platform>;

type PlatformsData = {
  platforms: Record<string, PlatformItem>;
};

const transformPlatformsToList = ({platforms}: PlatformsData) =>
  Object.keys(platforms)
    .map(platformId => {
      const integrationMap = platforms[platformId];
      const integrations = Object.keys(integrationMap)
        .sort(alphaSortFromKey(key => integrationMap[key].name))
        .map(integrationId => {
          const {name, type, doc_link: link} = integrationMap[integrationId];
          const id =
            integrationId === '_self' ? platformId : `${platformId}-${integrationId}`;

          return {id, name, type, link};
        });
      return {
        id: platformId,
        name: integrationMap._self.name,
        integrations,
      };
    })
    .sort(alphaSortFromKey(item => item.name));

class IntegrationDocsFetchPlugin {
  modulePath: string;
  hasRun: boolean;

  constructor({basePath}) {
    this.modulePath = path.join(basePath, DOCS_INDEX_PATH);
    this.hasRun = false;
    const moduleDir = path.dirname(this.modulePath);
    if (!fs.existsSync(moduleDir)) {
      fs.mkdirSync(moduleDir, {recursive: true});
    }
  }

  fetch: Parameters<webpack.Compiler['hooks']['beforeRun']['tapAsync']>[1] = (
    _compilation,
    callback
  ) => {
    let httpClient = https;
    if (url.parse(PLATFORMS_URL).protocol === 'http:') {
      // @ts-ignore
      httpClient = http;
    }
    return httpClient
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
  };

  apply(compiler: webpack.Compiler) {
    compiler.hooks.beforeRun.tapAsync('IntegrationDocsFetchPlugin', this.fetch);

    compiler.hooks.watchRun.tapAsync(
      'IntegrationDocsFetchPlugin',
      (compilation, callback) => {
        // Only run once when watching and only if it does not exist on fs
        if (this.hasRun || fs.existsSync(this.modulePath)) {
          callback();
          return;
        }

        this.fetch(compilation, callback);
        this.hasRun = true;
      }
    );
  }
}

export default IntegrationDocsFetchPlugin;
