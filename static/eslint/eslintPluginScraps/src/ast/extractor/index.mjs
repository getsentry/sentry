/**
 * @file Aggregates all style extractors and provides the collector factory.
 */

import {createCssPropExtractor} from './css-prop.mjs';
import {createStylePropExtractor} from './style-prop.mjs';
import {createStyledExtractor} from './styled.mjs';
import {createThemeTracker} from './theme.mjs';

/**
 * Merge multiple visitor objects, combining handlers for same node types.
 *
 * @param  {...Record<string, Function>} visitorObjects
 * @returns {Record<string, Function>}
 */
function mergeVisitors(...visitorObjects) {
  /** @type {Record<string, Function>} */
  const merged = {};

  for (const visitors of visitorObjects) {
    for (const [nodeType, handler] of Object.entries(visitors)) {
      if (merged[nodeType]) {
        const existing = merged[nodeType];
        merged[nodeType] = (/** @type {import('estree').Node} */ node) => {
          existing(node);
          handler(node);
        };
      } else {
        merged[nodeType] = handler;
      }
    }
  }

  return merged;
}

/**
 * Creates a style collector that aggregates declarations from all extractors.
 *
 * @param {import('eslint').Rule.RuleContext} context
 * @returns {{
 *   collector: import('./types.mjs').StyleCollector,
 *   visitors: Record<string, Function>,
 *   themeTracker: import('./types.mjs').ThemeTracker
 * }}
 */
export function createStyleCollector(context) {
  /** @type {import('./types.mjs').StyleDeclaration[]} */
  const declarations = [];

  /** @type {import('./types.mjs').StyleCollector} */
  const collector = {
    add(decl) {
      declarations.push(decl);
    },
    getAll() {
      return declarations;
    },
    clear() {
      declarations.length = 0;
    },
  };

  // Create theme tracker first (extractors depend on it)
  const themeTracker = createThemeTracker(context);

  // Create extractors with access to collector and theme tracker
  /** @type {import('./types.mjs').ExtractorContext} */
  const extractorContext = {collector, themeTracker, ruleContext: context};

  const styledVisitors = createStyledExtractor(extractorContext);
  const cssPropVisitors = createCssPropExtractor(extractorContext);
  const stylePropVisitors = createStylePropExtractor(extractorContext);

  // Merge all visitors
  const visitors = mergeVisitors(
    themeTracker.visitors,
    styledVisitors,
    cssPropVisitors,
    stylePropVisitors
  );

  return {collector, visitors, themeTracker};
}

export {createStyledExtractor} from './styled.mjs';
export {createCssPropExtractor} from './css-prop.mjs';
export {createStylePropExtractor} from './style-prop.mjs';
export {createThemeTracker} from './theme.mjs';
export {decomposeValue} from './value-decomposer.mjs';
