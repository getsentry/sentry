import * as docgen from 'react-docgen-typescript';
import type {LoaderContext} from '@rspack/core';

/**
 * Extracts documentation from the modules by running the TS compiler and serializing the types
 *
 * @param {LoaderContext<any>} this loader context
 * @param {string} source source file as string
 * @returns {void}
 */
function prodTypeloader(this: LoaderContext<any>, _source: string) {
  const callback = this.async();
  const entries = docgen.parse(this.resourcePath, {
    shouldExtractLiteralValuesFromEnum: true,
    // componentNameResolver?: ComponentNameResolver;
    // shouldRemoveUndefinedFromOptional?: boolean;
    shouldExtractValuesFromUnion: true,
    savePropValueAsString: true,
    shouldRemoveUndefinedFromOptional: true,
    skipChildrenPropWithoutDoc: false, // ensure props.children are included in the types
    // savePropValueAsString?: boolean;
    // shouldIncludePropTagMap?: boolean;
    // shouldIncludeExpression: true, // enabling this causes circular expression errors when attempting to serialize to JSON
    // customComponentTypes?: string[];
  });

  if (!entries) {
    return callback(null, 'export default {}');
  }

  const typeIndex = Object.fromEntries(
    entries
      .filter(entry => entry.displayName && typeof entry.displayName === 'string')
      .map(entry => [entry.displayName, {...entry, filename: this.resourcePath}])
  );
  return callback(null, `export default ${JSON.stringify(typeIndex)}`);
}

function noopTypeLoader(this: LoaderContext<any>, _source: string) {
  const callback = this.async();
  return callback(null, 'export default {}');
}

export default function typeLoader(this: LoaderContext<any>, _source: string) {
  const STORYBOOK_TYPES =
    Boolean(process.env.STORYBOOK_TYPES) || process.env.node_ENV === 'production';

  return STORYBOOK_TYPES
    ? prodTypeloader.call(this, _source)
    : noopTypeLoader.call(this, _source);
}
