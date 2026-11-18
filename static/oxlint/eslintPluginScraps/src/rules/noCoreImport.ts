import {defineRule} from '@oxlint/plugins';
/**
 * ESLint rule: no-core-import
 *
 * Disallows imports from 'sentry/components/core' and autofixes them to '@sentry/scraps'.
 */

const FORBIDDEN_PATH = 'sentry/components/core/';
const REPLACEMENT_PATH = '@sentry/scraps';

export const noCoreImport = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: `Disallow imports from "${FORBIDDEN_PATH}" and autofix to "${REPLACEMENT_PATH}".`,
    },
    fixable: 'code',
    schema: [],
    messages: {
      forbidden: `Import from "${REPLACEMENT_PATH}" instead of "sentry/components/core".`,
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const importPath = node.source.value;

        if (
          !importPath.startsWith(FORBIDDEN_PATH) ||
          /^sentry\/components\/core\/badge\/(alertBadge|deployBadge|projectsBadge)$/.test(
            importPath
          )
        ) {
          return;
        }

        context.report({
          node,
          messageId: 'forbidden',
          fix: fixer =>
            fixer.replaceText(
              node.source,
              `'${REPLACEMENT_PATH}/${importPath.split('/')[3]}'`
            ),
        });
      },
    };
  },
});
