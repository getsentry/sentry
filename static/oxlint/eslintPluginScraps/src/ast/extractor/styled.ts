import type {ESTree, Visitor} from '@oxlint/plugins';
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

import {normalizePropertyName} from '../utils/normalizePropertyName.ts';
import {getStyledCallInfo} from '../utils/styled.ts';

import {parseCssTemplate} from './css.ts';
import type {ExtractorContext, StyleDeclaration} from './types.ts';
import {decomposeValue} from './valueDecomposer.ts';

/**
 * Creates the styled/css extractor with ESLint visitors.
 */
export function createStyledExtractor({
  collector,
  themeTracker,
  ruleContext,
  importTracker,
}: ExtractorContext): Visitor {
  /**
   * Check if we're in a lookup table pattern that should be excluded.
   * e.g., ({ none: theme.tokens.content.primary })[status]
   */
  function isLookupTablePattern(node: ESTree.Node) {
    let current = node;
    while (current?.parent) {
      current = current.parent;
      if (
        current.type === 'MemberExpression' &&
        current.computed &&
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
    templateNode: ESTree.TemplateLiteral,
    sourceNode: ESTree.Node
  ) {
    const parsed = parseCssTemplate(
      templateNode,
      ruleContext.sourceCode.getText(templateNode)
    );
    if (!parsed) {
      return;
    }

    for (const declaration of parsed) {
      for (const {expression, index} of declaration.interpolations) {
        const precedingQuasi = templateNode.quasis[index];
        if (!precedingQuasi) {
          continue;
        }
        collector.add({
          kind: 'styled',
          property: {name: declaration.name, node: precedingQuasi},
          values: decomposeValue(expression, themeTracker),
          context: {
            file: ruleContext.filename,
            scopeId: themeTracker.getCurrentScopeId(),
            themeBinding: themeTracker.getActiveBinding(),
          },
          raw: {containerNode: templateNode, sourceNode},
        });
      }
    }
  }

  /**
   * Process an object expression from styled.div({ ... }) syntax.
   */
  function processObjectExpression(
    objNode: ESTree.ObjectExpression,
    sourceNode: ESTree.Node
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
    TaggedTemplateExpression(node: ESTree.TaggedTemplateExpression) {
      if (!getStyledCallInfo(node, importTracker)) {
        return;
      }
      processTemplateLiteral(node.quasi, node);
    },

    // Handle styled.div({ ... }) object syntax
    CallExpression(node: ESTree.CallExpression) {
      if (!getStyledCallInfo(node, importTracker)) {
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
