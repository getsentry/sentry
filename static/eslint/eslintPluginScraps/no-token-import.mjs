const TOKEN_PATH = 'utils/theme/scraps';
const EXCEPT_DIR_NAME = 'static/app/utils/theme';

/**
 *
 * @param {unknown} importPath
 * @returns {boolean}
 */
function isForbiddenImportPath(importPath) {
  if (typeof importPath !== 'string') return false;

  return importPath.includes(TOKEN_PATH);
}

/**
 * @type {import('eslint').Rule.RuleModule}
 */
const noTokenImport = {
  meta: {
    type: 'problem',
    docs: {
      description: `Disallow imports from "${TOKEN_PATH}" except within a directory named "${EXCEPT_DIR_NAME}".`,
      recommended: false,
    },
    schema: [],
    messages: {
      forbidden: `Do not import scraps tokens directly - prefer using theme tokens.`,
    },
  },

  create(context) {
    const importerIsInAllowedDir = context.filename?.includes(EXCEPT_DIR_NAME);

    return {
      ImportDeclaration(node) {
        if (!node || node.source.type !== 'Literal') return;
        if (importerIsInAllowedDir) return;

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
};

export default noTokenImport;
