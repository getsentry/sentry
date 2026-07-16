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
  todos: {
    description:
      'Your todo checklist. The todo_write tool emits this tag automatically — NEVER write a {% todos %} tag yourself and never restate the todo list in prose. The latest occurrence in the conversation replaces all earlier ones.',
    level: ['block'],
    featureFlag: 'organizations:seer-explorer-todos-markdown',
    schema: z.object({
      items: z.array(
        z.object({
          content: z.string(),
          status: z.enum(['pending', 'in_progress', 'completed']),
        })
      ),
    }),
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
