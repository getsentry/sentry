import * as docgen from 'react-docgen-typescript';
import type {LoaderContext} from 'webpack';

/**
 * Extracts documentation from the modules by running the TS compiler and serializing the types
 *
 * @param {LoaderContext<any>} this loader context
 * @param {string} source source file as string
 * @returns {void}
 */
export default function typeloader(this: LoaderContext<any>, _source: string) {
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

  const typeIndex: Record<string, TypeLoader.ComponentDocWithFilename> = entries.reduce(
    (acc, entry) => {
      if (entry.displayName && typeof entry.displayName === 'string') {
        acc[entry.displayName] = {
          ...entry,
          filename: this.resourcePath,
        };
      }
      return acc;
    },
    {} as Record<string, TypeLoader.ComponentDocWithFilename>
  );

  return callback(null, `export default ${JSON.stringify(typeIndex)}`);
}
