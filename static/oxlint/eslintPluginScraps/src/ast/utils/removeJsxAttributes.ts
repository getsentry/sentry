import type {ESTree, Fix, Fixer, SourceCode} from '@oxlint/plugins';

export function removeJsxAttributes(
  fixer: Fixer,
  sourceCode: SourceCode,
  first: ESTree.JSXAttribute,
  last: ESTree.JSXAttribute = first
): Fix {
  const tokenBefore = sourceCode.getTokenBefore(first, {includeComments: true});
  const tokenAfter = sourceCode.getTokenAfter(last, {includeComments: true});
  const keepsLineBreak =
    tokenBefore?.type === 'Line' &&
    !/[\n\r]/.test(sourceCode.text.slice(last.range[1], tokenAfter?.range[0]));
  const start = !tokenBefore || keepsLineBreak ? first.range[0] : tokenBefore.range[1];
  return fixer.removeRange([start, last.range[1]]);
}
