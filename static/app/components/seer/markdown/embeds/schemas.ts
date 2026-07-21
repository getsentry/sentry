import {z} from 'zod';

type SeerEmbedLevel = 'inline' | 'block';

interface SeerEmbedSchema {
  description: string;
  level: SeerEmbedLevel[];
  schema: z.ZodObject;
  featureFlag?: string;
}

export const SEER_EMBED_SCHEMAS = {
  timestamp: {
    description: 'Display a formatted timestamp inline.',
    level: ['inline'],
    schema: z.object({
      value: z.string(),
      format: z.enum(['absolute', 'relative']).default('absolute'),
    }),
  },
  docs: {
    description:
      'Link to a page in the Sentry documentation. Use this whenever you ' +
      'reference a Sentry feature or concept that has official docs. ' +
      'The href MUST be an absolute https://docs.sentry.io/... URL.',
    level: ['inline'],
    schema: z.object({href: z.string(), title: z.string()}),
  },
  issue: {
    description:
      'Reference a Sentry issue by its group id. Inline renders a compact ' +
      'link labeled with the issue short id; block renders the full issue ' +
      'feed row. The title MUST be the issue short id (e.g. "JAVASCRIPT-2X4").',
    level: ['inline', 'block'],
    schema: z.object({groupId: z.string(), title: z.string()}),
  },
} as const satisfies Record<string, SeerEmbedSchema>;

export type SeerEmbedName = keyof typeof SEER_EMBED_SCHEMAS;

export function seerEmbedsToJsonSchemas(): Array<{
  body: Record<string, unknown>;
  description: string;
  level: SeerEmbedLevel[];
  name: string;
  featureFlag?: string;
}> {
  return Object.entries(SEER_EMBED_SCHEMAS).map(([name, entry]) => {
    const def: SeerEmbedSchema = entry;
    return {
      name,
      description: def.description,
      level: [...def.level],
      body: z.toJSONSchema(def.schema) as Record<string, unknown>,
      ...(def.featureFlag !== undefined && {featureFlag: def.featureFlag}),
    };
  });
}
