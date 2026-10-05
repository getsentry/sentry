import type {ESTree, Context, Visitor} from '@oxlint/plugins';

import {createThemeTracker} from '../tracker/theme.ts';

import {createCssPropExtractor} from './cssProp.ts';
import {createStyledExtractor} from './styled.ts';
import {createStylePropExtractor} from './styleProp.ts';
import type {ExtractorContext, StyleCollector, StyleDeclaration} from './types.ts';

/**
 * @file Aggregates all style extractors and provides the collector factory.
 */

/**
 * Lightweight regex pre-scan to detect if file needs style analysis.
 * Returns false if file has no emotion/styled patterns.
 * False positives are acceptable; we just want to skip clearly unrelated files.
 */
export function shouldAnalyze(context: Readonly<Context>) {
  const text = context.sourceCode.getText();

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
 */
function mergeVisitors(...visitorObjects: Visitor[]) {
  const merged: Visitor = {};

  for (const visitors of visitorObjects) {
    for (const [nodeType, handler] of Object.entries(visitors)) {
      if (!handler) {
        continue;
      }
      const existing = merged[nodeType] as ((node: ESTree.Node) => void) | undefined;
      if (existing) {
        merged[nodeType] = (node: ESTree.Node) => {
          existing(node);
          (handler as (node: ESTree.Node) => void)(node);
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
 */
export function createStyleCollector(context: Context) {
  const declarations: StyleDeclaration[] = [];

  const collector: StyleCollector = {
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
  const themeTracker = createThemeTracker();

  // Create extractors with access to collector and theme tracker
  const extractorContext: ExtractorContext = {
    collector,
    themeTracker,
    ruleContext: context,
  };

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
