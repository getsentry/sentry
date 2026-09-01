import {isLaneEmbedName, type SeerLaneEmbedName} from './schemas';

/**
 * An embed reference: `{blockId}.{type}.{key}`.
 *
 * Seer mints one when it puts a payload on `structuredContent`, so the markdown carries only the
 * address and the payload never crosses the model.
 */
export interface EmbedReference {
  blockId: string;
  key: string;
  name: SeerLaneEmbedName;
}

/**
 * Parse a `ref` attribute, or null if it is not one this build can resolve.
 *
 * The block id is matched loosely because it is opaque here; the type segment must name a
 * registered embed, which is what lets resolution be a table lookup rather than a conditional.
 */
export function parseEmbedReference(ref: string): EmbedReference | null {
  const separator = ref.lastIndexOf('.');
  const typeSeparator = ref.lastIndexOf('.', separator - 1);
  if (separator <= 0 || typeSeparator <= 0) {
    return null;
  }
  const blockId = ref.slice(0, typeSeparator);
  const name = ref.slice(typeSeparator + 1, separator);
  const key = ref.slice(separator + 1);
  if (!blockId || !key || !isLaneEmbedName(name)) {
    return null;
  }
  return {blockId, name, key};
}
