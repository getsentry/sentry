import * as docgen from 'react-docgen-typescript';
import type {LoaderContext} from '@rspack/core';
import * as ts from 'typescript';

/**
 * Extracts documentation for React hooks from a TypeScript file
 * @param filePath Path to the TypeScript file
 * @returns Array of ComponentDoc objects for hooks
 */
function parseHooksFromFile(filePath: string): docgen.ComponentDoc[] {
  try {
    // Create TypeScript program
    const program = ts.createProgram([filePath], {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.React,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      skipLibCheck: true,
      strict: false,
    });

    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      return [];
    }

    const checker = program.getTypeChecker();
    const hookDocs: docgen.ComponentDoc[] = [];

    visitSourceFileForHooks(sourceFile, checker, hookDocs);
    return hookDocs;
  } catch (error) {
    // If parsing fails, return empty array to not break the build
    return [];
  }
}

/**
 * Visit all nodes in the source file to find hook functions
 */
function visitSourceFileForHooks(
  sourceFile: ts.SourceFile,
  checker: ts.TypeChecker,
  hookDocs: docgen.ComponentDoc[]
): void {
  // First pass: collect all potential hook functions
  const potentialHooks = new Map<
    string,
    ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression
  >();

  function visit(node: ts.Node): void {
    // Look for exported function declarations or variable declarations with function expressions
    if (ts.isFunctionDeclaration(node) && hasExportModifier(node)) {
      const functionName = node.name?.text;
      if (functionName?.startsWith('use')) {
        potentialHooks.set(functionName, node);
      }
    } else if (ts.isVariableStatement(node)) {
      // Handle: export const useHook = (...) => {...} OR const useHook = (...) => {...}
      const declaration = node.declarationList.declarations[0];
      if (declaration && ts.isIdentifier(declaration.name)) {
        const functionName = declaration.name.text;
        if (functionName.startsWith('use')) {
          if (declaration.initializer) {
            if (ts.isArrowFunction(declaration.initializer)) {
              potentialHooks.set(functionName, declaration.initializer);
            } else if (ts.isFunctionExpression(declaration.initializer)) {
              potentialHooks.set(functionName, declaration.initializer);
            }
          }
        }
      }
    } else if (ts.isExportDeclaration(node)) {
      // Handle: export { useHook };
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        node.exportClause.elements.forEach(exportSpecifier => {
          const exportName = exportSpecifier.name.text;
          if (exportName.startsWith('use') && potentialHooks.has(exportName)) {
            const functionNode = potentialHooks.get(exportName);
            if (functionNode) {
              const hookDoc = extractHookDocumentation(
                functionNode,
                exportName,
                checker,
                sourceFile
              );
              if (hookDoc) {
                hookDocs.push(hookDoc);
              }
            }
          }
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  // Also process directly exported hooks (export const useHook = ...)
  potentialHooks.forEach((functionNode, functionName) => {
    // Check if this hook was already processed via export declaration
    if (!hookDocs.some(doc => doc.displayName === functionName)) {
      // Check if the variable statement has export modifier
      let isDirectlyExported = false;
      if (ts.isFunctionDeclaration(functionNode)) {
        isDirectlyExported = hasExportModifier(functionNode);
      } else {
        // For arrow functions, check if their parent variable statement is exported
        const parent = functionNode.parent;
        if (parent && ts.isVariableDeclaration(parent)) {
          const varStatement = parent.parent?.parent;
          if (varStatement && ts.isVariableStatement(varStatement)) {
            isDirectlyExported = hasExportModifier(varStatement);
          }
        }
      }

      if (isDirectlyExported) {
        const hookDoc = extractHookDocumentation(
          functionNode,
          functionName,
          checker,
          sourceFile
        );
        if (hookDoc) {
          hookDocs.push(hookDoc);
        }
      }
    }
  });
}

/**
 * Check if a node has export modifier
 */
function hasExportModifier(node: ts.Node): boolean {
  const modifiersNode = node as ts.Node & {modifiers?: ts.NodeArray<ts.Modifier>};
  return (
    modifiersNode.modifiers?.some(
      modifier => modifier.kind === ts.SyntaxKind.ExportKeyword
    ) ?? false
  );
}

/**
 * Extract documentation for a single hook function
 */
function extractHookDocumentation(
  functionNode: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
  functionName: string,
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile
): docgen.ComponentDoc | null {
  try {
    const props: docgen.Props = {};

    // Extract parameters
    functionNode.parameters.forEach(param => {
      if (ts.isIdentifier(param.name)) {
        const paramName = param.name.text;
        const paramType = checker.getTypeAtLocation(param);
        const symbol = checker.getSymbolAtLocation(param.name);

        // Extract JSDoc comment for parameter
        const jsDocComment = extractJSDocComment(symbol);

        props[paramName] = {
          name: paramName,
          required: !param.questionToken && !param.initializer,
          type: {
            name: checker.typeToString(paramType),
            raw: checker.typeToString(paramType),
          },
          description: jsDocComment,
          defaultValue: param.initializer
            ? extractDefaultValue(param.initializer)
            : undefined,
        };
      }
    });

    // Extract JSDoc comment for the function
    const functionSymbol = checker.getSymbolAtLocation(functionNode);
    const functionDescription = extractJSDocComment(functionSymbol);

    return {
      displayName: functionName,
      filePath: sourceFile.fileName,
      description: functionDescription,
      props,
      methods: [],
      tags: {},
    };
  } catch (error) {
    return null;
  }
}

/**
 * Extract JSDoc comment from a TypeScript symbol
 */
function extractJSDocComment(symbol?: ts.Symbol): string {
  if (!symbol) return '';

  const comment = ts.displayPartsToString(symbol.getDocumentationComment(undefined));
  return comment || '';
}

/**
 * Extract default value from an initializer expression
 */
function extractDefaultValue(initializer: ts.Expression): any {
  switch (initializer.kind) {
    case ts.SyntaxKind.StringLiteral:
      return (initializer as ts.StringLiteral).text;
    case ts.SyntaxKind.NumericLiteral:
      return Number((initializer as ts.NumericLiteral).text);
    case ts.SyntaxKind.TrueKeyword:
      return true;
    case ts.SyntaxKind.FalseKeyword:
      return false;
    case ts.SyntaxKind.NullKeyword:
      return null;
    default:
      return undefined;
  }
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

  // Parse components using react-docgen-typescript
  const componentEntries =
    docgen.parse(this.resourcePath, {
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
    }) || [];

  // Parse hooks using custom parser
  const hookEntries = parseHooksFromFile(this.resourcePath);

  // Combine both component and hook entries
  const allEntries = [...componentEntries, ...hookEntries];

  if (allEntries.length === 0) {
    return callback(null, 'export default {}');
  }

  const typeIndex = Object.fromEntries(
    allEntries
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
  const STORYBOOK_TYPES = process.env.STORYBOOK_TYPES
    ? process.env.STORYBOOK_TYPES === '1'
    : process.env.NODE_ENV === 'production';

  return STORYBOOK_TYPES
    ? prodTypeloader.call(this, _source)
    : noopTypeLoader.call(this, _source);
}
