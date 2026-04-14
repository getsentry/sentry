import {ESLintUtils} from '@typescript-eslint/utils';

export const noFlagComments = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow flag-style section separator comments (e.g. // ----------)',
    },
    schema: [],
    messages: {
      noFlagComment:
        'Avoid flag-style section separator comments. If you need to section your module, consider splitting it into multiple modules. To document a function, use a JSDoc comment instead. If you truly want to add a comment explaining a section of code, simply do not add the dashes.',
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type === 'Line' && /^-{3,}\s*$/.test(comment.value.trim())) {
            context.report({
              loc: comment.loc,
              messageId: 'noFlagComment',
            });
          }
        }
      },
    };
  },
});
