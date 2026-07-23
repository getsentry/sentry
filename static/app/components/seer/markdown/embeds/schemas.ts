import {z} from 'zod';

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
      'Link to a page in the Sentry documentation. Use this whenever you ' +
      'reference a Sentry feature or concept that has official docs. ' +
      'The href MUST be an absolute https://docs.sentry.io/... URL.',
    level: ['inline'],
    schema: z.object({href: z.string(), title: z.string()}),
    examples: [
      {
        label: 'Doc link',
        data: {href: 'https://docs.sentry.io/product/issues/', title: 'Issues'},
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
