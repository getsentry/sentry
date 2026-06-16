import {AST_NODE_TYPES, ESLintUtils, type TSESTree} from '@typescript-eslint/utils';
import {getParserServices} from '@typescript-eslint/utils/eslint-utils';
import ts from 'typescript';

import {lazy} from './utils/lazy';

function unwrapParenthesized(node: ts.Node): ts.Node {
  return ts.isParenthesizedExpression(node) ? unwrapParenthesized(node.expression) : node;
}

function collectResolvedImportFiles(program: ts.Program) {
  const allowedFiles = new Set<string>();
  const compilerOptions = program.getCompilerOptions();

  function addResolvedModuleFromImportCall(
    callExpr: ts.CallExpression,
    sourceFile: ts.SourceFile
  ) {
    if (
      callExpr.expression.kind !== ts.SyntaxKind.ImportKeyword ||
      callExpr.arguments.length !== 1
    ) {
      return;
    }
    const argument = callExpr.arguments[0]!;
    if (ts.isStringLiteralLike(argument)) {
      const resolved = ts.resolveModuleName(
        argument.text,
        sourceFile.fileName,
        compilerOptions,
        ts.sys
      );
      if (resolved.resolvedModule?.resolvedFileName) {
        allowedFiles.add(resolved.resolvedModule.resolvedFileName);
      }
    }
  }

  function visit(node: ts.Node, sourceFile: ts.SourceFile): void {
    if (ts.isArrowFunction(node)) {
      const body = unwrapParenthesized(node.body);
      if (ts.isCallExpression(body)) {
        addResolvedModuleFromImportCall(body, sourceFile);
      }
    }

    if (ts.isAwaitExpression(node)) {
      const expr = unwrapParenthesized(node.expression);
      if (ts.isCallExpression(expr)) {
        addResolvedModuleFromImportCall(expr, sourceFile);
      }
    }

    ts.forEachChild(node, child => visit(child, sourceFile));
  }

  for (const sourceFile of program.getSourceFiles()) {
    if (!sourceFile.isDeclarationFile) {
      ts.forEachChild(sourceFile, child => visit(child, sourceFile));
    }
  }

  return allowedFiles;
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

const allowedFilesLazy = lazy(collectResolvedImportFiles);

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
    const parserServices = getParserServices(context);
    const allowedFiles = allowedFilesLazy(parserServices.program);
    const currentFileName = ts.sys.resolvePath(context.filename);

    if (allowedFiles.has(currentFileName)) {
      return {};
    }

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
        visitDeclaration(node.declaration, node);
      },
    };
  },
});
