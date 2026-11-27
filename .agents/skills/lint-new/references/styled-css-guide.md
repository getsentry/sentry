# Styled CSS Guide

Load this when a Scraps rule inspects Emotion styles. Paths are relative to `static/oxlint/eslintPluginScraps/src/`.

There are two entry points. Pick by what the rule looks at:

```tsx
const Box = styled.div`
  color: #ff0000;                                  ← CSS text: parseCssTemplate
  background: ${p => p.theme.tokens.background.primary};  ← token value: createStyleVisitors
`;
```

## Theme Tokens: `createStyleVisitors`

`createStyleVisitors(context, check)` in `ast/extractor/index.ts` returns a complete visitor object. It covers:

- styled and `css` tagged templates (through `parseCssTemplate`, so `oxlint-disable` comments inside the CSS are honoured)
- object styles passed to `styled(...)({...})` and `css({...})`
- object literals in `style` props
- object literals, arrays of object literals, and theme callbacks returning object literals in `css` props

It calls `check(property, {node, tokenPath})` for each `theme.tokens.*` access in a value. It follows ternaries, logical expressions, template literals, and theme callbacks (`p => p.theme...`, `({theme}) => ...`, `useTheme()` bindings). `property` is normalized (`background-color`); `tokenPath` is the path after `tokens`.

Return its visitors directly, or spread them next to your own:

```typescript
create(context) {
  if (!shouldAnalyze(context)) {
    return {};
  }
  return createStyleVisitors(context, (property, {node, tokenPath}) => {
    // validate and report
  });
}
```

`shouldAnalyze` is a text pre-scan for `@emotion/styled`, `@emotion/react`, or `css=`/`style=` props. Use it first in any rule that only cares about Emotion.

## CSS Text: `parseCssTemplate`

`parseCssTemplate(template, source, atRules?, selectors?)` in `ast/extractor/css.ts` parses a styled template with `postcss-styled-syntax` and returns `ParsedCssDeclaration[]`, or `null` when the CSS does not parse. Each declaration has:

- `name` (normalized property), `value`, `important`
- `root`: whether it sits at the top level rather than inside a nested rule
- `interpolations`: the `${}` expressions in the value
- `sourceRange` and `line`, for reporting

Pass arrays as `atRules` and `selectors` to collect those too (`noDomCoupling` collects selectors; `preferContainerResponsiveProps` collects at-rules).

Typical flow:

1. Visit `TaggedTemplateExpression` and keep only nodes where `getStyledCallInfo(node, imports)` returns a value. It tells you whether the target is a DOM element, a component, or a bare `css` block.
2. Call `parseCssTemplate(node.quasi, context.sourceCode.getText(node.quasi))`.
3. Skip entries where `isDisabledByCssDirective(entry, context.id)` is true, so inline `/* oxlint-disable-next-line ... */` comments work.
4. Report on the template node, or compute a precise range from `sourceRange` offset by `node.quasi.range[0]`.

`cookCssTemplateText` turns raw template text into its cooked form when you compare static text segments yourself.
