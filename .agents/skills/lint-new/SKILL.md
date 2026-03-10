---
name: lint-new
description: Create a new ESLint rule with tests for eslintPluginScraps. Use when asked to "create a lint rule", "add an eslint rule", "scaffold a rule", "write a new scraps rule", or "new design system lint rule". Covers rule creation, test authoring, registration, and autofix implementation.
---

Create a new ESLint rule named `$ARGUMENTS` in the eslintPluginScraps plugin.

## Step 1: Choose Your Archetype

Read [references/rule-archetypes.md](references/rule-archetypes.md) and pick the archetype that matches your rule's intent:

| You want to...                              | Archetype              | Reference to load                                                |
| ------------------------------------------- | ---------------------- | ---------------------------------------------------------------- |
| Rewrite import paths                        | Import rewrite         | Inline — simple pattern                                          |
| Validate token/value usage per CSS property | Property validation    | [style-collector-guide.md](references/style-collector-guide.md)  |
| Restrict JSX elements in specific props     | JSX structural         | [rule-archetypes.md](references/rule-archetypes.md) §Archetype 3 |
| Detect patterns in static CSS text          | Template text analysis | [rule-archetypes.md](references/rule-archetypes.md) §Archetype 4 |

Read the relevant reference before writing code. The archetypes document which AST visitors to use, which shared utilities apply, and which patterns are NOT appropriate for each approach.

## Step 2: Check Shared Utilities

Before writing AST traversal logic, check `static/eslint/eslintPluginScraps/src/ast/` for reusable code:

| Utility                 | Location                                 | Use for                                                             |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| `createStyleCollector`  | `src/ast/extractor/index.ts`             | Collecting CSS-in-JS _dynamic value_ declarations (NOT static text) |
| `shouldAnalyze`         | `src/ast/extractor/index.ts`             | Fast pre-scan to skip files without Emotion usage                   |
| `normalizePropertyName` | `src/ast/utils/normalizePropertyName.ts` | Normalizing CSS property names                                      |
| `decomposeValue`        | `src/ast/extractor/value-decomposer.ts`  | Breaking complex expressions into all possible values               |
| Theme tracker           | `src/ast/extractor/theme.ts`             | Tracking `useTheme()` and callback theme bindings                   |
| `getStyledInfo`         | `src/ast/utils/styled.ts` (if exists)    | Detecting styled calls and extracting component/element name        |

If another rule already solves a similar problem, extract shared logic into `src/ast/utils/` and reuse it.

## Step 3: Create Files

1. **Rule**: `static/eslint/eslintPluginScraps/src/rules/$ARGUMENTS.ts`
2. **Test**: `static/eslint/eslintPluginScraps/src/rules/$ARGUMENTS.spec.ts`

### Rule Template

```typescript
import {ESLintUtils} from '@typescript-eslint/utils';

export const $RULE_NAME = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: '[Rule description]',
    },
    fixable: 'code', // include if rule has autofix — see Autofix Guidance
    schema: [],
    messages: {
      forbidden: 'Error message shown to user',
    },
  },
  create(context) {
    return {
      // AST visitor methods — see your chosen archetype
    };
  },
});
```

If your rule needs configurable options, load [references/schema-patterns.md](references/schema-patterns.md).

### Test Template

```typescript
import {RuleTester} from '@typescript-eslint/rule-tester';

import {$RULE_NAME} from './$ARGUMENTS';

const ruleTester = new RuleTester();

ruleTester.run('$ARGUMENTS', $RULE_NAME, {
  valid: [
    {
      code: '// valid code',
      filename: '/project/src/file.tsx',
    },
  ],
  invalid: [
    {
      code: '// invalid code',
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'forbidden'}],
      output: '// expected output after autofix', // REQUIRED for fixable rules
    },
  ],
});
```

Run tests:

```bash
CI=true pnpm test "static/eslint/eslintPluginScraps/src/rules/$ARGUMENTS.spec.ts"
```

## Autofix Guidance

**Default stance: implement autofix** unless the transformation is ambiguous or could change runtime behavior.

### Safe autofix patterns

- Import path rewrites (see `no-core-import.ts` as canonical example)
- Adding/removing JSX attributes with known values
- Wrapping expressions in a known component
- Identifier renames with no shadowing risk

### Do NOT autofix when

- Multiple valid fixes exist and the right choice requires human judgment
- The fix requires type information not available from the AST alone
- The transformation alters control flow or runtime behavior
- The change spans multiple files

### Fixer API

```typescript
context.report({
  node,
  messageId: 'forbidden',
  fix(fixer) {
    return fixer.replaceText(node, newText);
    // Also: fixer.replaceTextRange([start, end], text)
    //        fixer.insertTextBefore(node, text)
    //        fixer.insertTextAfter(node, text)
    //        fixer.remove(node)
    // Return single fix or array of fixes
  },
});
```

When a rule is fixable, every invalid test case MUST include `output` showing the expected code after the fix.

## Step 4: Register the Rule

### 1. Rule Index

Add to `static/eslint/eslintPluginScraps/src/rules/index.ts`:

```typescript
import {$RULE_NAME} from './$ARGUMENTS';

export const rules = {
  // existing rules...
  $ARGUMENTS: $RULE_NAME,
};
```

### 2. ESLint Config

Add to `eslint.config.ts` inside the `name: 'plugin/@sentry/scraps'` block:

```typescript
'@sentry/scraps/$ARGUMENTS': 'error',
// or with options:
'@sentry/scraps/$ARGUMENTS': ['error', { /* options */ }],
```

### 3. Verify

```bash
CI=true pnpm test "static/eslint/eslintPluginScraps/src/rules/$ARGUMENTS.spec.ts"
```

## Extending an Existing Rule

If modifying an existing rule rather than creating a new one:

1. Read the existing rule and its config files to understand the architecture
2. For **config-driven rules** (like `use-semantic-token`): changes often only require editing the config file (e.g., `src/config/tokenRules.ts`), not the rule logic
3. Watch for reverse-mapping side effects — adding a new category can change which category is _suggested_ for shared properties (last writer wins in `buildPropertyToRule`)
4. Update existing tests for any changed behavior, then add new test cases

## Naming Convention

- **Rule name** (kebab-case): `my-rule-name` — verb-noun pattern (e.g., `no-token-import`, `use-semantic-token`)
- **Export name** (camelCase): `myRuleName`
- **File name**: matches rule name exactly (`my-rule-name.ts`, `my-rule-name.spec.ts`)
