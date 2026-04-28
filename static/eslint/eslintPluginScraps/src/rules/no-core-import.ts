/**
 * ESLint rule: no-core-import
 *
 * Disallows imports from 'sentry/components/core' and autofixes them to '@sentry/scraps'.
 */
import {ESLintUtils} from '@typescript-eslint/utils';

const FORBIDDEN_PATH = 'sentry/components/core/';
const REPLACEMENT_PATH = '@sentry/scraps';

export const noCoreImport = ESLintUtils.RuleCreator.withoutDocs({
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
        if (node?.source.type !== 'Literal') return;

        const importPath = node.source.value;

        if (typeof importPath !== 'string') {
          return;
        }

        if (importPath.startsWith(FORBIDDEN_PATH)) {
          context.report({
            node,
            messageId: 'forbidden',
            fix(fixer) {
              let newPath = REPLACEMENT_PATH;

              // Check if we are importing from a subpath and extract the component
              if (importPath.startsWith(FORBIDDEN_PATH)) {
                const firstComponent = importPath.split('/')[3];
                newPath = `${REPLACEMENT_PATH}/${firstComponent}`;
              }

              return fixer.replaceText(node.source, `'${newPath}'`);
            },
          });
        }
      },
    };
  },
});
