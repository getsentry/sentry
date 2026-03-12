import {AST_NODE_TYPES, ESLintUtils, type TSESTree} from '@typescript-eslint/utils';
import {getParserServices} from '@typescript-eslint/utils/eslint-utils';
import ts from 'typescript';

import {isReactComponentLike} from './utils/isReactComponentLike';
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

function findTopLevelFunctionDeclaration(
  body: TSESTree.ProgramStatement[],
  name: string
) {
  return body.find(
    statement =>
      statement.type === AST_NODE_TYPES.FunctionDeclaration && statement.id?.name === name
  );
}

function findTopLevelVariableDeclaration(
  body: TSESTree.ProgramStatement[],
  name: string
): TSESTree.VariableDeclaration | undefined {
  return body.find((statement): statement is TSESTree.VariableDeclaration => {
    if (statement.type !== AST_NODE_TYPES.VariableDeclaration) {
      return false;
    }
    return statement.declarations.some(
      decl => decl.id.type === AST_NODE_TYPES.Identifier && decl.id.name === name
    );
  });
}

const allowedFilesLazy = lazy(collectResolvedImportFiles);

export const noDefaultExportComponents = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow default exports of React components that are not lazy-imported',
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

    if (
      allowedFiles.has(currentFileName) ||
      // TODO: Eventually, it'd be nice to fully ban all default exports of components...
      context.sourceCode.ast.body.some(
        statement => statement.type === AST_NODE_TYPES.ExportNamedDeclaration
      )
    ) {
      return {};
    }

    return {
      ExportDefaultDeclaration(node) {
        if (
          node.declaration.type === AST_NODE_TYPES.ClassDeclaration ||
          node.declaration.type === AST_NODE_TYPES.FunctionDeclaration
        ) {
          if (
            !node.declaration.id ||
            !isReactComponentLike(node.declaration, context.sourceCode)
          ) {
            return;
          }

          context.report({
            node,
            messageId: 'forbidden',
            fix: fixer => [
              fixer.replaceTextRange(
                [node.range[0], node.declaration.range[0]],
                'export '
              ),
            ],
          });
          return;
        }

        if (node.declaration.type === AST_NODE_TYPES.Identifier) {
          const exportedName = node.declaration.name;
          const functionDeclaration = findTopLevelFunctionDeclaration(
            node.parent.body,
            exportedName
          );
          const variableDeclaration = findTopLevelVariableDeclaration(
            node.parent.body,
            exportedName
          );

          const declarator = variableDeclaration?.declarations.find(
            decl =>
              decl.id.type === AST_NODE_TYPES.Identifier && decl.id.name === exportedName
          );

          const isComponent = functionDeclaration
            ? isReactComponentLike(functionDeclaration, context.sourceCode)
            : declarator
              ? isReactComponentLike(declarator, context.sourceCode)
              : false;

          const declarationToExport = functionDeclaration ?? variableDeclaration;
          if (!declarationToExport || !isComponent) {
            return;
          }

          context.report({
            node,
            messageId: 'forbidden',
            fix: fixer => [
              fixer.insertTextBefore(declarationToExport, 'export '),
              fixer.remove(node),
            ],
          });
          return;
        }
      },
    };
  },
});
