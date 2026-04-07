# Rule Archetypes

Load this reference when deciding which AST approach to use for a new rule.

## Decision Table

| You want to...                                             | Archetype                 | Key patterns                                                       | Example rule                   |
| ---------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------ | ------------------------------ |
| Rewrite import paths                                       | Import rewrite            | `ImportDeclaration` visitor, `fixer.replaceText(node.source, ...)` | `no-core-import`               |
| Validate which CSS properties a token/value is used with   | Property validation       | `createStyleCollector` + `Program:exit` deferred validation        | `use-semantic-token`           |
| Restrict which JSX elements appear in specific props       | JSX structural constraint | Import tracking + recursive JSX tree walk + config schema          | `restrict-jsx-slot-children`   |
| Detect patterns in static CSS text (selectors, raw values) | Template text analysis    | `TaggedTemplateExpression` → walk `quasi.quasis` for static text   | `no-dom-coupling` (PR #109906) |

## Archetype 1: Import Rewrite

**When**: Rule checks import sources and rewrites them.

**Pattern**: Single `ImportDeclaration` visitor. Autofix replaces the source string.

```typescript
create(context) {
  return {
    ImportDeclaration(node) {
      const importPath = node.source.value;
      if (typeof importPath === 'string' && importPath.startsWith(FORBIDDEN)) {
        context.report({
          node,
          messageId: '...',
          fix(fixer) {
            return fixer.replaceText(node.source, `'${newPath}'`);
          },
        });
      }
    },
  };
}
```

**Autofix**: Almost always safe. The fix just changes a string literal.

**Edge cases**: Type-only imports (`import type`), mixed named imports, re-exports — all handled automatically since you're only replacing the source path string.

## Archetype 2: Property Validation (Style Collector)

**When**: Rule validates which CSS properties a dynamic value (theme token, variable) is used with.

**Key insight**: Uses a **two-phase approach** — collect during traversal, validate after.

1. `createStyleCollector(context)` returns `{collector, visitors}` — spread `visitors` into your return object
2. In `Program:exit`, iterate `collector.getAll()` to validate each `StyleDeclaration`
3. Call `collector.clear()` at the end for cleanup

```typescript
create(context) {
  if (!shouldAnalyze(context)) return {};  // Fast bailout

  const {collector, visitors} = createStyleCollector(context);

  return {
    ...visitors,
    'Program:exit'() {
      for (const decl of collector.getAll()) {
        // decl.property.name — the CSS property (already normalized)
        // decl.values — array of {rawNode, tokenInfo: {tokenPath, node}}
        validateDeclaration(decl);
      }
      collector.clear();
    },
  };
}
```

**Important**: The collector handles _interpolated expressions_ (`${...}` parts) in template literals. It does NOT analyze static CSS text in quasis. If you need to detect patterns in the static text itself (like raw hex colors or nested selectors), use Archetype 4 instead.

**Config-driven rules**: If validation rules vary by category, put the mapping in `src/config/` and load it from there. See `tokenRules.ts` for the pattern. This lets you add new categories without changing the rule logic.

**`shouldAnalyze`**: Always use this as a fast pre-scan bailout. It checks for Emotion import/usage patterns via regex and skips files that clearly don't use styled-components.

## Archetype 3: JSX Structural Constraint

**When**: Rule restricts which JSX elements can appear in specific props or slots.

**Pattern**: Use `createImportTracker` from `src/ast/tracker/imports.ts` for import resolution, plus a `JSXAttribute` visitor for tree walking:

1. `createImportTracker()` — merge its `visitors`, then use `resolve(localName)` or `findLocalNames(source, name)` to check imports
2. `JSXAttribute` — when a configured prop is found, recursively walk the JSX tree checking each element against the allowed set

```typescript
create(context) {
  const importTracker = createImportTracker();

  return {
    ...importTracker.visitors,
    JSXAttribute(node) {
      // Use importTracker.resolve(displayName) to check where an element comes from
      // Use importTracker.findLocalNames(source, name) to find local aliases
    },
  };
}
```

**Key patterns**:

- Handle import aliasing: `import {Foo as Bar}` means `Bar` is the local name — `importTracker.resolve('Bar')` returns `{source, imported: 'Foo'}`
- Handle member expressions: `MenuComponents.Alert` must match `${localName}.${member}`
- Recurse through: direct JSX children, ternaries, logical expressions (`&&`, `||`, `??`), `JSXExpressionContainer`, `JSXFragment`, arrow function expression bodies
- Skip `React.Fragment` / `<Fragment>` (transparent wrappers)
- Stop recursion on disallowed elements (report and return)

**Schema**: Uses a complex options schema with nested arrays. See `restrict-jsx-slot-children` for the full pattern.

**Autofix**: Generally NOT safe — replacing JSX elements requires understanding the component API, which is beyond what the AST alone can tell you.

## Archetype 4: Template Text Analysis

**When**: Rule detects patterns in the static CSS text of template literals (not in interpolated expressions).

**Pattern**: Use `createQuasiScanner` from `src/ast/scanner/index.ts` — it handles `shouldAnalyze` bailout, tag detection via `getStyledCallInfo`, and quasi iteration for you:

```typescript
import {createQuasiScanner} from '../ast/scanner/index';

create(context) {
  return createQuasiScanner(context, (cssText, quasi, info) => {
    // cssText: the static CSS text of this quasi segment
    // quasi: the TemplateElement node (use for error reporting)
    // info: { kind: 'element' | 'component' | 'css', name?: string }
    for (const match of cssText.matchAll(MY_PATTERN)) {
      context.report({ node: quasi, messageId: '...' });
    }
  });
}
```

The scanner calls your `analyze` callback for every quasi element in every styled/css tagged template in the file. It automatically skips files without Emotion usage.

**When to use this vs Archetype 2**: If you're looking for patterns in the CSS _text itself_ (raw colors, nested selectors, property names), use `createQuasiScanner`. If you're validating _what values are passed_ to CSS properties via interpolation (`${theme.tokens.X}`), use `createStyleCollector`.

**Tag detection utility**: `getStyledCallInfo(node)` from `src/ast/utils/styled.ts` classifies any `TaggedTemplateExpression` or `CallExpression` as `{kind: 'element', name}`, `{kind: 'component', name}`, `{kind: 'css'}`, or `null`. Handles `styled.div`, `styled('div')`, `styled(Component)`, `styled(Component).attrs(...)`, and `css` patterns. The scanner uses this internally, but you can also use it directly in custom visitors.
