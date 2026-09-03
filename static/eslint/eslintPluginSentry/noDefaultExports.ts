import {AST_NODE_TYPES, ESLintUtils, type TSESTree} from '@typescript-eslint/utils';
import ts from 'typescript';

// Comment-separated static imports are harmless false positives.
const possibleDynamicImportPattern = /\bimport\s*(?:\(|\/[/*])/u;

function getDirectory(fileName: string): string {
  return fileName.replace(/[/\\][^/\\]+$/u, '');
}

export function mayContainDynamicImport(source: string): boolean {
  return possibleDynamicImportPattern.test(source);
}

function unwrapParenthesized(node: ts.Node): ts.Node {
  return ts.isParenthesizedExpression(node) ? unwrapParenthesized(node.expression) : node;
}

/**
 * Parse only files that pass the cheap source prefilter. This avoids building a
 * Program or type checker while retaining the exact lazy-import semantics.
 */
export function collectLazyImportSpecifiers(
  source: string,
  fileName = 'lazyImports.tsx'
): string[] {
  if (!mayContainDynamicImport(source)) {
    return [];
  }

  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    false,
    fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const specifiers: string[] = [];

  function addImport(call: ts.CallExpression): void {
    const argument = call.arguments[0];
    if (
      call.expression.kind === ts.SyntaxKind.ImportKeyword &&
      call.arguments.length === 1 &&
      argument &&
      ts.isStringLiteralLike(argument)
    ) {
      specifiers.push(argument.text);
    }
  }

  function visit(node: ts.Node): void {
    if (ts.isArrowFunction(node)) {
      const body = unwrapParenthesized(node.body);
      if (ts.isCallExpression(body)) {
        addImport(body);
      }
    }
    if (ts.isAwaitExpression(node)) {
      const expression = unwrapParenthesized(node.expression);
      if (ts.isCallExpression(expression)) {
        addImport(expression);
      }
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);
  return specifiers;
}

function findTopLevelDeclaration(body: TSESTree.ProgramStatement[], name: string) {
  return body.find(statement => {
    switch (statement.type) {
      case AST_NODE_TYPES.FunctionDeclaration:
      case AST_NODE_TYPES.ClassDeclaration:
      case AST_NODE_TYPES.TSEnumDeclaration:
      case AST_NODE_TYPES.TSInterfaceDeclaration:
      case AST_NODE_TYPES.TSTypeAliasDeclaration:
        return statement.id?.name === name;
      case AST_NODE_TYPES.VariableDeclaration:
        return statement.declarations.some(
          declaration =>
            declaration.id.type === AST_NODE_TYPES.Identifier &&
            declaration.id.name === name
        );
      default:
        return false;
    }
  });
}

const allowedFilesByConfig = new Map<string, Set<string> | null>();

function collectAllowedFiles(configPath: string): Set<string> | undefined {
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) {
    return undefined;
  }

  const configDirectory = getDirectory(configPath);
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    configDirectory,
    undefined,
    configPath
  );
  if (parsed.errors.length) {
    return undefined;
  }

  const allowedFiles = new Set<string>();
  const resolutionCache = ts.createModuleResolutionCache(
    configDirectory,
    fileName => (ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase()),
    parsed.options
  );

  for (const fileName of parsed.fileNames) {
    if (/\.d\.[cm]?ts$/u.test(fileName)) {
      continue;
    }
    const source = ts.sys.readFile(fileName);
    if (!source || !mayContainDynamicImport(source)) {
      continue;
    }

    for (const specifier of collectLazyImportSpecifiers(source, fileName)) {
      const resolved = ts.resolveModuleName(
        specifier,
        fileName,
        parsed.options,
        ts.sys,
        resolutionCache
      ).resolvedModule?.resolvedFileName;
      if (resolved) {
        allowedFiles.add(ts.sys.resolvePath(resolved));
      }
    }
  }

  return allowedFiles;
}

function getAllowedFiles(fileName: string): Set<string> | undefined {
  const configPath = ts.findConfigFile(
    getDirectory(fileName),
    ts.sys.fileExists,
    'tsconfig.json'
  );
  if (!configPath) {
    return undefined;
  }

  if (!allowedFilesByConfig.has(configPath)) {
    allowedFilesByConfig.set(configPath, collectAllowedFiles(configPath) ?? null);
  }
  return allowedFilesByConfig.get(configPath) ?? undefined;
}

export const noDefaultExports = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow default exports in files that are not lazy-imported',
    },
    fixable: 'code',
    schema: [],
    messages: {
      forbidden:
        'We prefer named exports. Default exports are not allowed unless this file is lazy-imported.',
    },
  },

  create(context) {
    const currentFileName = ts.sys.resolvePath(context.filename);

    function visitDeclaration(
      exported: TSESTree.Node,
      declaration: TSESTree.ExportDefaultDeclaration
    ) {
      switch (exported.type) {
        case AST_NODE_TYPES.ClassDeclaration:
        case AST_NODE_TYPES.FunctionDeclaration: {
          context.report({
            node: declaration,
            messageId: 'forbidden',
            fix: exported.id
              ? fixer => [
                  fixer.replaceTextRange(
                    [declaration.range[0], exported.range[0]],
                    'export '
                  ),
                ]
              : undefined,
          });
          return;
        }

        case AST_NODE_TYPES.Identifier: {
          const declarationToExport = findTopLevelDeclaration(
            declaration.parent.body,
            exported.name
          );

          context.report({
            node: declaration,
            messageId: 'forbidden',
            fix: declarationToExport
              ? fixer => {
                  const text = context.sourceCode.getText();
                  let removeStart = declaration.range[0];
                  while (removeStart > 0 && ' \t'.includes(text[removeStart - 1]!)) {
                    removeStart--;
                  }
                  if (removeStart > 0 && text[removeStart - 1] === '\n') {
                    removeStart--;
                  }
                  return [
                    fixer.insertTextBefore(declarationToExport, 'export '),
                    fixer.removeRange([removeStart, declaration.range[1]]),
                  ];
                }
              : undefined,
          });
          return;
        }

        case AST_NODE_TYPES.TSAsExpression:
          visitDeclaration(exported.expression, declaration);
          return;

        // Calls like HoCs often result in differences between internal and exported names:
        //   export default withConfig(MyComponent);
        //   export default styled(MyComponent)``;
        case AST_NODE_TYPES.CallExpression:
        case AST_NODE_TYPES.TaggedTemplateExpression: {
          return;
        }

        default:
          context.report({
            node: declaration,
            messageId: 'forbidden',
          });
      }
    }

    return {
      ExportDefaultDeclaration(node) {
        const allowedFiles = getAllowedFiles(currentFileName);
        if (!allowedFiles || allowedFiles.has(currentFileName)) {
          return;
        }
        visitDeclaration(node.declaration, node);
      },
    };
  },
});
