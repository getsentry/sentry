/**
 * @file Extracts style declarations from JSX style prop patterns.
 *
 * Handles:
 * - <div style={{ ... }} />
 * - <div style={value} />
 * - <div style={getValue()} />
 */

import {normalizePropertyName} from '../utils/normalizePropertyName.mjs';

import {decomposeValue} from './value-decomposer.mjs';

/**
 * Creates the style prop extractor with ESLint visitors.
 *
 * @param {import('./types.mjs').ExtractorContext} extractorContext
 * @returns {Record<string, Function>}
 */
export function createStylePropExtractor({collector, themeTracker, ruleContext}) {
  /**
   * Process an object expression from style={{ ... }}
   *
   * @param {any} objNode
   * @param {import('estree').Node} sourceNode
   */
  function processObjectExpression(objNode, sourceNode) {
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

      /** @type {import('./types.mjs').StyleDeclaration} */
      const declaration = {
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
    /**
     * @param {import("estree-jsx").JSXAttribute} node
     */
    JSXAttribute(node) {
      if (node.name?.name !== 'style') {
        return;
      }

      const value = node.value;
      if (!value || value.type !== 'JSXExpressionContainer') {
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
