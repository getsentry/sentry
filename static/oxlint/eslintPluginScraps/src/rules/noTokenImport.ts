import {defineRule} from '@oxlint/plugins';

/**
 * ESLint rule: no-token-import
 *
 * Disallows raw token imports outside theme definitions and token exports.
 */

const TOKEN_PATH = 'utils/theme/scraps';
const EXCEPT_DIRS = [
  'static/app/utils/theme/',
  'packages/scraps/src/theme/',
  'packages/scraps/src/tokens/',
];

/**
 *
 * @param {unknown} importPath
 * @returns {boolean}
 */
function isForbiddenImportPath(importPath: string) {
  if (typeof importPath !== 'string') {
    return false;
  }

  return (
    importPath.includes(TOKEN_PATH) ||
    importPath === '@sentry/scraps/tokens' ||
    importPath.startsWith('@sentry/scraps/tokens/')
  );
}

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
    const importerIsInAllowedDir = EXCEPT_DIRS.some(directory =>
      context.filename.includes(directory)
    );

    return {
      ImportDeclaration(node) {
        if (node?.source.type !== 'Literal') {
          return;
        }
        if (importerIsInAllowedDir) {
          return;
        }

        const value = node.source.value;

        if (isForbiddenImportPath(value)) {
          context.report({
            node,
            messageId: 'forbidden',
          });
        }
      },
    };
  },
});
