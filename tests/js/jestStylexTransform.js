'use strict';

import swcJest from '@swc/jest';

// Shares the StyleX compilation settings with the rspack loaders.
// eslint-disable-next-line import/no-relative-parent-imports, boundaries/dependencies
import {needsStylexTransform, transformStylexSync} from '../../build-utils/stylex.ts';

const TRANSFORM_VERSION = 'stylex-v1';

/**
 * Wraps @swc/jest: files that import `@stylexjs/stylex` are compiled with the
 * StyleX babel plugin first. Styles are injected at runtime so jsdom sees them.
 *
 * @param {import('@swc/core').Options} swcOptions
 */
function createTransformer(swcOptions) {
  /** @type {import('@jest/transform').SyncTransformer} */
  const swc = /** @type {any} */ (swcJest.createTransformer(swcOptions));

  return {
    canInstrument: swc.canInstrument,
    /**
     * @param {string} sourceText
     * @param {string} sourcePath
     * @param {import('@jest/transform').TransformOptions} options
     */
    getCacheKey(sourceText, sourcePath, options) {
      const key = swc.getCacheKey?.(sourceText, sourcePath, options) ?? '';
      return needsStylexTransform(sourceText) ? `${key}:${TRANSFORM_VERSION}` : key;
    },
    /**
     * @param {string} sourceText
     * @param {string} sourcePath
     * @param {import('@jest/transform').TransformOptions} options
     */
    process(sourceText, sourcePath, options) {
      const source =
        needsStylexTransform(sourceText) && !sourcePath.includes('node_modules')
          ? transformStylexSync(sourceText, sourcePath, {runtimeInjection: true}).code
          : sourceText;
      return swc.process(source, sourcePath, options);
    },
  };
}

const jestStylexTransform = {createTransformer};

// Jest loads transformers through their default export.
// eslint-disable-next-line @sentry/no-default-exports
export default jestStylexTransform;
