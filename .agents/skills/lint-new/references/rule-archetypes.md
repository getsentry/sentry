# Scraps Rule Archetypes

Load this when writing a rule in `static/oxlint/eslintPluginScraps/`. Paths below are relative to its `src/`.

| You want to...                                                              | Archetype             | Key helpers                             | Example rule                                |
| --------------------------------------------------------------------------- | --------------------- | --------------------------------------- | ------------------------------------------- |
| Rewrite import paths                                                        | Import rewrite        | `ImportDeclaration` visitor             | `noCoreImport`, `noTokenImport`             |
| Validate which CSS properties a theme token is used with                    | Token validation      | `createStyleVisitors`, `shouldAnalyze`  | `useSemanticToken`                          |
| Restrict which JSX elements or props a component gets                       | JSX structural        | `createImportTracker`                   | `restrictJsxSlotChildren`, `preferInfoText` |
| Detect patterns in the CSS text of styled templates (selectors, raw values) | CSS template analysis | `getStyledCallInfo`, `parseCssTemplate` | `noDomCoupling`, `preferPrimitives`         |

## Shared Helpers

| Helper                                                                | Location                             | Use for                                                                                                |
| --------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `createImportTracker(context)`                                        | `ast/tracker/imports.ts`             | Resolving a local name or JSX tag to its import (`is`, `resolve`, `findLocalNames`, `resolveVariable`) |
| `getStyledCallInfo(node, importTracker)`                              | `ast/utils/styled.ts`                | Classifying a styled/css call as element, component, or css                                            |
| `createStyleVisitors(context, check)`                                 | `ast/extractor/index.ts`             | Visiting theme-token values per CSS property                                                           |
| `shouldAnalyze(context)`                                              | `ast/extractor/index.ts`             | Cheap text pre-scan to skip files without Emotion usage                                                |
| `parseCssTemplate`, `cookCssTemplateText`, `isDisabledByCssDirective` | `ast/extractor/css.ts`               | Parsing a styled template into declarations, selectors, and at-rules                                   |
| `normalizePropertyName`                                               | `ast/utils/normalizePropertyName.ts` | Normalizing CSS property names (`backgroundColor` → `background-color`)                                |
| `removeJsxAttributes`                                                 | `ast/utils/removeJsxAttributes.ts`   | Autofixes that drop JSX attributes                                                                     |
| `getChildrenRenderFunction`                                           | `ast/utils/renderFunction.ts`        | Finding a render-prop child function                                                                   |

When two rules need the same logic, move it into `ast/utils/` and reuse it.

## Import Rewrite

One `ImportDeclaration` visitor; the autofix replaces the source string. Safe to autofix almost always.

```typescript
create(context) {
  return {
    ImportDeclaration(node) {
      const importPath = node.source.value;
      if (!importPath.startsWith(FORBIDDEN_PATH)) {
        return;
      }
      context.report({
        node,
        messageId: 'forbidden',
        fix: fixer => fixer.replaceText(node.source, `'${newPath}'`),
      });
    },
  };
}
```

Type-only imports, mixed named imports, and re-exports keep working because only the path string changes.

## Token Validation

`createStyleVisitors` calls back with each CSS property and the theme token used in its value. It only sees interpolated values, not the CSS text. Usage in [styled-css-guide.md](styled-css-guide.md); per-category data belongs in `config/` (see "Config-Driven Rules" in [schema-patterns.md](schema-patterns.md)).

## JSX Structural

Resolve components by import, never by bare name, so aliases and shadowed names behave:

```typescript
create(context) {
  const imports = createImportTracker(context);
  return {
    JSXOpeningElement(node) {
      if (!imports.is(node.name, '@sentry/scraps/menu', 'MenuItem')) {
        return;
      }
      // inspect node.attributes
    },
  };
}
```

- `imports.is(node, source, name)` handles `import {Foo as Bar}`, namespace imports (`Menu.Item`), and skips type-only imports.
- When walking slot contents, recurse through ternaries, logical expressions, `JSXExpressionContainer`, `JSXFragment`, and arrow-function bodies; treat `Fragment` as transparent.
- Autofix is rarely safe: swapping components needs knowledge of their APIs.

## CSS Template Analysis

For patterns in the CSS text itself (selectors, raw colors, layout declarations). Identify styled templates with `getStyledCallInfo`, then parse them with `parseCssTemplate` rather than regex over raw quasis: it handles interpolations, nesting, and `/* oxlint-disable */` comments inside CSS. Details in [styled-css-guide.md](styled-css-guide.md).
