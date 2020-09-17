/* global process */
/* eslint import/no-nodejs-modules:0 */

const fs = require('fs');
const path = require('path');

const JsonRefs = require('json-refs');
const yaml = require('js-yaml');

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
    filter: ['relative', 'remote'],
    resolveCirculars: true,
    location: originalFile,
    loaderOptions: {
      processContent: function(res, callback) {
        callback(undefined, yaml.safeLoad(res.text));
      },
    },
  };
  JsonRefs.clearCache();
  return JsonRefs.resolveRefs(root, options).then(
    function(results) {
      const resErrors = {};
      for (const [k, v] of Object.entries(results.refs)) {
        if (
          'missing' in v &&
          v.missing === true &&
          (v.type === 'relative' || v.type === 'remote')
        )
          resErrors[k] = v.error;
      }

      if (Object.keys(resErrors).length > 0) {
        return Promise.reject(dictToString(resErrors));
      }

      return results.resolved;
    },
    function(e) {
      const error = {};
      Object.getOwnPropertyNames(e).forEach(function(key) {
        error[key] = e[key];
      });
      return Promise.reject(dictToString(error));
    }
  );
}

function build(originalFile, _, bundleTo) {
  bundle(originalFile).then(
    function(bundled) {
      const bundleString = JSON.stringify(bundled, null, 2);
      if (typeof bundleTo === 'string') {
        fs.writeFile(bundleTo, bundleString, function(err) {
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
    function(err) {
      // eslint-disable-next-line no-console
      console.log(err);
    }
  );
}

let originalFile;
let targetDirValue;

const argv = process.argv.slice(2);

originalFile = argv[0];
const derefedFile = argv[1];

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
