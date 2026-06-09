import {ESLintUtils} from '@typescript-eslint/utils';

import {shouldAnalyze} from '../ast/extractor/index';
import {getStyledCallInfo} from '../ast/utils/styled';

export const noDoubleDollarInterpolation = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description:
        'Disallow a doubled `$` before an interpolation in styled/css templates',
    },
    schema: [],
    messages: {
      doubleDollar:
        'Doubled `$` before interpolation emits a literal "$" into the CSS, producing an invalid declaration. Use `${...}`.',
    },
  },
  defaultOptions: [],
  create(context) {
    if (!shouldAnalyze(context)) {
      return {};
    }

    return {
      TaggedTemplateExpression(node) {
        if (!getStyledCallInfo(node)) {
          return;
        }

        for (const quasi of node.quasi.quasis) {
          if (
            // A tail quasi has no following interpolation, so a trailing `$`
            // cannot be the `$${...}` pattern.
            quasi.tail ||
            // Match a trailing `$` that is not itself escaped (`\$`).
            !/(?<!\\)\$$/.test(quasi.value.raw)
          ) {
            continue;
          }

          // range[1] is the start of the following expression, so `${`
          // occupies [range[1] - 2, range[1]) and the stray literal `$`
          // sits immediately before it at range[1] - 3.
          const dollarIndex = quasi.range[1] - 3;

          context.report({
            node: quasi,
            messageId: 'doubleDollar',
            fix: fixer => fixer.removeRange([dollarIndex, dollarIndex + 1]),
          });
        }
      },
    };
  },
});
