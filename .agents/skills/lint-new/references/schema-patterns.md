# Rule Options Schema Patterns

Load this reference when your rule needs configurable options.

## No Options (Default)

Most rules need no options. Use empty schema:

```typescript
ESLintUtils.RuleCreator.withoutDocs<never[], MessageIds>({
  meta: { schema: [] },
  defaultOptions: [],
  create(context) { ... },
});
```

**Note**: Use `never[]` not `[]` for the options type parameter — `[]` violates `@typescript-eslint/no-restricted-types`.

## Simple Options: String Array

For rules with a configurable set of enabled features:

```typescript
interface Options {
  enabledCategories?: string[];
}

ESLintUtils.RuleCreator.withoutDocs<[Options], MessageIds>({
  meta: {
    schema: [{
      type: 'object',
      properties: {
        enabledCategories: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      additionalProperties: false,
    }],
  },
  defaultOptions: [{}],
  create(context, [options = {}]) {
    const enabled = options.enabledCategories
      ? new Set(options.enabledCategories)
      : null; // null = all enabled
    ...
  },
});
```

**In eslint.config.ts**: `'@sentry/scraps/rule-name': ['error', {enabledCategories: ['background', 'border']}]`

## Complex Options: Nested Config

For rules with rich, structured configuration (like slot restrictions):

```typescript
interface Options {
  slots: Array<{
    propNames: [string, ...string[]];
    allowed: Array<{
      source: string;
      names: [string, ...string[]];
    }>;
    componentNames?: string[];
  }>;
}
```

Schema mirrors the TypeScript interface:

```typescript
schema: [{
  type: 'object',
  properties: {
    slots: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          propNames: { type: 'array', minItems: 1, items: { type: 'string' } },
          allowed: {
            type: 'array', minItems: 1,
            items: {
              type: 'object',
              properties: {
                source: { type: 'string' },
                names: { type: 'array', minItems: 1, items: { type: 'string' } },
              },
              required: ['source', 'names'],
              additionalProperties: false,
            },
          },
          componentNames: { type: 'array', items: { type: 'string' } },
        },
        required: ['propNames', 'allowed'],
        additionalProperties: false,
      },
    },
  },
  required: ['slots'],
  additionalProperties: false,
}],
```

## Config-Driven Rules

For rules where the validation logic is generic but the data varies by category, extract the configuration into a separate file in `src/config/`:

```
src/config/tokenRules.ts   ← Category definitions, property mappings
src/rules/use-semantic-token.ts  ← Generic validation logic
```

This pattern means adding a new category requires only a config change — no rule logic changes. The rule imports and iterates the config.

### Reverse Mapping Pattern

When your config maps categories → allowed properties, you often also need the reverse (property → expected category) for error messages:

```typescript
function buildPropertyToRule(rules: TokenRule[]) {
  const result = new Map<string, string>();
  for (const rule of rules) {
    for (const property of rule.allowedProperties) {
      result.set(property, rule.name); // Last writer wins
    }
  }
  return result;
}
```

**Ordering matters**: When multiple categories share a property (e.g., `box-shadow` in both `focus` and `shadow`), the last category in the array wins the reverse mapping. This affects which category is _suggested_ in error messages. Keep this in mind when adding new categories.
