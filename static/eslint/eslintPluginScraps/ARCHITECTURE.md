# ARCHITECTURE.md

## Goals

- Enforce design-system and theming constraints across CSS-in-JS.
- Support Emotion patterns:
  - `styled` from `@emotion/styled`
  - `css={}` JSX prop from `@emotion/react`
  - inline `style={{}}` JSX prop
  - `useTheme()` from `@emotion/react`
- Treat **template literal styles as the primary use case**.
- Correctly handle **complex interpolations**, including nested ternaries.
- Use **AST-based analysis** (no regex-driven parsing).
- Be **modular, composable, and Unix-like**.
- Be **fast enough for pre-commit** (performance is a first-order concern).
- Maximize **code reuse**, **maintainability**, and **precision of diagnostics**.

---

## Non-goals

- Full CSS parsing for every possible runtime string (e.g., arbitrary template literals with dynamic concatenation). We lint what can be reliably inferred from the AST and provide "best-effort" behavior with configurable strictness.
- Style correctness beyond design-token enforcement (no "CSS best practices" rule set).

---

## Core Design Principles

### 1. Unix Philosophy

- Each module does one thing well.
- Style extraction, normalization, rule logic, and autofixes are separated.
- Rules consume shared, normalized data instead of re-traversing the AST.

### 2. Template Literals First

- Template literal styles are the dominant pattern.
- Object styles are supported but are not the primary optimization target.
- The architecture assumes **no simple `property → value` mapping**.
- Instead, rules operate on:

```
property → possibleValues[0..n]
```

where values may come from:

- template literal quasis
- interpolations
- conditional expressions (including deeply nested ternaries)
- logical expressions

### 3. AST-Centric and Precise

- All analysis is based on ESTree nodes.
- Lint errors are reported on the **smallest relevant AST node**:
  - literal
  - token member access
  - interpolation expression
  - JSX tag identifier
- Fixes mutate minimal text ranges.

### 4. Precision Reporting

Each rule must report on:

- the **value node** when value is invalid
- the **property key node** when property usage is semantically wrong
- the **styled component identifier** when recommending primitives
- avoid reporting on the whole object/template unless no smaller node exists

### 5. Performance by Default

- Single-pass AST traversal for style extraction.
- Aggressive per-file caching.
- **Early no-op bailout** when no relevant imports or patterns are present.

---

## Supported Style Surfaces

Style can appear in multiple syntactic "surfaces". Each surface is extracted into a unified internal representation.

1. **Emotion styled components**
   - `` styled.div`...` ``
   - `styled.div({ ... })`
   - `styled(Component)` variants

2. **Emotion `css` prop**
   - `<div css={css`...`} />`
   - `<div css={{ ... }} />`
   - `<div css={[...]} />`

3. **Inline React styles**
   - `<div style={{ ... }} />`

4. **Theme usage**
   - `const theme = useTheme()`
   - Access via `theme.tokens.*`, `theme.colors.*`, etc.

---

## Pre-Traversal Bailout (Critical for Performance)

Before any heavy analysis:

1. Perform a **lightweight pre-traversal scan** of the AST to detect:
   - imports from `@emotion/styled`
   - imports from `@emotion/react`
   - usage of `useTheme`
   - JSX attributes named `css` or `style`
   - tagged template literals with `styled` or `css`

2. If none are present:
   - **noop the entire plugin for the file**
   - no extractors run
   - no rules execute

This reduces lint cost to near-zero for unrelated files.

---

## Normalized Style Model

All rules operate on a shared intermediate representation derived from extractors.

### Style Declaration Model

```ts
type StyleSurfaceKind = 'emotion-styled' | 'emotion-css-prop' | 'react-inline-style';

type StyleDeclaration = {
  surface: StyleSurfaceKind;

  property: {
    name: string; // canonical CSS property (kebab-case)
    node: ESTree.Node; // node representing the property definition
  };

  values: PossibleValue[]; // property → possibleValues[0..n]

  context: {
    file: string;
    scopeId: number;
    themeBinding?: ThemeBinding;
  };

  raw: {
    containerNode: ESTree.Node; // template literal, object expression, etc.
    sourceNode: ESTree.Node; // root styled/css/style node
  };
};
```

### Possible Value Model

```ts
type PossibleValue = {
  node: ESTree.Node; // literal, expression, or sub-expression
  kind:
    | 'literal'
    | 'template-quasi'
    | 'member'
    | 'call'
    | 'conditional'
    | 'logical'
    | 'unknown';

  confident: boolean; // can this be statically reasoned about?
};
```

Examples:

- `color: ${condition ? theme.tokens.content.primary : '#fff'}`
  - produces two PossibleValues
