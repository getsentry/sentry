import type {LoaderDefinitionFunction} from '@rspack/core';

import {needsStylexTransform, transformStylex} from './stylex.ts';

/**
 * Compiles `stylex.create` and friends away in files that import
 * `@stylexjs/stylex`. Runs before swc; every other file passes through as is.
 */
const stylexLoader: LoaderDefinitionFunction = function (source, inputSourceMap) {
  if (!needsStylexTransform(source)) {
    return source;
  }

  const callback = this.async();
  transformStylex(source, this.resourcePath, {inputSourceMap})
    .then(({code, map}) => callback(null, code, map ?? undefined))
    .catch(error => callback(error));
  return undefined;
};

export default stylexLoader;
