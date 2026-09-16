import {defineRule, type ESTree, type Variable} from '@oxlint/plugins';

type FunctionNode = ESTree.ArrowFunctionExpression | ESTree.Function;

function isFunctionNode(node: ESTree.Node): node is FunctionNode {
  return (
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression'
  );
}

function isJsxOrNullExpression(node: ESTree.Node | null | undefined): boolean {
  if (!node) {
    return false;
  }

  switch (node.type) {
    case 'JSXElement':
    case 'JSXFragment':
      return true;
    case 'Literal':
      return node.value === null;
    case 'ConditionalExpression':
      return (
        isJsxOrNullExpression(node.consequent) && isJsxOrNullExpression(node.alternate)
      );
    case 'TSAsExpression':
    case 'TSNonNullExpression':
    case 'TSSatisfiesExpression':
    case 'TSTypeAssertion':
      return isJsxOrNullExpression(node.expression);
    default:
      return false;
  }
}

export const preferReactComponent = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow JSX- or null-returning functions directly invoked inside React components. Use a component instead.',
    },
    schema: [],
    messages: {
      useComponent:
        'Use a component instead of "{{name}}". JSX- or null-returning functions directly invoked inside React components should be components.',
    },
  },

  create(context) {
    function resolveVariable(
      node: ESTree.IdentifierReference | ESTree.BindingIdentifier
    ): Variable | undefined {
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

    function isDirectlyInvoked(
      binding: ESTree.IdentifierReference | ESTree.BindingIdentifier
    ): boolean {
      const variable = resolveVariable(binding);
      return (
        variable?.references.some(reference => {
          const parent = reference.identifier.parent;
          return (
            parent?.type === 'CallExpression' && parent.callee === reference.identifier
          );
        }) ?? false
      );
    }

    function getReturnStatements(node: ESTree.Node): ESTree.ReturnStatement[] {
      const returnStatements: ESTree.ReturnStatement[] = [];

      function visit(current: ESTree.Node) {
        if (current !== node && isFunctionNode(current)) {
          return;
        }

        if (current.type === 'ReturnStatement') {
          returnStatements.push(current);
          return;
        }

        const visitorKeys = context.sourceCode.visitorKeys[current.type] ?? [];
        for (const key of visitorKeys) {
          const child = current[key as keyof typeof current] as
            | ESTree.Node
            | ESTree.Node[]
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

    function returnsOnlyJsxOrNull(node: FunctionNode): boolean {
      if (!node.body) {
        return false;
      }

      if (node.body.type !== 'BlockStatement') {
        return isJsxOrNullExpression(node.body);
      }

      const returnStatements = getReturnStatements(node.body);
      return (
        returnStatements.length > 0 &&
        returnStatements.every(statement => isJsxOrNullExpression(statement.argument))
      );
    }

    function getFunctionName(node: FunctionNode): string | null {
      if ('id' in node && node.id?.type === 'Identifier') {
        return node.id.name;
      }

      let parent: ESTree.Node | null = node.parent;
      while (parent?.type === 'CallExpression') {
        parent = parent.parent;
      }

      if (parent?.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
        return parent.id.name;
      }

      return null;
    }

    function containsJsx(node: ESTree.Node): boolean {
      function visit(current: ESTree.Node): boolean {
        if (current !== node && isFunctionNode(current)) {
          return false;
        }

        if (current.type === 'JSXElement' || current.type === 'JSXFragment') {
          return true;
        }

        const visitorKeys = context.sourceCode.visitorKeys[current.type] ?? [];
        return visitorKeys.some(key => {
          const child = current[key as keyof typeof current] as
            | ESTree.Node
            | ESTree.Node[]
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
        (node.body ? containsJsx(node.body) : false)
      );
    }

    function isNestedInReactScope(node: FunctionNode): boolean {
      let parent: ESTree.Node | null = node.parent;
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
      binding: ESTree.IdentifierReference | ESTree.BindingIdentifier,
      name: string
    ) {
      if (
        !isNestedInReactScope(node) ||
        !returnsOnlyJsxOrNull(node) ||
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
        if (node.id.type !== 'Identifier' || !node.init || !isFunctionNode(node.init)) {
          return;
        }

        reportIfNestedJsxFunction(node.init, node.id, node.id.name);
      },
    };
  },
});
