import {AST_NODE_TYPES, ESLintUtils, type TSESTree} from '@typescript-eslint/utils';
import type {Scope} from '@typescript-eslint/utils/ts-eslint';

type FunctionNode =
  | TSESTree.ArrowFunctionExpression
  | TSESTree.FunctionDeclaration
  | TSESTree.FunctionExpression;

function isFunctionNode(node: TSESTree.Node): node is FunctionNode {
  return (
    node.type === AST_NODE_TYPES.ArrowFunctionExpression ||
    node.type === AST_NODE_TYPES.FunctionDeclaration ||
    node.type === AST_NODE_TYPES.FunctionExpression
  );
}

function isJsxExpression(node: TSESTree.Node | null | undefined): boolean {
  if (!node) {
    return false;
  }

  switch (node.type) {
    case AST_NODE_TYPES.JSXElement:
    case AST_NODE_TYPES.JSXFragment:
      return true;
    case AST_NODE_TYPES.ConditionalExpression:
      return isJsxExpression(node.consequent) && isJsxExpression(node.alternate);
    case AST_NODE_TYPES.TSAsExpression:
    case AST_NODE_TYPES.TSNonNullExpression:
    case AST_NODE_TYPES.TSSatisfiesExpression:
    case AST_NODE_TYPES.TSTypeAssertion:
      return isJsxExpression(node.expression);
    default:
      return false;
  }
}

export const preferReactComponent = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow JSX-returning functions directly invoked inside React components. Use a component instead.',
    },
    schema: [],
    messages: {
      useComponent:
        'Use a component instead of "{{name}}". JSX-returning functions directly invoked inside React components should be components.',
    },
  },

  create(context) {
    function resolveVariable(node: TSESTree.Identifier): Scope.Variable | undefined {
      let scope = context.sourceCode.getScope(node);
      while (scope) {
        const binding = scope.variables.find(variable => variable.name === node.name);
        if (binding) {
          return binding;
        }
        scope = scope.upper!;
      }
      return undefined;
    }

    function isDirectlyInvoked(binding: TSESTree.Identifier): boolean {
      const variable = resolveVariable(binding);
      return (
        variable?.references.some(reference => {
          const parent = reference.identifier.parent;
          return (
            parent?.type === AST_NODE_TYPES.CallExpression &&
            parent.callee === reference.identifier
          );
        }) ?? false
      );
    }

    function getReturnStatements(node: TSESTree.Node): TSESTree.ReturnStatement[] {
      const returnStatements: TSESTree.ReturnStatement[] = [];

      function visit(current: TSESTree.Node) {
        if (current !== node && isFunctionNode(current)) {
          return;
        }

        if (current.type === AST_NODE_TYPES.ReturnStatement) {
          returnStatements.push(current);
          return;
        }

        const visitorKeys = context.sourceCode.visitorKeys[current.type] ?? [];
        for (const key of visitorKeys) {
          const child = current[key as keyof typeof current] as
            | TSESTree.Node
            | TSESTree.Node[]
            | null
            | undefined;

          if (Array.isArray(child)) {
            for (const item of child) {
              if (item) {
                visit(item);
              }
            }
          } else if (child) {
            visit(child);
          }
        }
      }

      visit(node);
      return returnStatements;
    }

    function returnsOnlyJsx(node: FunctionNode): boolean {
      if (node.body.type !== AST_NODE_TYPES.BlockStatement) {
        return isJsxExpression(node.body);
      }

      const returnStatements = getReturnStatements(node.body);
      return (
        returnStatements.length > 0 &&
        returnStatements.every(statement => isJsxExpression(statement.argument))
      );
    }

    function getFunctionName(node: FunctionNode): string | null {
      if ('id' in node && node.id?.type === AST_NODE_TYPES.Identifier) {
        return node.id.name;
      }

      let parent: TSESTree.Node | undefined = node.parent;
      while (parent?.type === AST_NODE_TYPES.CallExpression) {
        parent = parent.parent;
      }

      if (
        parent?.type === AST_NODE_TYPES.VariableDeclarator &&
        parent.id.type === AST_NODE_TYPES.Identifier
      ) {
        return parent.id.name;
      }

      return null;
    }

    function containsJsx(node: TSESTree.Node): boolean {
      function visit(current: TSESTree.Node): boolean {
        if (current !== node && isFunctionNode(current)) {
          return false;
        }

        if (
          current.type === AST_NODE_TYPES.JSXElement ||
          current.type === AST_NODE_TYPES.JSXFragment
        ) {
          return true;
        }

        const visitorKeys = context.sourceCode.visitorKeys[current.type] ?? [];
        return visitorKeys.some(key => {
          const child = current[key as keyof typeof current] as
            | TSESTree.Node
            | TSESTree.Node[]
            | null
            | undefined;

          if (Array.isArray(child)) {
            return child.some(item => item !== null && visit(item));
          }
          return child ? visit(child) : false;
        });
      }

      return visit(node);
    }

    function isReactScope(node: FunctionNode): boolean {
      const name = getFunctionName(node);
      return (
        (name !== null && (/^[A-Z]/.test(name) || /^use[A-Z]/.test(name))) ||
        containsJsx(node.body)
      );
    }

    function isNestedInReactScope(node: FunctionNode): boolean {
      let parent: TSESTree.Node | undefined = node.parent;
      while (parent) {
        if (isFunctionNode(parent) && isReactScope(parent)) {
          return true;
        }
        parent = parent.parent;
      }
      return false;
    }

    function reportIfNestedJsxFunction(
      node: FunctionNode,
      binding: TSESTree.Identifier,
      name: string
    ) {
      if (
        !isNestedInReactScope(node) ||
        !returnsOnlyJsx(node) ||
        !isDirectlyInvoked(binding)
      ) {
        return;
      }

      context.report({
        node,
        messageId: 'useComponent',
        data: {name},
      });
    }

    return {
      FunctionDeclaration(node) {
        if (node.id) {
          reportIfNestedJsxFunction(node, node.id, node.id.name);
        }
      },

      VariableDeclarator(node) {
        if (
          node.id.type !== AST_NODE_TYPES.Identifier ||
          !node.init ||
          !isFunctionNode(node.init)
        ) {
          return;
        }

        reportIfNestedJsxFunction(node.init, node.id, node.id.name);
      },
    };
  },
});
