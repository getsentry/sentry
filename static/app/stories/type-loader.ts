import * as docgen from 'react-docgen-typescript';
import type {LoaderContext} from '@rspack/core';
import * as typescript from 'typescript';

function extractModuleExports(
  module: string,
  program: typescript.Program,
  sourceFile: typescript.SourceFile | undefined
): Record<string, Array<{name: string; typeOnly: boolean}>> {
  if (!sourceFile) {
    return {};
  }

  const typeChecker = program.getTypeChecker();
  const moduleSymbol = typeChecker.getSymbolAtLocation(sourceFile);

  if (!moduleSymbol) {
    return {};
  }

  return typeChecker
    .getExportsOfModule(moduleSymbol)
    .reduce(
      (
        acc: Record<string, Array<{name: string; typeOnly: boolean}>>,
        exportSymbol: typescript.Symbol
      ) => {
        const declarations = exportSymbol.getDeclarations() || [];

        for (const decl of declarations) {
          if (typescript.isExportSpecifier(decl)) {
            if (!acc[module]) {
              acc[module] = [];
            }
            acc[module].push({
              name: decl.name.getText(),
              typeOnly: decl.isTypeOnly,
            });
          }
        }
        return acc;
      },
      {}
    );
}

function extractComponentProps(
  moduleContext: LoaderContext<any>['_module'],
  resourcePath: string
): Record<string, TypeLoader.ComponentDocWithFilename> {
  const componentProps = docgen.parse(resourcePath, {
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

  return Object.fromEntries(
    componentProps
      .filter(entry => entry.displayName && typeof entry.displayName === 'string')
      .map(entry => {
        const module = extractRequest(moduleContext);
        return [
          entry.displayName,
          {
            ...entry,
            filename: resourcePath,
            module,
          },
        ];
      })
  );
}

/**
 * Extracts documentation from the modules by running the TS compiler and serializing the types
 *
 * @param {LoaderContext<any>} this loader context
 * @param {string} source source file as string
 * @returns {void}
 */
function prodTypeloader(this: LoaderContext<any>, _source: string) {
  const callback = this.async();

  const program = typescript.createProgram([this.resourcePath], {});
  const sourceFile = program.getSourceFile(this.resourcePath);

  const module = extractRequest(this._module);

  Promise.all([
    extractComponentProps(this._module, this.resourcePath),
    extractModuleExports(module, program, sourceFile),
  ])
    .then(([moduleProps, moduleExports]) => {
      const typeLoaderResult: TypeLoader.TypeLoaderResult = {
        props: moduleProps,
        exports: moduleExports,
      };
      return callback(null, `export default ${JSON.stringify(typeLoaderResult)}`);
    })
    .catch(error => {
      return callback(error);
    });
}

function noopTypeLoader(this: LoaderContext<any>, _source: string) {
  const callback = this.async();
  return callback(null, 'export default {}');
}

export default function typeLoader(this: LoaderContext<any>, _source: string) {
  const STORYBOOK_TYPES = process.env.STORYBOOK_TYPES
    ? process.env.STORYBOOK_TYPES === '1'
    : process.env.NODE_ENV === 'production';

  return STORYBOOK_TYPES
    ? prodTypeloader.call(this, _source)
    : noopTypeLoader.call(this, _source);
}

function extractRequest(module: LoaderContext<any>['_module']) {
  if (!module || !('rawRequest' in module) || typeof module.rawRequest !== 'string') {
    return '';
  }
  return module.rawRequest.split('!')?.at(-1) ?? '';
}
