import {createContext, useContext} from 'react';
import {z} from 'zod';

import {STRUCTURED_SEER_EMBED_SCHEMAS} from './embeds/schemas';

export const embedReferenceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  body: z.unknown(),
});

export type EmbedReference = z.infer<typeof embedReferenceSchema>;
export type EmbedReferenceResolver = (
  id: string,
  includeCurrentBlock: boolean
) => EmbedReference | undefined;

// Null selects legacy payload tags; even an empty resolver selects references-only mode.
export const EmbedReferenceContext = createContext<EmbedReferenceResolver | null>(null);

export function useResolvedEmbed({
  name,
  data,
  attrs,
  structuredContent = null,
}: {
  attrs: Record<string, string>;
  data: unknown;
  name: string;
  structuredContent?: Record<string, unknown> | null;
}): {body: unknown; name: string} | null {
  const resolveReference = useContext(EmbedReferenceContext);
  if (resolveReference) {
    if (name === 'embed') {
      return resolveReference(attrs.ref ?? '', structuredContent !== null) ?? null;
    }
    // Only tool-result renderers supply structuredContent. Assistant text cannot
    // supply or override these server-owned widgets with an inline body.
    if (name === 'autofix' || name in STRUCTURED_SEER_EMBED_SCHEMAS) {
      return structuredContent?.[name] === undefined
        ? null
        : {name, body: structuredContent[name]};
    }
    return null;
  }
  return {
    name,
    body:
      name in STRUCTURED_SEER_EMBED_SCHEMAS || data === undefined
        ? structuredContent?.[name]
        : data,
  };
}
