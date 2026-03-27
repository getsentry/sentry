import type {TSESTree} from '@typescript-eslint/utils';
import {ESLintUtils} from '@typescript-eslint/utils';

function getJSXTagName(element: TSESTree.JSXOpeningElement) {
  return element.name.type === 'JSXIdentifier' && element.name.name;
}

function isComponentName(name: string) {
  return /^[A-Z]/.test(name);
}

function getMeaningfulChildren(children: TSESTree.JSXChild[]) {
  const meaningful: TSESTree.JSXElement[] = [];

  for (const child of children) {
    switch (child.type) {
      case 'JSXElement':
        meaningful.push(child);
        break;

      case 'JSXText':
        if (child.value.trim() !== '') {
          return [];
        }
        break;

      default:
        return [];
    }
  }

  return meaningful;
}

export const preferAdditionalWrapperRender = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer the `additionalWrapper` option over wrapping JSX in render()',
    },
    fixable: 'code',
    schema: [],
    messages: {
      useAdditionalWrapper:
        'Prefer the `additionalWrapper` option instead of wrapping JSX in render().',
    },
  },
  create(context) {
    let renderLocalName: string | null = null;

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'sentry-test/reactTestingLibrary') {
          return;
        }

        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.type === 'Identifier' &&
            specifier.imported.name === 'render'
          ) {
            renderLocalName = specifier.local.name;
          }
        }
      },

      CallExpression(node) {
        if (
          !renderLocalName ||
          node.callee.type !== 'Identifier' ||
          node.callee.name !== renderLocalName
        ) {
          return;
        }

        const firstArgument = node.arguments[0];
        if (
          firstArgument?.type !== 'JSXElement' ||
          firstArgument.openingElement.attributes.length > 0
        ) {
          return;
        }

        const wrapperName = getJSXTagName(firstArgument.openingElement);
        if (!wrapperName || !isComponentName(wrapperName)) {
          return;
        }

        const meaningfulChildren = getMeaningfulChildren(firstArgument.children);
        if (meaningfulChildren.length !== 1) {
          return;
        }

        const secondArgument = node.arguments[1];
        if (secondArgument && secondArgument.type !== 'ObjectExpression') {
          return;
        }

        context.report({
          node: firstArgument,
          messageId: 'useAdditionalWrapper',
          data: {wrapperName},
          *fix(fixer) {
            const childText = context.sourceCode.getText(meaningfulChildren[0]);

            yield fixer.replaceText(firstArgument, childText);

            if (secondArgument) {
              if (secondArgument.properties.length > 0) {
                yield fixer.insertTextAfter(
                  secondArgument.properties.at(-1)!,
                  `, additionalWrapper: ${wrapperName}`
                );
              } else {
                yield fixer.replaceText(
                  secondArgument,
                  `{additionalWrapper: ${wrapperName}}`
                );
              }
            } else if (!secondArgument) {
              yield fixer.insertTextAfter(
                firstArgument,
                `, {additionalWrapper: ${wrapperName}}`
              );
            }
          },
        });
      },
    };
  },
});
