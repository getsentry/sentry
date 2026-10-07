import type {LoaderDefinitionFunction} from '@rspack/core';

import {collectStylexCss, STYLEX_ROOTS} from './stylex.ts';

/**
 * Replaces the contents of `static/app/stylex.css` with the CSS for every
 * StyleX file under `STYLEX_ROOTS`.
 *
 * The rules are collected by compiling those files directly rather than from
 * the modules rspack happens to build, so the output is complete regardless
 * of lazy compilation or the persistent cache. Not cacheable: it runs on every
 * compilation and only re-compiles files whose mtime changed.
 */
const stylexCssLoader: LoaderDefinitionFunction = function () {
  this.cacheable(false);
  for (const root of STYLEX_ROOTS) {
    this.addContextDependency(root);
  }

  const callback = this.async();
  collectStylexCss()
    .then(css => callback(null, css))
    .catch(error => callback(error));
  return undefined;
};

export default stylexCssLoader;
