/**
 * @file Extracts style declarations from styled-components/emotion patterns.
 *
 * Handles:
 * - styled.div`...`
 * - styled.div({ ... })
 * - styled('div')`...`
 * - styled('div')({ ... })
 * - styled(Component)`...`
 * - css`...`
 */

import type {TSESLint, TSESTree} from '@typescript-eslint/utils';

import {normalizePropertyName} from '../utils/normalizePropertyName';

import type {ExtractorContext, StyleDeclaration} from './types';
import {decomposeValue} from './value-decomposer';

/**
 * Creates the styled/css extractor with ESLint visitors.
 */
export function createStyledExtractor({
  collector,
  themeTracker,
  ruleContext,
}: ExtractorContext): TSESLint.RuleListener {
  /**
   * Extract CSS property from template literal quasi text.
   * Must correctly handle nested selectors (a:hover) and only match actual properties.
   */
  function extractCssProperty(cssText: string) {
    // Match a CSS property declaration: property-name: value
    // The property must appear after {, ;, or at line start (with optional whitespace)
    // This avoids matching pseudo-selectors like a:hover
    const match = cssText.match(/(?:^|[{;])\s*([a-z-]+)\s*:\s*[^;{]*$/i);
    return match?.[1] ?? null;
  }

  /**
   * Check if a tagged template is a styled/css pattern.
   */
  function isStyledOrCssTag(node: TSESTree.TaggedTemplateExpression) {
    const tag = node.tag;
    return (
      (tag.type === 'Identifier' && tag.name === 'css') ||
      (tag.type === 'MemberExpression' &&
        ((tag.property.type === 'Identifier' && tag.property.name === 'css') ||
          (tag.object.type === 'Identifier' && tag.object.name === 'styled'))) ||
      (tag.type === 'CallExpression' &&
        tag.callee.type === 'Identifier' &&
        tag.callee.name === 'styled')
    );
  }

  /**
   * Check if we're in a lookup table pattern that should be excluded.
   * e.g., ({ none: theme.tokens.content.primary })[status]
   */
  function isLookupTablePattern(node: TSESTree.Node) {
    let current = node;
    while (current?.parent) {
      current = current.parent;
      if (
        current.type === 'MemberExpression' &&
        current.computed === true &&
        current.object?.type === 'ObjectExpression'
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Process a template literal and extract style declarations.
   */
  function processTemplateLiteral(
    templateNode: TSESTree.TemplateLiteral,
    sourceNode: TSESTree.Node
  ) {
    templateNode.expressions?.forEach((expr, index) => {
      const precedingQuasi = templateNode.quasis[index];
      if (!precedingQuasi) {
        return;
      }

      const cssText = precedingQuasi.value.cooked || precedingQuasi.value.raw;
      if (!cssText) {
        return;
      }

      const property = extractCssProperty(cssText);
      if (!property) {
        return;
      }

      // Decompose the expression into possible values
      const values = decomposeValue(expr, themeTracker);

      const declaration: StyleDeclaration = {
        kind: 'styled',
        property: {
          name: normalizePropertyName(property),
          node: precedingQuasi,
        },
        values,
        context: {
          file: ruleContext.filename,
          scopeId: themeTracker.getCurrentScopeId(),
          themeBinding: themeTracker.getActiveBinding(),
        },
        raw: {
          containerNode: templateNode,
          sourceNode,
        },
      };

      collector.add(declaration);
    });
  }

  /**
   * Process an object expression from styled.div({ ... }) syntax.
   */
  function processObjectExpression(
    objNode: TSESTree.ObjectExpression,
    sourceNode: TSESTree.Node
  ) {
    // Skip lookup table patterns
    if (isLookupTablePattern(objNode)) {
      return;
    }

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
        kind: 'styled',
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
    TaggedTemplateExpression(node: TSESTree.TaggedTemplateExpression) {
      if (!isStyledOrCssTag(node)) {
        return;
      }
      processTemplateLiteral(node.quasi, node);
    },

    // Handle styled.div({ ... }) object syntax
    CallExpression(node: TSESTree.CallExpression) {
      const callee = node.callee;

      let isStyledCall = false;

      // styled.div({ ... })
      if (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.object.name === 'styled'
      ) {
        isStyledCall = true;
      }

      // styled('div')({ ... }) - callee is a CallExpression
      if (
        callee.type === 'CallExpression' &&
        callee.callee.type === 'Identifier' &&
        callee.callee.name === 'styled'
      ) {
        isStyledCall = true;
      }

      if (!isStyledCall) {
        return;
      }

      // Process object argument
      const objectArg = node.arguments[0];
      if (objectArg?.type === 'ObjectExpression') {
        processObjectExpression(objectArg, node);
      }
    },
  };
}
