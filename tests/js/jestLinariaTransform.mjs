// @ts-nocheck
/* eslint-disable import/no-nodejs-modules */
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

import {createTransformer} from '@swc/jest';

const linariaTransformer = {
  createTransformer(options) {
    const transformer = createTransformer(options);
    return {
      ...transformer,
      getCacheKey(source, filename, config) {
        return `linaria-8.2.0-wyw-2.5.1-${transformer.getCacheKey(source, filename, config)}`;
      },
      process(source, filename, config) {
        if (/from ['"]@linaria\/core['"]/.test(source) && /css\s*`/.test(source)) {
          const result = JSON.parse(
            execFileSync(
              process.execPath,
              [
                path.resolve(
                  import.meta.dirname,
                  '../../build-utils/linaria-test-compile.mjs'
                ),
                filename,
              ],
              {input: source, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024}
            )
          );
          // Test the extracted CSS rather than Linaria's mock css tag. The app
          // receives the combined stylesheet through linaria-css-loader.
          source = result.code;
          if (result.cssText) {
            source += `\nif (typeof document !== 'undefined') {const sheet = document.createElement('style'); sheet.textContent = ${JSON.stringify(result.cssText)}; document.head.appendChild(sheet);}`;
          }
        }
        return transformer.process(source, filename, config);
      },
    };
  },
};

// Jest loads transformer modules through their default export.
// eslint-disable-next-line @sentry/no-default-exports
export default linariaTransformer;
