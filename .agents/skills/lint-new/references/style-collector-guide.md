# Style Collector Guide

Load this reference when your rule needs to analyze CSS-in-JS style declarations — specifically the _dynamic values_ passed via interpolation.

## When to Use

Use `createStyleCollector` when your rule needs to:

- Validate which CSS properties a theme token is used with
- Check that interpolated values match expected types or categories
- Analyze the relationship between CSS properties and their dynamic values

Do NOT use it when you need to:

- Detect patterns in static CSS text (use template quasi analysis instead)
- Check import paths (use `ImportDeclaration` visitor)
- Restrict JSX element usage (use JSX tree walking)

## Architecture

```
File: src/ast/extractor/index.ts

createStyleCollector(context)
  ├── createThemeTracker()        ← tracks useTheme() / callback theme bindings
  ├── createStyledExtractor()     ← handles styled.div`...` and styled(X)`...`
  ├── createCssPropExtractor()    ← handles css={} and css`...` props
  └── createStylePropExtractor()  ← handles style={{}} prop

Returns: { collector, visitors, themeTracker }
```

### What the Collector Captures

Each `StyleDeclaration` in `collector.getAll()`:

```typescript
interface StyleDeclaration {
  property: {
    name: string; // Normalized CSS property (e.g., 'background-color')
    node: TSESTree.Node; // AST node of the property name
  };
  values: Array<{
    rawNode: TSESTree.Node;
    tokenInfo?: {
      tokenPath: string; // e.g., 'content.primary', 'border.secondary'
      node: TSESTree.Node; // AST node of the token access
    };
  }>;
}
```

### What It Does NOT Capture

- Static text in template literal quasis (the non-interpolated parts)
- CSS property names that appear only in static text without dynamic values
- Comments, whitespace, or formatting

## Two-Phase Pattern

The collector uses deferred validation — it **collects during traversal** and you **validate in `Program:exit`**:

```typescript
create(context) {
  if (!shouldAnalyze(context)) return {};

  const {collector, visitors} = createStyleCollector(context);

  return {
    ...visitors,  // Spread the collector's visitors (handles all extraction)
    'Program:exit'() {
      for (const decl of collector.getAll()) {
        // Your validation logic here
      }
      collector.clear();  // REQUIRED: cleanup for next file
    },
  };
}
```

Why deferred? Because a single styled block may have properties and values spread across multiple AST nodes (template quasis + expressions). The collector aggregates them all, then you validate the complete picture.

## shouldAnalyze: Fast Pre-Scan

```typescript
import {shouldAnalyze} from '../ast/extractor/index';

if (!shouldAnalyze(context)) return {};
```

This regex-based pre-scan checks for Emotion imports/usage patterns. Returns `false` for files that clearly don't use styled-components. Always use it as the first line in `create()` for any rule that uses the style collector or analyzes Emotion patterns.

## Common Pitfall: Collector vs Static Text

The #1 mistake is using `createStyleCollector` when your rule needs to analyze static CSS text. Example:

```tsx
const Box = styled.div`
  color: #ff0000;           ← This is static text in a quasi — collector won't see it
  background: ${p => p.theme.tokens.background.primary};  ← This IS captured
`;
```

If your rule detects raw hex colors, nested selectors, or other patterns in the _text itself_, walk `quasi.quasis` directly instead. See the "Template Text Analysis" archetype in `rule-archetypes.md`.
