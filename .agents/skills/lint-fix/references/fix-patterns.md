# Fix Patterns per Rule

Load this reference when fixing violations of a specific `@sentry/scraps` rule.

## no-core-import

**Has autofix**: Yes — use `--fix`.

**Transformation**: `sentry/components/core/<component>[/subpath]` → `@sentry/scraps/<component>`

| Before                                                               | After                                                    |
| -------------------------------------------------------------------- | -------------------------------------------------------- |
| `import {Button} from 'sentry/components/core/button'`               | `import {Button} from '@sentry/scraps/button'`           |
| `import {Select} from 'sentry/components/core/select/compactSelect'` | `import {Select} from '@sentry/scraps/select'`           |
| `import type {ButtonProps} from 'sentry/components/core/button'`     | `import type {ButtonProps} from '@sentry/scraps/button'` |

**Edge cases handled by autofix**:

- Deep paths collapse to the first component segment
- Type-only imports preserved
- Mixed named imports (value + type) preserved
- Multiple imports from different core paths fixed independently

**Edge cases to verify after autofix**:

- Files with multiple `sentry/components/core/*` imports that resolve to the same `@sentry/scraps/*` path — check for duplicate import statements that need manual merging

## no-token-import

**Has autofix**: No.

**What the rule enforces**: Imports from `utils/theme/scraps` are only allowed in the designated theme directory.

**Manual fix**: Move the token usage to a component that accesses tokens via `theme.tokens.*` through `useTheme()` or styled-component theme callback, rather than importing raw token values directly.

## use-semantic-token

**Has autofix**: No.

**What the rule enforces**: Theme tokens (`theme.tokens.*`) must only be used with CSS properties that match the token's semantic category.

**Manual fix**: Replace the token with one from the correct category for the CSS property being used. Consult [token-taxonomy.md](token-taxonomy.md) for the full mapping.

**Example fixes**:

| CSS Property   | Wrong Token                         | Correct Token                                              |
| -------------- | ----------------------------------- | ---------------------------------------------------------- |
| `color`        | `theme.tokens.border.primary`       | `theme.tokens.content.primary`                             |
| `background`   | `theme.tokens.content.primary`      | `theme.tokens.background.primary`                          |
| `border-color` | `theme.tokens.background.secondary` | `theme.tokens.border.secondary`                            |
| `box-shadow`   | `theme.tokens.content.primary`      | `theme.tokens.focus.primary` or `theme.tokens.elevation.*` |

**Pattern**: Keep the same specificity level (`.primary`, `.secondary`, etc.) — just change the category prefix.

## restrict-jsx-slot-children

**Has autofix**: No.

**What the rule enforces**: Only specific components (from specific imports) may appear as children in configured JSX slot props.

**Manual fix**: Replace the disallowed JSX element with one from the allowed set. The error message tells you which components are allowed and from which import source:

```
<div> is not allowed in 'menuHeaderTrailingItems'. Use: MenuComponents.HeaderButton, MenuComponents.CTAButton from '@sentry/scraps/compactSelect', or Flex, Stack, Grid, Container from '@sentry/scraps/layout'.
```

Use the suggested components. If you need custom behavior, wrap your content in an allowed layout component.