- nested ternaries produce N possible values
- rules evaluate **each possible value independently**

---

## Package / Module Architecture

Modules are written as `.mjs` files with fully typed JSDoc annotations to avoid compilation costs.

```
eslintPluginScraps/src/
    index.mjs
    rules/
        no-raw-values.mjs
        prefer-tokens.mjs
        semantic-tokens.mjs
        prefer-primitives.mjs
    configs/
        recommended.mjs
        strict.mjs
    fixers/
        replaceRawWithToken.mjs
        replaceThemeColorsWithTokens.mjs
        replaceStyledWithPrimitive.mjs
    config/
        schema.ts
    ast/
        extractors/
            emotionStyled.mjs
            emotionCssProp.mjs
            reactInlineStyle.mjs
        normalize/
            normalizePropertyName.mjs
            extractPossibleValues.mjs
            themeResolver.mjs
            preTraversalCheck.mjs
```

### Responsibilities

| Module      | Responsibility                                 |
| ----------- | ---------------------------------------------- |
| Extractors  | Locate style surfaces and extract declarations |
| Normalizers | Convert raw AST into canonical representations |
| Rules       | Validate declarations and report errors        |
| Fixers      | Perform safe AST/text mutations                |
| Config      | Centralized schema + loading                   |

---

## Style Extraction

### Extractors

Each extractor:

- accepts AST + import/theme metadata
- returns `StyleDeclaration[]`
- never contains rule logic

Key extractors:

- `extractEmotionStyled`
- `extractEmotionCssProp`
- `extractReactInlineStyle`

### Template Literal Handling

- Template literals are parsed into:
  - selector (best-effort)
  - property names (best-effort)
  - value expression trees
- Interpolations are recursively analyzed:
  - ternaries
  - logical expressions
  - nested expressions

No attempt is made to stringify or fully parse CSS text beyond what is needed to identify selector/property/value boundaries.

---

## Theme Resolution

The theme resolver:

- identifies `useTheme()` imports and aliases
- tracks bindings like:

```ts
const theme = useTheme();
const t = useTheme();
```

- provides rules with a canonical theme identifier
- optional strict mode:
  - handles destructuring (`const { tokens } = theme`)
  - deeper scope analysis

---

## Shared Utilities

### Import map builder

- Detect `import styled from '@emotion/styled'`, `import { css, useTheme } from '@emotion/react'`
- Track local names / aliases.

### Theme resolver

- Identify `useTheme()` calls and the assigned identifier:
  - `const theme = useTheme()`
  - `const t = useTheme()`
- Track scope if needed, but default: only same-scope usage unless strict mode.

### Style extractors

Each extractor yields `StyleDeclaration[]` with accurate `property.node` and `value.node`.

- `extractEmotionStyled(node, importMap, themeBinding)`
- `extractEmotionCssProp(node, importMap, themeBinding)`
- `extractReactInlineStyle(node)`

### Property normalization

Normalize to canonical CSS properties:

- Convert `backgroundColor` → `background-color`
- Keep CSS custom properties `--foo` as-is
- Maintain mapping for React inline style differences.

### Static evaluation (fast path)

`evaluateStaticValue(node)`:

- returns `{ confident: boolean, valueType, value }`
- handles: string/number literals, unary `-1`, template literals with only literal quasis, simple concatenation in strict mode.

---

## Shared Caching Strategy

### Per-file cache

Cached once per file:

- import map
- theme bindings
- extracted style declarations
- static evaluation results

### Access Pattern

- extraction runs once
- rules request data from cache
- no rule re-traverses the AST

Caching is keyed by `SourceCode` instance to avoid cross-file leaks.

---

## Rule Architecture

Rules are small, declarative, and data-driven.

### Common Pattern

1. Retrieve shared `StyleDeclaration[]`
2. Filter relevant declarations
3. Inspect `PossibleValue[]`
4. Report on the most precise node
5. Optionally apply autofix

---

## Rules

### `no-raw-values`

**Purpose**
Disallow hardcoded hex colors and raw dimension values.

**Detect**

- Color literals:
  - `"#fff"`, `"#ffffff"`, `"#ffffffff"` (optional)
  - `rgb(...)` / `hsl(...)` only if literal string (optional, strict)
- Dimension literals:
  - numbers in inline style where unitless is suspicious (configurable)
  - strings like `"12px"`, `"1rem"`, `"8px 12px"` (strict: parse)
- Applies on all surfaces.

**Key Behavior**

- Evaluates each possible value independently
- Flags literals inside template interpolations
- Autofix only when a confident token mapping exists

**Autofix**

- Only when:
  - exact match is found in configured token map (e.g., hex → `theme.tokens.content.primary`)
  - dimension maps to spacing tokens (e.g., `8px` → `theme.tokens.space.2`)
