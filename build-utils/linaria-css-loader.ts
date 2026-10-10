import type {LoaderDefinitionFunction} from '@rspack/core';

import {collectLinariaCss, LINARIA_ROOTS} from './linaria.ts';

/** Collect all migrated components, including components in lazy chunks. */
const linariaCssLoader: LoaderDefinitionFunction = function () {
  this.cacheable(false);
  for (const root of LINARIA_ROOTS) {
    this.addContextDependency(root);
  }
  const callback = this.async();
  collectLinariaCss()
    .then(css => callback(null, css))
    .catch(error => callback(error));
  return undefined;
};

export default linariaCssLoader;
