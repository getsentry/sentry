import type {LoaderDefinitionFunction} from '@rspack/core';
import {type ReactCompilerOptions, transformSync} from 'oxc-transform-react';

type ReactCompilerLoaderOptions = ReactCompilerOptions;

/**
 * `.ts` is parsed as TypeScript rather than TSX because the two grammars
 * disagree on `<T>value`: TSX reads it as an element, TypeScript as a cast.
 * Plain `.js` goes through the JSX grammar so the untyped files that still
 * contain elements keep parsing.
 */
function getLang(resourcePath: string) {
  if (resourcePath.endsWith('.tsx')) {
    return 'tsx' as const;
  }
  // Declarations reach the loader because they also match `.ts`, and only the
  // ambient grammar accepts their uninitialized `const`s.
  if (resourcePath.endsWith('.d.ts')) {
    return 'dts' as const;
  }
  if (resourcePath.endsWith('.ts')) {
    return 'ts' as const;
  }
  return 'jsx' as const;
}

const reactCompilerLoader: LoaderDefinitionFunction<ReactCompilerLoaderOptions> =
  function (source) {
    const result = transformSync(this.resourcePath, source, {
      lang: getLang(this.resourcePath),
      sourceType: 'module',
      sourcemap: this.sourceMap,
      // JSX is left intact so swc-loader still owns the emotion pragma,
      // component annotation and fast refresh transforms downstream.
      jsx: 'preserve',
      reactCompiler: this.getOptions(),
    });

    // The compiler bails out silently on anything it cannot memoize, so a fatal
    // result is a parse or semantic failure rather than a component that opted
    // out, and it should stop the build instead of shipping unread source.
    if (result.fatal) {
      this.callback(new Error(result.errors.map(error => error.message).join('\n')));
      return;
    }

    for (const error of result.errors) {
      this.emitWarning(new Error(error.message));
    }

    // oxc leaves `file` unset, which the loader source map type requires.
    this.callback(
      null,
      result.code,
      result.map && {...result.map, file: result.map.file ?? this.resourcePath}
    );
  };

export default reactCompilerLoader;
