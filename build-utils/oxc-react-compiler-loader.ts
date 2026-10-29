import type {LoaderDefinition} from '@rspack/core';
import {transform} from 'oxc-transform-react';

/**
 * Runs Oxc's React Compiler ahead of `builtin:swc-loader`.
 *
 * SWC's React Compiler drops source locations for much of the code it
 * rewrites, which leaves production stack traces unmapped. Oxc keeps them.
 * JSX is preserved so SWC still applies the emotion, component annotation and
 * JSX transforms.
 */
const oxcReactCompilerLoader: LoaderDefinition = function (source) {
  const callback = this.async();

  transform(this.resourcePath, source, {
    sourcemap: this.sourceMap,
    jsx: 'preserve',
    reactCompiler: {target: '19', panicThreshold: 'none'},
  }).then(result => {
    if (result.fatal) {
      callback(new Error(result.errors.map(error => error.message).join('\n')));
      return;
    }

    for (const error of result.errors) {
      this.emitWarning(new Error(error.message));
    }

    callback(null, result.code, result.map);
  }, callback);
};

export default oxcReactCompilerLoader;
