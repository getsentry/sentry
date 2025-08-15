/**
 * Check if a string value looks like it could be a JSON-encoded array. This is
 useful for situations where we used JSON strings to store array values because
 array storage was not possible.
 *
 * This function does _not_ parse the string as JSON because in most cases we
 have to decode the string anyway to render it, and we don't want to decode
 twice. Instead, the renderer gracefully fails if the JSON is not valid.
 */
export function looksLikeAJSONArray(value: string) {
  const trimmedValue = value.trim();

  // The string '[Filtered]' looks array-like, but it's actually a Relay special string
  if (trimmedValue === '[Filtered]') return false;
  return trimmedValue.startsWith('[') && trimmedValue.endsWith(']');
}
