import {z} from 'zod';

const isoTimestampSchema = z.iso.datetime({offset: true});

const chartSeriesDataSchema = z
  .array(
    z.object({
      x: z.union([z.string(), z.number()]),
      y: z.number(),
    })
  )
  .min(1)
  .max(200);

const chartSeriesSchema = z.union([
  z.object({
    label: z.string().describe('Legend label for the series'),
    data: chartSeriesDataSchema,
  }),
  z.object({
    name: z.string().describe('Legacy alias for label'),
    data: chartSeriesDataSchema,
  }),
]);

type SeerEmbedLevel = 'inline' | 'block';

export interface SeerEmbedExample {
  data: Record<string, unknown>;
  label: string;
  level?: SeerEmbedLevel;
}

interface SeerEmbedSchema {
  description: string;
  level: SeerEmbedLevel[];
  schema: z.ZodObject;
  examples?: SeerEmbedExample[];
  featureFlag?: string;
}

export const SEER_EMBED_SCHEMAS = {
  timestamp: {
    description:
      'Display a formatted timestamp inline. ALL datetime values MUST use this embed — never output a bare date/time or relative phrase (e.g. "two days ago") as plaintext. Use format "absolute" for a specific date/time and "relative" for a human-friendly relative duration (the UI renders it live). Do not include redundant plaintext alongside the embed.',
    level: ['inline'],
    schema: z.object({
      value: z.string(),
      format: z.enum(['absolute', 'relative']).default('absolute'),
    }),
    examples: [
      {label: 'Absolute', data: {value: '2025-07-15T14:30:00Z', format: 'absolute'}},
      {label: 'Relative', data: {value: '2025-07-15T14:30:00Z', format: 'relative'}},
    ],
  },
  docs: {
    description:
      'Link to a page in the Sentry documentation (docs.sentry.io only). ' +
      'The href MUST be an absolute https://docs.sentry.io/... URL. ' +
      'NEVER use this for Sentry issue links — use the `issue` or `issues` embed instead.',
    level: ['inline'],
    schema: z.object({href: z.string(), title: z.string()}),
    examples: [
      {
        label: 'Doc link',
        data: {href: 'https://docs.sentry.io/product/issues/', title: 'Issues'},
      },
    ],
  },
  dsn: {
    description:
      'Display a copyable Sentry DSN (Data Source Name) string. ' +
      'Use this whenever presenting a DSN to the user — never output it as bare text.',
    level: ['block'],
    schema: z.object({value: z.string()}),
    examples: [
      {
        label: 'DSN',
        data: {value: 'https://examplePublicKey@o0.ingest.sentry.io/0'},
      },
    ],
  },
  user: {
    description:
      'Mention a Sentry user or team inline. Renders an avatar and display name. ' +
      'Use the actor type ("user" or "team") and the actor\'s ID and name.',
    level: ['inline'],
    schema: z.object({
      id: z.string(),
      type: z.enum(['user', 'team']),
      name: z.string(),
    }),
    examples: [
      {label: 'User', data: {id: '1', type: 'user', name: 'Jane Doe'}},
      {label: 'Team', data: {id: '2', type: 'team', name: 'platform'}},
    ],
  },
  issue: {
    description:
      'The ONLY way to reference a Sentry issue. Requires the issue short ID ' +
      '(e.g. "PROJECT-123"). ' +
      'Inline: renders a compact link with the short id. ' +
      'Block: renders a full interactive issue row with title, events, users, ' +
      'assignee, and trend graph — do NOT duplicate any of that data as text. ' +
      'MUST NOT appear inside a markdown table or list. ' +
      'When referencing 2+ issues, use the `issues` embed instead. ' +
      'Never use `docs` or markdown links for issue references.',
    level: ['inline', 'block'],
    schema: z.object({id: z.string()}),
    examples: [
      {label: 'Inline', level: 'inline', data: {id: 'JAVASCRIPT-22SP'}},
      {label: 'Block', level: 'block', data: {id: 'JAVASCRIPT-22SP'}},
    ],
  },
  issues: {
    description:
      'The ONLY way to list multiple Sentry issues. Renders an interactive ' +
      'table with title, trend graph, events, users, priority, and assignee ' +
      'for each issue — do NOT duplicate any of that data as text. ' +
      'ALWAYS use this when referencing 2+ issues. ' +
      'MUST NOT appear inside a markdown table or list. ' +
      'Never use `docs`, `issue`, or markdown tables for multiple issues. ' +
      'Provide only the array of issue short IDs (e.g. "PROJECT-123").',
    level: ['block'],
    schema: z.object({ids: z.array(z.string())}),
    examples: [
      {
        label: 'Block',
        level: 'block',
        data: {ids: ['JAVASCRIPT-22SP', 'JAVASCRIPT-39HX', 'JAVASCRIPT-39ZF']},
      },
    ],
  },
  tool: {
    description:
      'Render one agent tool call inside a thinking block. ' +
      'Use variant "read" (default) for quiet lookups — just a title plus an ' +
      'optional `reference` chip naming the entity read (e.g. a trace or span id). ' +
      'Use variant "query" to expose the search the tool ran: pass `query` as a ' +
      'Sentry search string (rendered as filter pills) and `output` as the primary ' +
      'result chip. `status` reflects the call lifecycle. Emit one embed per tool ' +
      'call, in the order they ran. MUST NOT appear inside a markdown table or list.',
    level: ['block'],
    schema: z.object({
      title: z.string(),
      status: z
        .enum(['loading', 'pending', 'success', 'failure', 'mixed'])
        .default('success'),
      variant: z.enum(['read', 'query']).default('read'),
      query: z.string().optional(),
      output: z.object({value: z.string(), label: z.string().optional()}).optional(),
      reference: z.object({value: z.string(), label: z.string().optional()}).optional(),
      notifications: z.array(z.string()).optional(),
    }),
    examples: [
      {
        label: 'Read',
        data: {
          title: 'Read trace waterfall',
          status: 'success',
          reference: {label: 'Trace', value: 'a3805648'},
        },
      },
      {
        label: 'Query',
        data: {
          title: 'Query spans',
          status: 'success',
          variant: 'query',
          query: 'ai_conversation.id:28193042 dataset:spans span.description:DSL',
          output: {label: 'Trace', value: 'a3805648'},
        },
      },
    ],
  },
} as const satisfies Record<string, SeerEmbedSchema>;

export type SeerEmbedName = keyof typeof SEER_EMBED_SCHEMAS;

export function seerEmbedsToJsonSchemas(): Array<{
  body: Record<string, unknown>;
  description: string;
  level: SeerEmbedLevel[];
  name: string;
  examples?: Array<{data: Record<string, unknown>; label: string}>;
  featureFlag?: string;
}> {
  return Object.entries(SEER_EMBED_SCHEMAS).map(([name, entry]) => {
    const def: SeerEmbedSchema = entry;
    return {
      name,
      description: def.description,
      level: [...def.level],
      body: z.toJSONSchema(def.schema) as Record<string, unknown>,
      ...(def.examples && {
        examples: def.examples.map(e => ({label: e.label, data: e.data})),
      }),
      ...(def.featureFlag !== undefined && {featureFlag: def.featureFlag}),
    };
  });
}
