import {defineRule} from '@oxlint/plugins';
/**
 * ESLint rule: use-semantic-token
 *
 * Enforces that theme.tokens.* tokens are only used with appropriate
 * CSS properties based on their semantic category.
 */

import {createStyleVisitors, shouldAnalyze} from '../ast/extractor/index.ts';
import {findRuleForToken, PROPERTY_TO_RULE} from '../config/tokenRules.ts';

interface Options {
  enabledCategories?: string[];
}

export const useSemanticToken = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Enforce that theme.tokens.* tokens are only used with appropriate CSS properties',
    },
    schema: [
      {
        type: 'object',
        properties: {
          enabledCategories: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      invalidProperty: '`{{property}}` cannot use token `{{tokenPath}}`',
      invalidPropertyWithSuggestion:
        '`{{property}}` cannot use token `{{tokenPath}}`. Use a `{{suggestedCategory}}` token instead.',
    },
  },
  create(context) {
    const options = (context.options[0] ?? {}) as Options;
    // Fast bailout: skip files without emotion/styled patterns
    if (!shouldAnalyze(context)) {
      return {};
    }

    const enabledCategories = options.enabledCategories
      ? new Set(options.enabledCategories)
      : null; // null means all enabled

    return createStyleVisitors(context, (property, {node, tokenPath}) => {
      if (property.startsWith('--')) {
        return;
      }
      const rule = findRuleForToken(tokenPath);
      if (
        !rule ||
        (enabledCategories && !enabledCategories.has(rule.name)) ||
        rule.allowedProperties.has(property)
      ) {
        return;
      }
      const suggestedCategory = PROPERTY_TO_RULE.get(property);
      if (suggestedCategory) {
        context.report({
          node,
          messageId: 'invalidPropertyWithSuggestion',
          data: {tokenPath, property, suggestedCategory},
        });
      } else {
        context.report({
          node,
          messageId: 'invalidProperty',
          data: {tokenPath, property},
        });
      }
    });
  },
});
