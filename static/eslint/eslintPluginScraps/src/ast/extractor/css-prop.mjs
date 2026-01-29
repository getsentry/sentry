/**
 * @file Extracts style declarations from JSX css prop patterns.
 *
 * Handles:
 * - <div css={css`...`} />
 * - <div css={{ ... }} />
 * - <div css={[...]} />
 * - <div css={(theme) => { ... }} />
 */

import {normalizePropertyName} from '../utils/normalizePropertyName.mjs';

import {decomposeValue} from './value-decomposer.mjs';

/**
 * Creates the css prop extractor with ESLint visitors.
 *
 * @param {import('./types.mjs').ExtractorContext} extractorContext
 * @returns {Record<string, Function>}
 */
export function createCssPropExtractor({collector, themeTracker, ruleContext}) {
  /**
   * Process an object expression from css={{ ... }}
   *
   * @param {import('estree').ObjectExpression} objNode
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
        kind: 'css-prop',
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

  /**
   * Process an array of styles css={[...]}
   *
   * @param {import('estree').ArrayExpression} arrNode
   * @param {import('estree').Node} sourceNode
   */
  function processArrayExpression(arrNode, sourceNode) {
    for (const element of arrNode.elements) {
      if (!element) {
        continue;
      }

      if (element.type === 'ObjectExpression') {
        processObjectExpression(element, sourceNode);
      }
      // TaggedTemplateExpressions (css`...`) are handled by the styled extractor
    }
  }

  /**
   * Process an arrow function css={(theme) => ...}
   *
   * @param {import('estree').ArrowFunctionExpression} arrowNode
   * @param {import('estree').Node} sourceNode
   */
  function processArrowFunction(arrowNode, sourceNode) {
    // Register theme parameter binding
    const themeParam = arrowNode.params[0];
    if (themeParam?.type === 'Identifier') {
      themeTracker.registerCallbackBinding(themeParam.name, arrowNode);
    }

    const body = arrowNode.body;

    if (body.type === 'ObjectExpression') {
      processObjectExpression(body, sourceNode);
    }
    // BlockStatement bodies would need return statement analysis
  }

  return {
    /** @param {import('estree-jsx').JSXAttribute} node */
    JSXAttribute(node) {
      if (node.name?.name !== 'css') {
        return;
      }

      const value = node.value;
      if (!value || value.type !== 'JSXExpressionContainer') {
        return;
      }

      const expr = value.expression;

      if (expr.type === 'ObjectExpression') {
        processObjectExpression(expr, node);
      } else if (expr.type === 'ArrayExpression') {
        processArrayExpression(expr, node);
      } else if (expr.type === 'ArrowFunctionExpression') {
        processArrowFunction(expr, node);
      }
      // TaggedTemplateExpressions (css`...`) are handled by styled extractor
    },
  };
}
