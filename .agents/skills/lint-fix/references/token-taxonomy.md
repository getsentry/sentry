# Token Taxonomy

Load this reference when manually fixing `use-semantic-token` violations.

Source of truth: `static/eslint/eslintPluginScraps/src/config/tokenRules.ts`

## Token Categories and Allowed CSS Properties

| Category       | Keywords in token path | Allowed CSS properties                                                                                                                                                                                                                                |
| -------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **content**    | `content`, `link`      | `color`, `text-decoration`, `text-decoration-color`, `text-emphasis-color`, `caret-color`, `column-rule-color`, `-webkit-text-fill-color`, `-webkit-text-stroke-color`, `fill`, `stop-color`                                                          |
| **background** | `background`           | `background`, `background-color`, `background-image`                                                                                                                                                                                                  |
| **border**     | `border`               | `border`, `border-color`, `border-top`, `border-right`, `border-bottom`, `border-left`, all `border-*-color` variants, `border-block*`, `border-inline*`, `stroke`, `text-decoration`, `text-decoration-color`, `border-image`, `border-image-source` |
| **focus**      | `focus`, `elevation`   | `box-shadow`, `outline`, `outline-color`, `text-shadow`                                                                                                                                                                                               |
| **graphics**   | `graphics`, `dataviz`  | `background`, `background-color`, `background-image`, `fill`, `stroke`, `stop-color`                                                                                                                                                                  |
| **syntax**     | `syntax`               | `color`, `-webkit-text-fill-color`, `-webkit-text-stroke-color`, `background`, `background-color`, `background-image`                                                                                                                                 |

## Quick Lookup: CSS Property → Correct Category

| CSS Property                               | Use tokens from...                                                    |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `color`                                    | **content** (or **syntax** for code highlighting)                     |
| `background`, `background-color`           | **background** (or **graphics** for data viz)                         |
| `border`, `border-color`, `border-*`       | **border**                                                            |
| `box-shadow`                               | **focus**                                                             |
| `outline`, `outline-color`                 | **focus**                                                             |
| `text-shadow`                              | **focus**                                                             |
| `fill`, `stroke`                           | **content** (text), **graphics** (charts), or **border** (decorative) |
| `text-decoration`, `text-decoration-color` | **content** or **border**                                             |

## Keyword Matching Strategy

Token paths like `theme.tokens.interactive.chonky.neutral.content` are matched by keyword:

1. Split the path into segments
2. Find which category keyword appears deepest (last) in the path
3. That category's rule applies

Example: `interactive.background.content` → `content` wins (deeper than `background`).

## Fix Pattern

When fixing a violation, keep the same specificity suffix and change only the category:

```tsx
// Before (wrong: border token used for color)
color: ${p => p.theme.tokens.border.primary};

// After (correct: content token for color)
color: ${p => p.theme.tokens.content.primary};
```

If unsure which specific token name exists, check the theme definition or use your IDE's autocomplete on `theme.tokens.<category>.`.
