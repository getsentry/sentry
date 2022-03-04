/* global process */
/* eslint import/no-nodejs-modules:0 */
/* eslint import/no-unresolved:0 */
import fs from 'fs';
import path from 'path';

import yaml from 'js-yaml';
import JsonRefs from 'json-refs';

function dictToString(dict) {
  const res = [];
  for (const [k, v] of Object.entries(dict)) {
    res.push(`${k}: ${v}`);
  }
  return res.join('\n');
}

function bundle(originalFile) {
  const root = yaml.safeLoad(fs.readFileSync(originalFile, 'utf8'));
  const options = {
    filter: ['relative', 'remote', 'local'],
    resolveCirculars: true,
    location: originalFile,
    loaderOptions: {
      processContent: function (res, callback) {
        callback(undefined, yaml.safeLoad(res.text));
      },
    },
  };
  JsonRefs.clearCache();
  return JsonRefs.resolveRefs(root, options).then(
    function (results) {
      const resErrors = {};
      for (const [k, v] of Object.entries(results.refs)) {
        if (
          'missing' in v &&
          v.missing === true &&
          (v.type === 'relative' || v.type === 'remote')
        ) {
          resErrors[k] = v.error;
        }
      }
      if (Object.keys(resErrors).length > 0) {
        return Promise.reject(new Error(dictToString(resErrors)));
      }

      return results.resolved;
    },
    function (e) {
      const error = {};
      Object.getOwnPropertyNames(e).forEach(function (key) {
        error[key] = e[key];
      });
      return Promise.reject(new Error(dictToString(error)));
    }
  );
}

function build(originalFile, _, bundleTo) {
  bundle(originalFile).then(
    function (bundled) {
      const bundleString = JSON.stringify(bundled, null, 2);
      if (typeof bundleTo === 'string') {
        fs.writeFile(bundleTo, bundleString, function (err) {
          if (err) {
            // eslint-disable-next-line no-console
            console.log(err);
            return;
          }
          // eslint-disable-next-line no-console
          console.log('Saved bundle file at ' + bundleTo);
        });
      }
    },
    function (err) {
      // eslint-disable-next-line no-console
      console.log(err);
    }
  );
}

let originalFile;
let targetDirValue;

const argv = process.argv.slice(2);

originalFile = argv[0];
const derefedFile = argv[1] || 'tests/apidocs/openapi-derefed.json';

try {
  if (!path.isAbsolute(originalFile)) {
    originalFile = path.resolve(process.cwd(), originalFile);
  }
  targetDirValue = path.dirname(originalFile);
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(`Failed to resolve path to [targetDir].`);
  process.exit(1);
}

build(originalFile, targetDirValue, derefedFile);
