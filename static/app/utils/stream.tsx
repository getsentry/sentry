/**
 * Converts an object representation of a stream query to a string
 * (consumable by the Sentry stream HTTP API).
 */
export function objToQuery(queryObj: Record<string, string>): string {
  const {__text, ...tags} = queryObj;

  const parts = Object.entries(tags).map(([tagKey, value]) => {
    if (
      value.includes(' ') &&
      !value.includes('[') &&
      !value.includes(']') &&
      !value.includes('"') &&
      !value.includes('"')
    ) {
      value = `"${value}"`;
    }

    return `${tagKey}:${value}`;
  });

  if (queryObj.__text) {
    parts.push(queryObj.__text);
  }

  return parts.join(' ');
}
