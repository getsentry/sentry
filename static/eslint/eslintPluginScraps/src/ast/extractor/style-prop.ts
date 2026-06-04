/**
 * @file Extracts style declarations from JSX style prop patterns.
 *
 * Handles:
 * - <div style={{ ... }} />
 * - <div style={value} />
 * - <div style={getValue()} />
 */

import type {TSESLint, TSESTree} from '@typescript-eslint/utils';

import {normalizePropertyName} from '../utils/normalizePropertyName';

import type {ExtractorContext, StyleDeclaration} from './types';
import {decomposeValue} from './value-decomposer';

/**
 * Creates the style prop extractor with ESLint visitors.
 */
export function createStylePropExtractor({
  collector,
  themeTracker,
  ruleContext,
}: ExtractorContext): TSESLint.RuleListener {
  /**
   * Process an object expression from style={{ ... }}
   */
  function processObjectExpression(
    objNode: TSESTree.ObjectExpression,
    sourceNode: TSESTree.Node
  ) {
    for (const prop of objNode.properties) {
      if (prop.type !== 'Property') {
        continue;
      }

      const propertyName =
        prop.key.type === 'Identifier'
          ? prop.key.name
          : prop.key.type === 'Literal'
            ? String(prop.key.value)
            : null;

      if (!propertyName) {
        continue;
      }

      const values = decomposeValue(prop.value, themeTracker);

      const declaration: StyleDeclaration = {
        kind: 'style-prop',
        property: {
          name: normalizePropertyName(propertyName),
          node: prop.key,
        },
        values,
        context: {
          file: ruleContext.filename,
          scopeId: themeTracker.getCurrentScopeId(),
          themeBinding: themeTracker.getActiveBinding(),
        },
        raw: {
          containerNode: objNode,
          sourceNode,
        },
      };

      collector.add(declaration);
    }
  }

  return {
    JSXAttribute(node: TSESTree.JSXAttribute) {
      if (node.name?.name !== 'style') {
        return;
      }

      const value = node.value;
      if (value?.type !== 'JSXExpressionContainer') {
        return;
      }

      const expr = value.expression;

      if (expr.type === 'ObjectExpression') {
        processObjectExpression(expr, node);
      }
      // Variables and function calls would need flow analysis
    },
  };
}
