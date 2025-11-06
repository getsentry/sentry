/**
 * Check if a string value looks like it could be a JSON-encoded object. This is
 useful for situations where we used JSON strings to store object values because
 object storage was not possible.
 *
 * This function does _not_ parse the string as JSON because in most cases we
 have to decode the string anyway to render it, and we don't want to decode
 twice. Instead, the renderer gracefully fails if the JSON is not valid.
 */
export function looksLikeAJSONObject(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.startsWith('{') && trimmedValue.endsWith('}');
}
