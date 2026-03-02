/**
 * @file Extracts style declarations from JSX css prop patterns.
 *
 * Handles:
 * - <div css={css`...`} />
 * - <div css={{ ... }} />
 * - <div css={[...]} />
 * - <div css={(theme) => { ... }} />
 */

import type {TSESTree} from '@typescript-eslint/utils';

import {normalizePropertyName} from '../utils/normalizePropertyName';

import type {ExtractorContext, StyleDeclaration} from './types';
import {decomposeValue} from './value-decomposer';

/**
 * Creates the css prop extractor with ESLint visitors.
 */
export function createCssPropExtractor({
  collector,
  themeTracker,
  ruleContext,
}: ExtractorContext) {
  /**
   * Process an object expression from css={{ ... }}
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
   */
  function processArrayExpression(
    arrNode: TSESTree.ArrayExpression,
    sourceNode: TSESTree.Node
  ) {
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
   */
  function processArrowFunction(
    arrowNode: TSESTree.ArrowFunctionExpression,
    sourceNode: TSESTree.Node
  ) {
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
    JSXAttribute(node: TSESTree.JSXAttribute) {
      if (node.name?.name !== 'css') {
        return;
      }

      const value = node.value;
      if (value?.type !== 'JSXExpressionContainer') {
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
