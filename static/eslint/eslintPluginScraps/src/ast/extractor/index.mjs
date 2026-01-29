import {createCssPropExtractor} from './css-prop.mjs';
import {createStylePropExtractor} from './style-prop.mjs';
import {createStyledExtractor} from './styled.mjs';
import {createThemeTracker} from './theme.mjs';

/**
 * @file Aggregates all style extractors and provides the collector factory.
 */

/**
 * Lightweight regex pre-scan to detect if file needs style analysis.
 * Returns false if file has no emotion/styled patterns.
 * False positives are acceptable; we just want to skip clearly unrelated files.
 *
 * @param {import('eslint').Rule.RuleContext} context
 * @returns {boolean}
 */
export function shouldAnalyze(context) {
  const sourceCode = context.sourceCode ?? context.getSourceCode();
  const text = sourceCode.getText();

  // Check for emotion imports OR usage patterns
  // We check both because:
  // - Files with imports but no usage are rare but possible (re-exports)
  // - Files with usage but no direct import may get styled/css from elsewhere
  const hasEmotionImport =
    text.includes('@emotion/styled') || text.includes('@emotion/react');

  const hasUsagePattern =
    /\buseTheme\b/.test(text) || // useTheme hook
    /\bstyled[.(`]/.test(text) || // styled.div, styled(, styled`
    /\bcss[`({]/.test(text) || // css`, css(, css{
    /\b(?:css|style)\s*=/.test(text); // css= or style= JSX attrs

  return hasEmotionImport || hasUsagePattern;
}

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
