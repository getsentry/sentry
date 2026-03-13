/**
 * @file Reusable scanner for static CSS text in tagged template literals.
 *
 * Wraps the common pattern: shouldAnalyze → TaggedTemplateExpression → check tag
 * → iterate quasi.quasis → call analyze callback.
 *
 * Usage:
 *   create(context) {
 *     return createQuasiScanner(context, (cssText, quasi, info) => {
 *       // pattern-match cssText, report on quasi
 *     });
 *   }
 */

import type {TSESLint, TSESTree} from '@typescript-eslint/utils';

import {shouldAnalyze} from '../extractor/index';
import {getStyledCallInfo, type StyledCallInfo} from '../utils/styled';

/**
 * Callback invoked for each quasi (static text segment) in a styled/css template literal.
 *
 * @param cssText - The static CSS text (cooked or raw)
 * @param quasi - The TemplateElement AST node (use for error reporting location)
 * @param info - Classification of the styled/css call (element, component, or css)
 */
export type QuasiAnalyzer = (
  cssText: string,
  quasi: TSESTree.TemplateElement,
  info: NonNullable<StyledCallInfo>
) => void;

/**
 * Creates an ESLint visitor that scans static CSS text in tagged template literals.
 *
 * Calls `analyze` for every quasi element in every styled/css tagged template
 * in the file. Bails out early via `shouldAnalyze` for files without Emotion usage.
 */
export function createQuasiScanner(
  context: Readonly<TSESLint.RuleContext<'quasi', readonly unknown[]>>,
  analyze: QuasiAnalyzer
): TSESLint.RuleListener {
  if (!shouldAnalyze(context)) {
    return {};
  }

  return {
    TaggedTemplateExpression(node: TSESTree.TaggedTemplateExpression) {
      const info = getStyledCallInfo(node);
      if (!info) {
        return;
      }

      for (const quasi of node.quasi.quasis) {
        const cssText = quasi.value.cooked ?? quasi.value.raw;
        if (cssText) {
          analyze(cssText, quasi, info);
        }
      }
    },
  };
}
