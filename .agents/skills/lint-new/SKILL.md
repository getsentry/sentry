---
name: lint-new
description: Create a new ESLint rule with tests for eslintPluginScraps. Use when asked to "create a lint rule", "add an eslint rule", "scaffold a rule", "write a new scraps rule", or "new design system lint rule". Covers rule creation, test authoring, registration, and autofix implementation.
---

Create a new ESLint rule named `$ARGUMENTS` in the eslintPluginScraps plugin.

## Files to Create

1. **Rule**: `static/eslint/eslintPluginScraps/src/rules/$ARGUMENTS.ts`
2. **Test**: `static/eslint/eslintPluginScraps/src/rules/$ARGUMENTS.spec.ts`

## Rule Template

```typescript
import {ESLintUtils} from '@typescript-eslint/utils';

type MessageIds = 'forbidden'; // add more as needed

export const $RULE_NAME = ESLintUtils.RuleCreator.withoutDocs<[], MessageIds>({
  meta: {
    type: 'problem', // 'problem' for correctness, 'suggestion' for style
    docs: {
      description: '[Rule description]',
    },
    fixable: 'code', // include by default — see Autofix Guidance
    schema: [],
    messages: {
      forbidden: 'Error message shown to user',
    },
  },
  create(context) {
    return {
      // AST visitor methods
    };
  },
});
```

## Test Template

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

- The transformation alters control flow or runtime behavior
- Multiple valid fixes exist and the right choice requires human judgment
- The fix requires type information not available from the AST alone
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

## Registration Checklist

After rule and tests are written and passing, register the rule:

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

## Shared AST Utilities

Before writing AST traversal logic, check `static/eslint/eslintPluginScraps/src/ast/` for reusable utilities:

| Utility                 | Location                                 | Use for                                                             |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------------------- |
| `createStyleCollector`  | `src/ast/extractor/index.ts`             | Collecting CSS-in-JS style declarations across all Emotion patterns |
| `shouldAnalyze`         | `src/ast/extractor/index.ts`             | Fast pre-scan to skip files without Emotion usage                   |
| `normalizePropertyName` | `src/ast/utils/normalizePropertyName.ts` | Normalizing CSS property names                                      |
| `decomposeValue`        | `src/ast/extractor/value-decomposer.ts`  | Breaking complex expressions into all possible values               |
| Theme tracker           | `src/ast/extractor/theme.ts`             | Tracking `useTheme()` and callback theme bindings                   |

If another rule already detects the same pattern, extract the shared logic into `src/ast/utils/` and reuse it.

## Naming Convention

- **Rule name** (kebab-case): `my-rule-name` — use verb-noun pattern (e.g., `no-token-import`, `use-semantic-token`, `restrict-jsx-slot-children`)
- **Export name** (camelCase): `myRuleName`
- **File name**: matches rule name exactly (`my-rule-name.ts`, `my-rule-name.spec.ts`)
