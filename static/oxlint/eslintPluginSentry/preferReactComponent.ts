import {defineRule, type ESTree} from '@oxlint/plugins';

type FunctionNode = ESTree.ArrowFunctionExpression | ESTree.Function;

interface FunctionFrame {
  hasJsx: boolean;
  node: FunctionNode;
  parent: FunctionFrame | undefined;
  returns: ESTree.ReturnStatement[];
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
    case 'LogicalExpression':
      return node.operator === '&&' && isJsxOrNullExpression(node.right);
    case 'ArrayExpression':
      return node.elements.length > 0 && node.elements.every(isJsxOrNullExpression);
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
    const stack: FunctionFrame[] = [];
    const candidates: Array<{binding: ESTree.BindingIdentifier; frame: FunctionFrame}> =
      [];

    function isDirectlyInvoked(binding: ESTree.BindingIdentifier): boolean {
      return context.sourceCode
        .getDeclaredVariables(binding.parent)
        .find(variable => variable.name === binding.name)!
        .references.some(reference => {
          const parent = reference.identifier.parent;
          return (
            parent?.type === 'CallExpression' && parent.callee === reference.identifier
          );
        });
    }

    function returnsOnlyJsxOrNull({node, returns}: FunctionFrame): boolean {
      if (node.async || node.generator) {
        return false;
      }

      if (node.body?.type !== 'BlockStatement') {
        return isJsxOrNullExpression(node.body);
      }

      return (
        returns.length > 0 &&
        returns.every(statement => isJsxOrNullExpression(statement.argument))
      );
    }

    function getFunctionName(node: FunctionNode): string | null {
      if (node.id?.type === 'Identifier') {
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

    function isReactScope({node, hasJsx}: FunctionFrame): boolean {
      return hasJsx || /^(?:[A-Z]|use[A-Z])/.test(getFunctionName(node) ?? '');
    }

    function isNestedInReactScope({parent}: FunctionFrame): boolean {
      while (parent) {
        if (isReactScope(parent)) {
          return true;
        }
        parent = parent.parent;
      }
      return false;
    }

    return {
      ':function'(node: FunctionNode) {
        stack.push({node, parent: stack.at(-1), hasJsx: false, returns: []});
      },

      ReturnStatement(node) {
        stack.at(-1)?.returns.push(node);
      },

      'JSXElement, JSXFragment'() {
        const frame = stack.at(-1);
        if (frame) {
          frame.hasJsx = true;
        }
      },

      ':function:exit'(node: FunctionNode) {
        const frame = stack.pop();
        const binding =
          node.type === 'FunctionDeclaration'
            ? node.id
            : node.parent.type === 'VariableDeclarator' &&
                node.parent.id.type === 'Identifier'
              ? node.parent.id
              : null;

        if (
          !frame?.parent ||
          !binding ||
          !returnsOnlyJsxOrNull(frame) ||
          !isDirectlyInvoked(binding)
        ) {
          return;
        }

        candidates.push({binding, frame});
      },

      'Program:exit'() {
        // Parent JSX may appear after the candidate, so wait until traversal is complete.
        for (const {binding, frame} of candidates) {
          if (isNestedInReactScope(frame)) {
            context.report({
              node: binding,
              messageId: 'useComponent',
              data: {name: binding.name},
            });
          }
        }
      },
    };
  },
});
