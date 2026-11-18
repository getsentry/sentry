import {defineRule} from '@oxlint/plugins';

/**
 * ESLint rule: no-token-import
 *
 * Disallows raw token imports outside theme definitions and token exports.
 */

const EXCEPT_DIRS = [
  'static/packages/scraps/src/theme/',
  'static/packages/scraps/src/tokens/',
];

export const noTokenImport = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow raw token imports outside theme definitions and token exports.',
    },
    schema: [],
    messages: {
      forbidden: 'Do not import scraps tokens directly - prefer using theme tokens.',
    },
  },
  create(context) {
    if (EXCEPT_DIRS.some(directory => context.filename.includes(directory))) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        const value = node.source.value;

        if (
          value === '@sentry/scraps/tokens' ||
          value.startsWith('@sentry/scraps/tokens/')
        ) {
          context.report({
            node,
            messageId: 'forbidden',
          });
        }
      },
    };
  },
});
