const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const process = require('process');

const getCacheKeyFunction = require('@jest/create-cache-key-function').default;
const {transform, transformSync} = require('@swc/core');

function createTransformer(swcTransformOpts) {
  const computedSwcOptions = buildSwcTransformOpts(swcTransformOpts);
  const cacheKeyFunction = getCacheKeyFunction([], [JSON.stringify(computedSwcOptions)]);
  const {enabled: canInstrument, ...instrumentOptions} =
    swcTransformOpts?.experimental?.customCoverageInstrumentation ?? {};
  return {
    canInstrument: !!canInstrument,
    process(src, filename, jestOptions) {
      // Determine if we actually instrument codes if jest runs with --coverage
      insertInstrumentationOptions(
        jestOptions,
        !!canInstrument,
        computedSwcOptions,
        instrumentOptions
      );
      return transformSync(src, {
        ...computedSwcOptions,
        module: {
          ...computedSwcOptions.module,
          type: jestOptions.supportsStaticESM ? 'es6' : 'commonjs',
        },
        filename,
      });
    },
    processAsync(src, filename, jestOptions) {
      insertInstrumentationOptions(
        jestOptions,
        !!canInstrument,
        computedSwcOptions,
        instrumentOptions
      );
      return transform(src, {
        ...computedSwcOptions,
        module: {
          ...computedSwcOptions.module,
          // async transform is always ESM
          type: 'es6',
        },
        filename,
      });
    },
    getCacheKey(src, filename, ...rest) {
      // @ts-expect-error - type overload is confused
      const baseCacheKey = cacheKeyFunction(src, filename, ...rest);
      // @ts-expect-error - signature mismatch between Jest <27 og >=27
      const options = typeof rest[0] === 'string' ? rest[1] : rest[0];
      return crypto
        .createHash('md5')
        .update(baseCacheKey)
        .update('\0', 'utf8')
        .update(JSON.stringify({supportsStaticESM: options.supportsStaticESM}))
        .digest('hex');
    },
  };
}
function getOptionsFromSwrc() {
  const swcrc = path.join(process.cwd(), '.swcrc');
  if (fs.existsSync(swcrc)) {
    return JSON.parse(fs.readFileSync(swcrc, 'utf-8'));
  }
  return {};
}
const nodeTargetDefaults = new Map([
  ['12', 'es2018'],
  ['13', 'es2019'],
  ['14', 'es2020'],
  ['15', 'es2021'],
  ['16', 'es2021'],
  ['17', 'es2022'],
]);
function buildSwcTransformOpts(computedSwcOptions) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  if (!computedSwcOptions.jsc?.target) {
    set(
      computedSwcOptions,
      'jsc.target',
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      nodeTargetDefaults.get(process.version.match(/v(\d+)/)[1]) || 'es2018'
    );
  }
  set(computedSwcOptions, 'jsc.transform.hidden.jest', true);
  if (!computedSwcOptions.sourceMaps) {
    set(computedSwcOptions, 'sourceMaps', 'inline');
  }
  return computedSwcOptions;
}
function insertInstrumentationOptions(
  jestOptions,
  canInstrument,
  swcTransformOpts,
  instrumentOptions
) {
  const shouldInstrument = jestOptions.instrument && canInstrument;
  if (!shouldInstrument) {
    return swcTransformOpts;
  }
  if (
    swcTransformOpts?.jsc?.experimental?.plugins?.some(
      x => x[0] === 'swc-plugin-coverage-instrument'
    )
  ) {
    return;
  }
  if (!swcTransformOpts.jsc) {
    swcTransformOpts.jsc = {};
  }
  if (!swcTransformOpts.jsc.experimental) {
    swcTransformOpts.jsc.experimental = {};
  }
  if (!Array.isArray(!swcTransformOpts.jsc.experimental.plugins)) {
    swcTransformOpts.jsc.experimental.plugins = [];
  }
  swcTransformOpts.jsc.experimental.plugins?.push([
    'swc-plugin-coverage-instrument',
    instrumentOptions ?? {},
  ]);
}
function set(obj, path, value) {
  let o = obj;
  const parents = path.split('.');
  const key = parents.pop();
  for (const prop of parents) {
    if (o[prop] == null) {
      o[prop] = {};
    }
    o = o[prop];
  }
  o[key] = value;
}

module.exports = createTransformer({
  jsc: {
    parser: {
      syntax: 'typescript',
      decorators: true,
      jsx: true,
      tsx: true,
      target: 'es2022',
    },
    transform: {
      // babel legacy decorator support
      legacyDecorator: true,
      react: {
        runtime: 'automatic',
        importSource: '@emotion/core',
      },
    },
    experimental: {
      plugins: [
        [
          'emotion-swc-plugin',
          {
            sourceMap: true,
            autoLabel: 'always',
          },
        ],
      ],
    },
  },
  module: {
    type: 'commonjs',
  },
});