- Fix replaces the literal node with a MemberExpression AST snippet:
  - `theme.tokens.space.2` (or bracket access if needed)
- If no mapping, report without fix.

**Options**

```ts
{
  allow?: {
    colors?: string[];       // allowlist hex values
    dimensions?: string[];   // allowlist "1px", "0", etc.
  };
  dimensionUnits?: string[]; // ["px","rem","em"] default
  strict?: boolean;
}
```

**Reports**

- On the literal or expression node containing the raw value

---

### `prefer-tokens`

**Purpose**
Disallow `theme.colors.*` in favor of `theme.tokens.*`.

**Detect**

- MemberExpression chains rooted at the resolved theme binding:
  - `theme.colors.*` (configurable root)
- Also handle destructured colors in strict mode:
  - `const { colors } = theme; colors.red500` (optional strict)

**Key Behavior**

- Detects member expression chains
- Handles multiple possible values
- Optional strict mode for destructured access

**Autofix**

- If there's a configured mapping between `theme.colors.*` keys and `theme.tokens.*`, rewrite.
- Otherwise, no fix.

**Options**

```ts
{
  disallowRoots?: string[]; // default ["theme.colors"]
  mapping?: Record<string, string>; // "theme.colors.red500" -> "theme.tokens.content.danger"
  strict?: boolean;
}
```

**Reports**

- On the `.colors` access or full member chain

---

### `semantic-tokens`

**Purpose**
Ensure semantic tokens are applied to correct CSS properties (primary) and selectors (secondary).

**Example**

- `theme.tokens.background.*` → background properties only
- `theme.tokens.content.*` → text color only
- `theme.tokens.focus.*` → box-shadow or border properties, nested `:focus` selector
- `theme.token.interactive.*` → per-token support inside `:hover`, `:active` selectors

**Token Matching Strategy**

Uses keyword detection with "most specific wins" precedence:

- Check if token path contains a known category keyword (e.g., `content`, `background`, `border`, `link`)
- If multiple keywords ever match, the **deepest/last keyword wins**
- Example: `interactive.background.content` → content rule (content is deeper)

**Detect**

1. Find declarations whose value is a member chain under `theme.tokens.*`
2. Extract token path and match against category keywords
3. Determine the canonical property name for the declaration (normalized)
4. Validate against configured allowed properties for the matched category

**Key Behavior**

- Evaluates property name against semantic group
- Checks all possible values
- No autofix by default (unsafe), optional strict fixes

**Autofix**

- Usually **not safe** automatically because:
  - the intended semantic group might be wrong, or the property might be wrong.
- Offer suggestions via messages:
  - "Use `theme.tokens.content.*` for `color`" etc.
- Optional "safe fix" mode:
  - If property is `color` but token group is `background`, and there is a configured "preferred swap", rewrite token group.
  - Only if mapping is unambiguous.

**Options**

```ts
{
  groups: Record<string, { allowed: string[]; fixTo?: string }>;
  strict?: boolean;
}
```

**Reports**

- On semantic token access or property key (smallest range)

---

### `prefer-primitives`

**Purpose**
Prefer design-system primitives (`Container`, `Flex`, `Grid`) over custom styled wrappers.

**Scope**

- Only triggers when:
  - Styled component is a simple wrapper around a DOM element / primitive candidate
  - Styles map cleanly to primitive props (config-driven)
  - Component is used in JSX in the same file (for safe fix)
- Avoid triggering if styled component:
  - contains complex selectors (`&:hover`, nested selectors)
  - uses media queries (unless explicitly supported)
  - uses interpolations beyond theme tokens/props (strict gating)
  - is exported and used externally (optional: require local-only usage for fix)

**Detect**

- Find `const X = styled.div({ ... })` (and similar)
- Extract style declarations for `X`
- Score whether it can become:
  - `Flex` if `display:flex` or flex props detected
  - `Grid` if `display:grid`
  - `Container` for common padding/width constraints, etc.

**Key Behavior**

- Analyzes styled component definitions
- Maps styles → primitive props
- Rewrites JSX usage
- Removes styled declaration when safe

**Autofix strategy (two-phase, still single rule)**

1. **Insert/ensure import**: `import { Flex } from '@acme/design-system'`
2. **Replace JSX usage**:
   - `<X ... />` → `<Flex ... />` with translated props
3. **Remove styled declaration**:
   - delete `const X = styled...` if all references replaced
   - if remaining references exist, do not auto-delete (report without fix, or partial fix)

**Autofix Constraints**

- No complex selectors
- No media queries (unless explicitly supported)
- Local usage only (configurable)
- Confident style-to-prop mapping

