import * as docgen from 'react-docgen-typescript';
import type {LoaderContext} from 'webpack';

/**
 * Extracts documentation from the modules by running the TS compiler and serializing the types
 *
 * @param {LoaderContext<any>} this loader context
 * @param {string} source source file as string
 * @returns {docgen.ComponentDoc}
 */
export default function typeloader(this: LoaderContext<any>, _source: string) {
  const callback = this.async();
  const entries = docgen.parse(this.resourcePath, {});

  if (!entries) {
    return callback(null, 'export default {}');
  }

  return callback(null, `export default ${JSON.stringify(entries)}`);
}
