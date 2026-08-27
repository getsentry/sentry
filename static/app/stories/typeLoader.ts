import * as docgen from 'react-docgen-typescript';
import type {LoaderContext} from '@rspack/core';
import * as typescript from 'typescript';

// TypeScript assigns these symbols process-global numeric IDs based on traversal order.
const TYPESCRIPT_SYNTHETIC_PROPERTY = /^__@[^@]+@\d+$/;
// react-docgen-typescript returns checkout-specific absolute paths in these fields.
const FILE_PATH_PROPERTIES = new Set(['fileName', 'filePath', 'filename']);

export function serializeTypeLoaderResult(
  result: TypeLoader.TypeLoaderResult,
  rootContext: string,
  contextify: (context: string, request: string) => string
): string {
  return JSON.stringify(result, (key, value) => {
    if (TYPESCRIPT_SYNTHETIC_PROPERTY.test(key)) {
      return;
    }

    if (FILE_PATH_PROPERTIES.has(key) && typeof value === 'string') {
      return contextify(rootContext, value);
    }

    return value;
  });
}

function extractModuleExports(
  program: typescript.Program,
  sourceFile: typescript.SourceFile | undefined
): Record<string, {name: string; typeOnly: boolean}> {
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
        acc: Record<string, {name: string; typeOnly: boolean}>,
        exportSymbol: typescript.Symbol
      ) => {
        const declarations = exportSymbol.getDeclarations() || [];

        for (const decl of declarations) {
          const name = exportSymbol.name;
          let typeOnly = false;

          // Determine if it's a type-only export
          if (typescript.isInterfaceDeclaration(decl)) {
            typeOnly = true;
          } else if (typescript.isTypeAliasDeclaration(decl)) {
            typeOnly = true;
          } else if (typescript.isExportSpecifier(decl)) {
            typeOnly = decl.isTypeOnly;
          }
          // For VariableDeclaration, FunctionDeclaration, ClassDeclaration, etc.
          // typeOnly remains false (these are value exports)

          acc[name] = {name, typeOnly};
        }
        return acc;
      },
      {}
    );
}

function extractComponentProps(
  resourcePath: string,
  module: string
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
function prodTypeloader(this: LoaderContext, _source: string) {
  const callback = this.async();

  const program = typescript.createProgram([this.resourcePath], {});
  const sourceFile = program.getSourceFile(this.resourcePath);

  const module = extractRequest(
    this.resourcePath,
    this.rootContext,
    this.utils.contextify
  );

  const moduleProps = extractComponentProps(this.resourcePath, module);
  const moduleExports = extractModuleExports(program, sourceFile);

  const typeLoaderResult: TypeLoader.TypeLoaderResult = {
    props: moduleProps,
    exports: {
      module,
      exports: moduleExports,
    },
  };
  return callback(
    null,
    `export default ${serializeTypeLoaderResult(
      typeLoaderResult,
      this.rootContext,
      this.utils.contextify
    )}`
  );
}

function noopTypeLoader(this: LoaderContext, _source: string) {
  const callback = this.async();
  return callback(null, 'export default {props: {},exports: {}}');
}

export default function typeLoader(this: LoaderContext, _source: string) {
  // Allow acceptance tests to opt out of type-loader for performance reasons
  const STORYBOOK_TYPES = process.env.IS_ACCEPTANCE_TEST !== '1';

  return STORYBOOK_TYPES
    ? prodTypeloader.call(this, _source)
    : noopTypeLoader.call(this, _source);
}

export function extractRequest(
  resourcePath: string,
  rootContext: string,
  contextify: (context: string, request: string) => string
): string {
  let modulePath = contextify(rootContext, resourcePath)
    .replace(/^\.\/app\/components\/core\//, '@sentry/scraps/')
    .replace(/^\.\/app\//, 'sentry/')
    .replace(/\.[cm]?[jt]sx?$/, '');

  if (modulePath.endsWith('/index')) {
    modulePath = modulePath.slice(0, -6);
  }

  return modulePath;
}
