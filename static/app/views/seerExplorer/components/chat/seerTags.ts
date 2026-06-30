import {z} from 'zod';

type SeerTagLevel = 'inline' | 'block';

interface SeerTagSchema {
  description: string;
  level: SeerTagLevel[];
  schema: z.ZodObject<z.ZodRawShape>;
  featureFlag?: string;
}

export const SEER_TAG_SCHEMAS = {
  timestamp: {
    description: 'Display a formatted timestamp inline.',
    level: ['inline'],
    schema: z.object({
      value: z.string(),
      format: z.enum(['relative']).optional(),
    }),
  },
} as const satisfies Record<string, SeerTagSchema>;

export type SeerTagName = keyof typeof SEER_TAG_SCHEMAS;

export function seerTagsToJsonSchemas(): Array<{
  body: Record<PropertyKey, unknown>;
  description: string;
  level: SeerTagLevel[];
  name: string;
  featureFlag?: string;
}> {
  return Object.entries(SEER_TAG_SCHEMAS).map(([name, entry]) => {
    const def: SeerTagSchema = entry;
    return {
      name,
      description: def.description,
      level: [...def.level],
      body: z.toJSONSchema(def.schema),
      ...(def.featureFlag !== undefined && {featureFlag: def.featureFlag}),
    };
  });
}
