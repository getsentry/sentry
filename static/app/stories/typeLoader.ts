import * as docgen from 'react-docgen-typescript';
import type {LoaderContext} from '@rspack/core';
import * as typescript from 'typescript';

// Numeric suffixes depend on parse order, so emitting these props changes chunk hashes.
const TYPESCRIPT_SYNTHETIC_PROPERTY = /^__@[^@]+@\d+$/;
// react-docgen-typescript returns checkout-specific absolute paths in these fields.
const FILE_PATH_PROPERTIES = new Set(['fileName', 'filePath']);

type Contextify = LoaderContext['utils']['contextify'];

function isDocumentedProp(prop: {name: string}): boolean {
  return !TYPESCRIPT_SYNTHETIC_PROPERTY.test(prop.name);
}

function serializeTypeLoaderResult(
  result: TypeLoader.TypeLoaderResult,
  rootContext: string,
  contextify: Contextify
): string {
  // Docgen nests absolute paths throughout its output, so normalize them during serialization.
  return JSON.stringify(result, (key, value) => {
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
  resourcePath: string
): Record<string, TypeLoader.ComponentDoc> {
  const componentProps = docgen.parse(resourcePath, {
    shouldExtractLiteralValuesFromEnum: true,
    shouldExtractValuesFromUnion: true,
    savePropValueAsString: true,
    shouldRemoveUndefinedFromOptional: true,
    skipChildrenPropWithoutDoc: false, // ensure props.children are included in the types
    propFilter: isDocumentedProp,
  });

  return Object.fromEntries(
    componentProps
      .filter(entry => entry.displayName && typeof entry.displayName === 'string')
      .map(entry => [entry.displayName, entry])
  );
}

function prodTypeLoader(this: LoaderContext): string {
  const program = typescript.createProgram([this.resourcePath], {});
  const sourceFile = program.getSourceFile(this.resourcePath);

  const module = extractRequest(
    this.resourcePath,
    this.rootContext,
    this.utils.contextify
  );

  const moduleProps = extractComponentProps(this.resourcePath);
  const moduleExports = extractModuleExports(program, sourceFile);

  const typeLoaderResult: TypeLoader.TypeLoaderResult = {
    props: moduleProps,
    exports: {
      module,
      exports: moduleExports,
    },
  };
  return `export default ${serializeTypeLoaderResult(
    typeLoaderResult,
    this.rootContext,
    this.utils.contextify
  )}`;
}

export default function typeLoader(this: LoaderContext): string {
  // Allow acceptance tests to opt out of type-loader for performance reasons
  return process.env.IS_ACCEPTANCE_TEST === '1'
    ? 'export default {props: {},exports: {}}'
    : prodTypeLoader.call(this);
}

// Convert the resource path to the canonical import shown in API docs.
function extractRequest(
  resourcePath: string,
  rootContext: string,
  contextify: Contextify
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
