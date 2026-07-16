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
