import {ESLintUtils} from '@typescript-eslint/utils';
/**
 * ESLint rule: use-semantic-token
 *
 * Enforces that theme.tokens.* tokens are only used with appropriate
 * CSS properties based on their semantic category.
 */

import {createStyleCollector, shouldAnalyze} from '../ast/extractor/index';
import type {StyleDeclaration} from '../ast/extractor/types';
import {findRuleForToken, PROPERTY_TO_RULE} from '../config/tokenRules';

export interface Options {
  enabledCategories?: string[];
}

export const useSemanticToken = ESLintUtils.RuleCreator.withoutDocs<
  [Options],
  'invalidProperty' | 'invalidPropertyWithSuggestion'
>({
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
  defaultOptions: [{}],
  create(context, [options = {}]) {
    // Fast bailout: skip files without emotion/styled patterns
    if (!shouldAnalyze(context)) {
      return {};
    }

    const enabledCategories = options.enabledCategories
      ? new Set(options.enabledCategories)
      : null; // null means all enabled

    /**
     * Check if a category is enabled in the rule options.
     * @returns {boolean}
     */
    function isCategoryEnabled(categoryName: string) {
      return enabledCategories === null || enabledCategories.has(categoryName);
    }
    const {collector, visitors} = createStyleCollector(context);

    /**
     * Validate a single StyleDeclaration
     */
    function validateDeclaration(decl: StyleDeclaration) {
      const normalizedProperty = decl.property.name;
      if (normalizedProperty.startsWith('--')) {
        return;
      }

      for (const value of decl.values) {
        if (!value.tokenInfo) {
          continue;
        }
        const {tokenPath, node: tokenNode} = value.tokenInfo;
        const rule = findRuleForToken(tokenPath);

        if (!rule) {
          continue;
        }
        if (!isCategoryEnabled(rule.name)) {
          continue;
        }
        if (!rule.allowedProperties.has(normalizedProperty)) {
          const suggestedCategory = PROPERTY_TO_RULE.get(normalizedProperty);
          if (suggestedCategory) {
            context.report({
              node: tokenNode,
              messageId: 'invalidPropertyWithSuggestion',
              data: {
                tokenPath,
                property: normalizedProperty,
                suggestedCategory,
              },
            });
          } else {
            context.report({
              node: tokenNode,
              messageId: 'invalidProperty',
              data: {
                tokenPath,
                property: normalizedProperty,
              },
            });
          }
        }
      }
    }
    return {
      ...visitors,
      'Program:exit'() {
        for (const declaration of collector.getAll()) {
          validateDeclaration(declaration);
        }
        // Clean up for next file
        collector.clear();
      },
    };
  },
});
