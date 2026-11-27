# Rule Options

Load this when a rule takes configurable options. Most rules take none and keep `schema: []`.

## Reading Options

`defineRule` does not type options from the schema. Declare an `Options` type that mirrors the schema and cast `context.options` inside `create`, defaulting when the option is missing:

```typescript
import {defineRule} from '@oxlint/plugins';

interface Options {
  enabledCategories?: string[];
}

export const useSemanticToken = defineRule({
  meta: {
    // ...
    schema: [
      {
        type: 'object',
        properties: {enabledCategories: {type: 'array', items: {type: 'string'}}},
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = (context.options[0] ?? {}) as Options;
    const enabled = options.enabledCategories ? new Set(options.enabledCategories) : null; // null = all enabled
    // ...
  },
});
```

Each schema array entry is one positional option. `sortInterfaceKeys` takes a string then an object (`context.options[0]`, `context.options[1]`).

Config: `'@sentry/scraps/use-semantic-token': ['error', {enabledCategories: ['background', 'border']}]`.

Tests: pass `options` on each case, e.g. `{code, options: [{enabledCategories: ['border']}]}`.

## Nested Options

For structured config, write the TypeScript type first and mirror it in the schema with `required`, `minItems`, and `additionalProperties: false` at every object level. `restrictJsxSlotChildren.ts` is the full example; its config lives in `oxlint.base.ts`.

## Config-Driven Rules

When the logic is generic but the data varies by category, keep the data in `src/config/` and the logic in the rule:

```
src/config/tokenRules.ts       ← categories and their allowed properties
src/rules/useSemanticToken.ts  ← generic validation
```

Adding a category is then a config change only.

### Reverse Mapping

`tokenRules.ts` also builds the reverse map (property → suggested category) for error messages. When several categories allow the same property, the first category in `TOKEN_RULES` wins. Adding or reordering categories can change which category the message suggests, so check the spec's message assertions after a config change.
