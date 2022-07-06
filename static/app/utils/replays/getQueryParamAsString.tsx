export function getQueryParamAsString(query: string | string[] | null | undefined) {
  if (!query) {
    return '';
  }
  return Array.isArray(query) ? query.join(' ') : query;
}
