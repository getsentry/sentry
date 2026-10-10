import type {LoaderDefinitionFunction} from '@rspack/core';

import {needsLinariaTransform, transformLinaria} from './linaria.ts';

/** Compile class names before SWC. The CSS loader collects the extracted rules. */
const linariaLoader: LoaderDefinitionFunction = function (source) {
  if (!needsLinariaTransform(source)) {
    return source;
  }
  const callback = this.async();
  transformLinaria(source, this.resourcePath)
    .then(({code, sourceMap}) => callback(null, code, sourceMap ?? undefined))
    .catch(error => callback(error));
  return undefined;
};

export default linariaLoader;
