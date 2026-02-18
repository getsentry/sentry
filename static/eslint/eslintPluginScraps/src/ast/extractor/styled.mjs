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

import {normalizePropertyName} from '../utils/normalizePropertyName.mjs';

import {decomposeValue} from './value-decomposer.mjs';

/**
 * Creates the styled/css extractor with ESLint visitors.
 *
 * @param {import('./types.mjs').ExtractorContext} extractorContext
 * @returns {Record<string, Function>}
 */
export function createStyledExtractor({collector, themeTracker, ruleContext}) {
  /**
   * Extract CSS property from template literal quasi text.
   * Must correctly handle nested selectors (a:hover) and only match actual properties.
   *
   * @param {string} cssText
   * @returns {string | null}
   */
  function extractCssProperty(cssText) {
    // Match a CSS property declaration: property-name: value
    // The property must appear after {, ;, or at line start (with optional whitespace)
    // This avoids matching pseudo-selectors like a:hover
    const match = cssText.match(/(?:^|[{;])\s*([a-z-]+)\s*:\s*[^;{]*$/i);
    return match?.[1] ?? null;
  }

  /**
   * Check if a tagged template is a styled/css pattern.
   *
   * @param {import('estree').TaggedTemplateExpression} node
   * @returns {boolean}
   */
  function isStyledOrCssTag(node) {
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
   *
   * @param {import('estree').Node & {parent?: import('estree').Node}} node
   * @returns {boolean}
   */
  function isLookupTablePattern(node) {
    /** @type {import('estree').Node & {parent?: import('estree').Node} | undefined} */
    let current = node;
    while (current?.parent) {
      current = /** @type {import('estree').Node & {parent?: import('estree').Node}} */ (
        current.parent
      );
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
   *
   * @param {import('estree').TemplateLiteral} templateNode
   * @param {import('estree').Node} sourceNode
   */
  function processTemplateLiteral(templateNode, sourceNode) {
    templateNode.expressions?.forEach(
      (
        /** @type {import('estree').Expression | import('estree').PrivateIdentifier} */ expr,
        /** @type {number} */ index
      ) => {
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
        const values = decomposeValue(
          /** @type {import('estree').Node} */ (expr),
          themeTracker
        );

        /** @type {import('./types.mjs').StyleDeclaration} */
        const declaration = {
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
      }
    );
  }

  /**
   * Process an object expression from styled.div({ ... }) syntax.
   *
   * @param {import('estree').ObjectExpression & {parent?: import('estree').Node}} objNode
   * @param {import('estree').Node} sourceNode
   */
  function processObjectExpression(objNode, sourceNode) {
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

      /** @type {import('./types.mjs').StyleDeclaration} */
      const declaration = {
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
    /** @param {import('estree').TaggedTemplateExpression} node */
    TaggedTemplateExpression(node) {
      if (!isStyledOrCssTag(node)) {
        return;
      }
      processTemplateLiteral(node.quasi, node);
    },

    // Handle styled.div({ ... }) object syntax
    /** @param {import('estree').CallExpression} node */
    CallExpression(node) {
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
        processObjectExpression(
          /** @type {import('estree').ObjectExpression & {parent?: import('estree').Node}} */ (
            objectArg
          ),
          node
        );
      }
    },
  };
}
