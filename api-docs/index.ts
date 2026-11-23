import fs from 'node:fs';
import path from 'node:path';

import JsonRefs from 'json-refs';
import {parse} from 'yaml';

function dictToString(dict) {
  const res: string[] = [];
  for (const [k, v] of Object.entries(dict)) {
    res.push(`${k}: ${v}`);
  }
  return res.join('\n');
}

// Extensions that only the response coverage check reads: the Python source of a
// TypedDict field, the marker on a recursive TypedDict cut short, and the marker on a
// JsonValue field.
const COVERAGE_EXTENSIONS = ['x-sentry-source', 'x-sentry-cycle', 'x-sentry-json-value'];

function stripCoverageExtensions(node: unknown) {
  if (Array.isArray(node)) {
    node.forEach(stripCoverageExtensions);
  } else if (node && typeof node === 'object') {
    for (const key of COVERAGE_EXTENSIONS) {
      delete (node as Record<string, unknown>)[key];
    }
    Object.values(node).forEach(stripCoverageExtensions);
  }
}

function bundle(originalFile) {
  const root = parse(fs.readFileSync(originalFile, 'utf8'));
  stripCoverageExtensions(root);
  const options = {
    filter: ['relative', 'remote', 'local'],
    resolveCirculars: true,
    location: originalFile,
    loaderOptions: {
      processContent: function (res, callback) {
        callback(undefined, parse(res.text));
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

let originalFile: any;
let targetDirValue: any;

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
