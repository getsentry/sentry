import {ESLintUtils, type TSESTree} from '@typescript-eslint/utils';
import type {RuleFixer} from '@typescript-eslint/utils/ts-eslint';

function containsAsExpression(node: TSESTree.Node): boolean {
  if (node.type === 'TSAsExpression') {
    // Skip `as const`
    if (
      node.typeAnnotation.type === 'TSTypeReference' &&
      node.typeAnnotation.typeName.type === 'Identifier' &&
      node.typeAnnotation.typeName.name === 'const'
    ) {
      return false;
    }
    return true;
  }
  if (node.type === 'ObjectExpression') {
    return node.properties.some(prop => {
      if (prop.type === 'SpreadElement') {
        return containsAsExpression(prop.argument);
      }
      return containsAsExpression(prop.value);
    });
  }
  if (node.type === 'ArrayExpression') {
    return node.elements.some(el => el !== null && containsAsExpression(el));
  }
  return false;
}

export const preferReduceTypeParameter = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Prefer passing a type parameter to `.reduce<T>()` instead of using `as` assertions in the initial value',
    },
    fixable: 'code',
    schema: [],
    messages: {
      preferTypeParameter:
        'Prefer passing a type parameter to `.reduce<T>()` instead of type assertions in the initial value.',
    },
  },
  create(context) {
    return {
      CallExpression(node: TSESTree.CallExpression) {
        // Match `.reduce(callback, initialValue)`
        if (
          node.callee.type !== 'MemberExpression' ||
          node.callee.property.type !== 'Identifier' ||
          node.callee.property.name !== 'reduce'
        ) {
          return;
        }

        // Must have at least 2 arguments (callback + initial value)
        if (node.arguments.length < 2) {
          return;
        }

        // Already has a type parameter — user is doing the right thing
        if (node.typeArguments && node.typeArguments.params.length > 0) {
          return;
        }

        const initialValue = node.arguments[1];
        if (!initialValue || initialValue.type === 'SpreadElement') {
          return;
        }
        if (containsAsExpression(initialValue)) {
          const sourceCode = context.sourceCode;
          const callee = node.callee;
          // Autofix when the entire initial value is `expr as Type`
          const canFix =
            initialValue.type === 'TSAsExpression' && callee.type === 'MemberExpression';
          const fix = canFix
            ? (fixer: RuleFixer) => {
                const typeText = sourceCode.getText(initialValue.typeAnnotation);
                const exprText = sourceCode.getText(initialValue.expression);
                return [
                  // Add <Type> after `reduce`
                  fixer.insertTextAfterRange(callee.property.range, `<${typeText}>`),
                  // Replace `expr as Type` with just `expr`
                  fixer.replaceTextRange(initialValue.range, exprText),
                ];
              }
            : undefined;
          context.report({
            node: initialValue,
            messageId: 'preferTypeParameter',
            fix,
          });
        }
      },
    };
  },
});