**Options**

```ts
{
  primitives: {
    components: string[];      // ["Container","Flex","Grid"]
    importFrom: string;
    prefer?: ("Flex"|"Grid"|"Container")[]; // tie-breaker
  };
  allowExportedStyled?: boolean; // default false (don't fix if exported)
  strict?: boolean;
}
```

**Reports**

- On JSX tag name or styled component identifier

---

## Autofix Strategy

- Fixes are **opt-in and conservative**
- Only minimal text ranges are modified
- No full reprints of files or components
- Imports are inserted only when required
- If a fix is partially unsafe, rule reports without fixing

---

## Fixer Implementation Guidance

### Use `context.sourceCode` + minimal text ops

- Build fixes using `fixer.replaceTextRange` / `fixer.replaceText`
- Avoid regenerating large code blocks; operate on the smallest safe ranges:
  - replace only the literal
  - replace only the member expression
  - for `prefer-primitives`, replace JSX tag names and add props by editing attribute lists

### AST mutation helpers

Create utilities for "printable" replacements:

- `getText(node)` from SourceCode
- `replaceNodeWith(node, text)` with correct parentheses when needed (e.g., replacing a Literal inside binary expression)

### Safety gates

For autofix:

- Must be syntactically safe
- Must preserve comments where possible
- Must avoid changing runtime meaning (e.g., don't convert `8` to `theme.tokens.space.2` if `8` was unitless lineHeight and tokens are px)

---

## Configuration

### Plugin Config

Support `css-in-js.config.(js|json|ts)` loaded once (per run) with caching:

- token namespaces
- semantic token → allowed properties mapping
- primitive component mapping and prop inference rules
- module import aliases for Emotion

Example:

```js
export default {
  emotion: {
    styledModule: '@emotion/styled',
    reactModule: '@emotion/react',
    cssImportName: 'css',
    useThemeName: 'useTheme',
  },
  tokens: {
    // where to find tokens on theme
    root: 'theme.tokens',
    disallowThemeColorsRoot: 'theme.colors',
  },
  semanticTokens: {
    background: {allowed: ['background', 'background-color']},
    content: {allowed: ['color', 'fill']},
    border: {allowed: ['border-color', 'outline-color']},
  },
  primitives: {
    components: ['Container', 'Flex', 'Grid'],
    importFrom: '@acme/design-system',
    // heuristics for mapping style props => primitive props
    propMappings: {
      display: {Flex: ['flex'], Grid: ['grid']},
      gap: {Flex: ['gap'], Grid: ['gap']},
    },
  },
};
```

### ESLint Rule Options

Each rule supports:

- `strict` mode
- allowlists / denylists
- mapping overrides

Each rule is independently configurable; the plugin config provides defaults.

### Recommended Configs

- `recommended`:
  - `no-raw-values`: on (confident-only)
  - `prefer-tokens`: on
  - `semantic-tokens`: on (no autofix by default)
  - `prefer-primitives`: on (report-only unless confident mapping)
- `strict`:
  - enables deeper static evaluation and more aggressive detection

### ESLint v9 flat-config + modern JS

- Target ESLint v8.57+ or v9 (pick one baseline) and use:
  - `meta.schema` with JSON schema
  - `context.sourceCode` APIs
  - TypeScript support via `@typescript-eslint/parser` (if repo is TS)
- Use `eslint-utils` / `@eslint-community/eslint-utils` helpers where it reduces boilerplate.

---

## Extensibility

Adding a new rule requires:

- no new extractors (in most cases)
- consuming `StyleDeclaration[]`
- optional reuse of existing fixers

New style surfaces or token systems can be added by:

- writing a new extractor
- extending config schema
- without touching existing rules

---

## Implementation Notes

- **Object styles** (`{ color: '#fff' }`) are the most reliable → prioritize first.
- Template literals require partial CSS parsing if you want property/value mapping; treat these as "strict mode" and/or only lint interpolated raw values.
- React inline style uses camelCase props and unitless semantics; normalize but keep a separate "reactInline" flag for known unitless properties.

---

## Testing Strategy

- ESLint `RuleTester`
- JS and TS fixtures
- Template literal–heavy test cases
- Nested ternary coverage
- Autofix golden tests

Fixture-based coverage per surface:

- `emotion-styled.object.tsx`
- `emotion-styled.template.tsx`
- `css-prop.object.tsx`
- `inline-style.tsx`
- mixed surfaces in one file

Optional:

- Performance benchmarks on large fixture files

---

## Summary

This architecture prioritizes:

- **Template literal correctness**
- **Performance at scale**
- **AST precision**
- **Modularity and reuse**
- **Safe, minimal autofixes**
