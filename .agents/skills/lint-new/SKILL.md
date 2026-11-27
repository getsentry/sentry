---
name: lint-new
description: Create or extend a custom oxlint rule in Sentry's eslintPluginSentry or eslintPluginScraps plugins. Use when asked to "add a lint rule", "add an eslint rule", "create a lint rule", "change an existing lint rule", or "new design system lint rule".
---

Create or extend the oxlint rule named `$ARGUMENTS` (kebab-case, e.g. `no-foo-bar`). To change an existing rule, skip to [Extending an Existing Rule](#extending-an-existing-rule).

Oxlint runs our custom rules as JS plugins through `@oxlint/plugins`. The API mirrors ESLint's (`create(context)`, AST visitors, `context.report`, fixers), but the imports, file layout, and config are oxlint's.

## Step 1: Choose the Plugin

| Plugin | Directory                                     | Rule key prefix   | Rules about                                                                                                      |
| ------ | --------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| Scraps | `static/oxlint/eslintPluginScraps/src/rules/` | `@sentry/scraps/` | The design system: `@sentry/scraps` component usage, theme tokens, styles that a Scraps primitive should replace |
| Sentry | `static/oxlint/eslintPluginSentry/`           | `@sentry/`        | Everything else: general Emotion syntax, test files, i18n, imports, React patterns, query/routing conventions    |

Before writing anything, read the closest existing rule in the chosen plugin and its spec. Its structure is the template to follow; the snippets below are the skeleton.

For Scraps rules, also read [references/rule-archetypes.md](references/rule-archetypes.md) and pick the archetype that matches. Scraps has shared AST helpers in `src/ast/` (import tracking, styled-call detection, CSS template parsing); reuse them rather than re-walking the AST. Rules that inspect Emotion styles also need [references/styled-css-guide.md](references/styled-css-guide.md).

For Sentry rules, `utils/styled.ts` detects styled and `css` templates, and `fixtures/` holds real files for specs whose rule reads other files or depends on the file path (see `noDefaultExports.spec.ts`). For a rule that only applies to test files, start from `preferFakeTimers.ts` or `requireFakeTimerCleanup.ts`.

## Step 2: Create the Files

File names are the camelCase form of the rule name:

| Plugin | Rule                                                     | Test                                                          |
| ------ | -------------------------------------------------------- | ------------------------------------------------------------- |
| Scraps | `static/oxlint/eslintPluginScraps/src/rules/noFooBar.ts` | `static/oxlint/eslintPluginScraps/src/rules/noFooBar.spec.ts` |
| Sentry | `static/oxlint/eslintPluginSentry/noFooBar.ts`           | `static/oxlint/eslintPluginSentry/noFooBar.spec.ts`           |

### Rule

```typescript
import {defineRule} from '@oxlint/plugins';

export const noFooBar = defineRule({
  meta: {
    type: 'problem', // or 'suggestion'
    docs: {description: '[Rule description]'},
    fixable: 'code', // only if the rule autofixes; see Autofix
    schema: [],
    messages: {forbidden: 'Error message shown to the user'},
  },
  create(context) {
    return {
      // AST visitors, e.g. ImportDeclaration(node) {...}
    };
  },
});
```

- Import node types with `import {defineRule, type ESTree} from '@oxlint/plugins';`.
- Read source text and scopes through `context.sourceCode` (`getText`, `getScope`, `ast`).
- In rule and helper files, local imports use the `.ts` extension (`'../ast/tracker/imports.ts'`). Specs import the rule without it.
- Configurable options: [references/schema-patterns.md](references/schema-patterns.md).

### Test

```typescript
import {RuleTester} from 'oxlint/plugins-dev';

import {noFooBar} from './noFooBar';

const ruleTester = new RuleTester({languageOptions: {parserOptions: {lang: 'tsx'}}});

ruleTester.run('no-foo-bar', noFooBar, {
  valid: [{code: '// valid code'}],
  invalid: [
    {
      code: '// invalid code',
      errors: [{messageId: 'forbidden'}],
      output: '// code after autofix', // required when the rule is fixable
    },
  ],
});
```

Parser: `new RuleTester()` parses plain JS; set `lang: 'ts'` for type syntax and `lang: 'tsx'` for TSX. Pass `filename` on a case when the rule depends on the file path, and `options` when it takes options. A `filename` overrides `lang`: the language comes from its extension, so use `.tsx` when the case has JSX.

Cover the false positives you can think of in `valid`: aliased imports, shadowed names, type-only imports, and look-alike paths or identifiers.

## Autofix

Implement an autofix when the transformation is unambiguous and keeps runtime behavior:

- Import path rewrites (Scraps `noCoreImport.ts` is the canonical example)
- Adding or removing JSX attributes with known values
- Wrapping an expression in a known component
- Renames with no shadowing risk

Leave the rule report-only when more than one fix is plausible, the fix needs type information, it changes control flow, or it spans files. A report-only rule can still offer `suggest` entries in `context.report`; set `meta.hasSuggestions: true` when it does.

```typescript
context.report({
  node,
  messageId: 'forbidden',
  fix: fixer => fixer.replaceText(node, newText),
  // Also: replaceTextRange, insertTextBefore, insertTextAfter, remove.
  // Return one fix or an array of fixes.
});
```

Keep fixes from dropping comments inside the replaced range, and report on the narrowest node that explains the problem.

## Step 3: Register the Rule

1. **Plugin index**: import the rule and add it to `rules` under its kebab-case key, in alphabetical order.
   - Scraps: `static/oxlint/eslintPluginScraps/src/rules/index.ts`
   - Sentry: `static/oxlint/eslintPluginSentry/index.ts`

2. **Config**: enable it as `'@sentry/scraps/no-foo-bar'` or `'@sentry/no-foo-bar'`. Where depends on the existing violations:

   | Situation                                             | Where                                                                                                              |
   | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
   | No violations, applies everywhere                     | `rules` of `base` in `oxlint.base.ts` (shared with the Scraps, Icons, and search-syntax packages)                  |
   | No violations, app code only                          | top-level `rules` in `oxlint.config.ts`                                                                            |
   | Only for some files (tests, stories, core components) | an `overrides` entry with `files` in the matching config; test-only rules go in `testOverride` in `oxlint.base.ts` |
   | Existing violations you are not fixing in this PR     | the `incubator` config at the top of `oxlint.config.ts`, then enroll (Step 4)                                      |

   Fix a handful of violations in the PR when that is cheap. For a large rollout, use the incubator and fix the backlog later with the `lint-fix` skill.

## Step 4: Enroll Incubator Rules

Only for rules added to `incubator`. Suppression budgets are explained under Linting in `static/AGENTS.md`. To record the existing violations as the new rule's budget:

```bash
pnpm run lint:suppressions --enroll --base origin/master
```

Commit the updated `oxlint-suppressions.json` files with the rule. Use per-file `overrides` in `incubator` to turn the rule off where it never applies, rather than suppressing those files.

## Step 5: Verify

Done when all of these pass:

```bash
pnpm test-ci static/oxlint/eslintPluginSentry/noFooBar.spec.ts   # or the Scraps path
pnpm run typecheck
pnpm run lint:js static/oxlint                                   # lints the plugin itself
pnpm run lint:js                                                 # the new rule over the codebase
```

For an incubator rule, also run `pnpm run lint:suppressions --ci --base origin/master` (without `--base`, stale budgets only warn) and read through `pnpm run lint:suppressions --backlog --rule @sentry/no-foo-bar` for false positives.

## Extending an Existing Rule

1. Read the rule, its spec, and its config entry.
2. Config-driven rules (e.g. `use-semantic-token`) often need only a change to their config file (`src/config/tokenRules.ts`). See the reverse-mapping note in [references/schema-patterns.md](references/schema-patterns.md).
3. Update the spec for changed behavior, then add new cases.
4. If the change adds violations to an incubator rule, re-enroll; otherwise fix them in the same PR.
5. Run [Step 5: Verify](#step-5-verify).

## Naming

- **Rule key** (kebab-case, verb-noun): `no-token-import`, `prefer-info-text`, `require-field-component`, `use-semantic-token`
- **Export and file name** (camelCase): `noTokenImport` in `noTokenImport.ts` and `noTokenImport.spec.ts`
