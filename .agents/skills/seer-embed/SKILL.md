---
name: seer-embed
description: Add a new Seer embed widget — a rich component rendered inline in Seer's markdown output via tag syntax. Covers schema, component, registration, and backend codegen. Use when asked to "add an embed", "new seer embed", "create a seer widget", "add a markdown widget", "new seer tag", or "embed widget".
---

# Add a Seer Embed

Seer embeds are rich widgets rendered inline in Seer's markdown output using Markdoc-style tag syntax (`{% name %}{ ... }{% /name %}`). Each embed has a Zod schema, a React component, and a registry entry.

## Before You Start

1. Read `static/app/components/seer/markdown/embeds/schemas.ts` to see existing schemas.
2. Read `static/app/components/seer/markdown/embeds/index.ts` to see registered embeds.
3. Confirm the embed name doesn't already exist.

## Step 1: Add the Schema

In `static/app/components/seer/markdown/embeds/schemas.ts`, add an entry to `SEER_EMBED_SCHEMAS`:

```ts
export const SEER_EMBED_SCHEMAS = {
  // ...existing entries

  myEmbed: {
    description:
      "One sentence describing what this embed does—this passes through directly to the LLM's system prompt.",
    level: ['inline'], // 'inline', 'block', or both
    schema: z.object({
      // Define the data shape the LLM will produce
      someField: z.string(),
      optionalField: z.number().optional(),
    }),
    examples: [{label: 'Basic', data: {someField: 'hello'}}],
    // featureFlag: 'organizations:seer-explorer-my-embed',  // optional
  },
} as const satisfies Record<string, SeerEmbedSchema>;
```

**Key decisions:**

- **`description`**: Write for the LLM — it uses this to decide when to emit the embed. Be specific about the use case.
- **`level`**: Use `['inline']` for widgets that flow within text (timestamps, badges). Use `['block']` for widgets that need their own line (cards, charts). Use both if the embed adapts.
- **`schema`**: Use Zod. Keep it flat and simple — the LLM has to produce valid JSON. Use `.default()` for optional fields with sensible defaults. Use `.enum()` to constrain string values.
- **`examples`**: An array of `{label, data, level?}` objects. Each `data` must be valid against the schema. These are included in the generated JSON sent to the LLM as few-shot examples. In the stories page, all examples for an embed are composed into a single markdown block and rendered through one `<SeerMarkdown>` — inline examples are wrapped in prose text, block examples are appended at the end. Use multiple examples to show different prop combinations or block vs inline rendering. Set `level` on an example only when it differs from the schema's default (first entry in `level`).
- **`featureFlag`**: Set this to gate the embed behind a feature flag. The backend filters it out of the schema sent to the LLM when the flag is off.

## Step 2: Create the Component

Create `static/app/components/seer/markdown/embeds/components/<name>.tsx`:

```tsx
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';

export const MyEmbed = defineSeerEmbed({
  name: 'myEmbed', // must match the key in SEER_EMBED_SCHEMAS
  render({someField, optionalField}) {
    // Props are typed from the Zod schema — already validated
    return <span>{someField}</span>;
  },
});
```

**What `defineSeerEmbed` does for you:**

- Looks up the Zod schema by name
- `safeParse`s the `data` prop against it
- Returns `null` for invalid data (logs a warning in dev)
- Sets `displayName` on the component (used by the registry)

**Rules:**

- The `name` parameter **must** match the key in `SEER_EMBED_SCHEMAS` exactly.
- The `render` function receives the Zod output type — props are already parsed and validated.
- Keep the component simple. Import existing Sentry components (`DateTime`, `TimeSince`, `Link`, etc.) rather than building from scratch.
- The component receives no context about where it appears — it only gets the data from the tag body.

## Step 3: Register the Component

In `static/app/components/seer/markdown/embeds/index.ts`, import and add it to the `embeds` array:

```ts
import {MyEmbed} from './components/myEmbed';
import {Timestamp} from './components/timestamp';
import {SeerEmbedRegistry} from './registry';

const embeds = [Timestamp, MyEmbed];
for (const embed of embeds) {
  SeerEmbedRegistry.register(embed.displayName, embed);
}
```

Registration uses `displayName` (set by `defineSeerEmbed`) as the registry key.

## Step 4: Regenerate Backend Schema

Run the codegen script to update the JSON Schema file the backend sends to the Seer agent:

```bash
pnpm gen:embed-widgets
```

This writes to `src/sentry/seer/agent/embed_widgets.generated.json`. **Commit this generated file** — it's checked in, not gitignored.

## Step 5: Verify

1. **Lint**: Run `pnpm run lint:js` on your new files.
2. **Types**: Run `pnpm run typecheck` to confirm the schema types flow through.
3. **Manual test**: In the Seer Explorer, trigger a response that would use your embed. Or test directly:

```tsx
<SeerMarkdown raw={`{% myEmbed %}{"someField":"hello"}{% /myEmbed %}`} />
```

## File Summary

| File                                                               | What to do                              |
| ------------------------------------------------------------------ | --------------------------------------- |
| `static/app/components/seer/markdown/embeds/schemas.ts`            | Add Zod schema entry                    |
| `static/app/components/seer/markdown/embeds/components/<name>.tsx` | Create component with `defineSeerEmbed` |
| `static/app/components/seer/markdown/embeds/index.ts`              | Import and register                     |
| `src/sentry/seer/agent/embed_widgets.generated.json`               | Regenerated by `pnpm gen:embed-widgets` |

## Optional: Feature Flag

If the embed should be gated:

1. Add `featureFlag: 'organizations:seer-explorer-<name>'` to the schema entry.
2. Register the flag in `src/sentry/features/temporary.py`.
3. The backend (`src/sentry/seer/agent/embed_widgets.py`) automatically filters flagged embeds using `features.has()`.
