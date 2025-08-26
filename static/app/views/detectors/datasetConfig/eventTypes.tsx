import {
  FilterType,
  joinQuery,
  parseSearch,
  Token,
} from 'sentry/components/searchSyntax/parser';

// TODO: It is possible this creates a invalid query if they've used event.type inside parenthesis
// eg - (something AND event.type:error)
export function parseEventTypesFromQuery(
  query: string,
  defaultEventTypes: string[]
): {eventTypes: string[]; query: string} {
  if (!query) {
    return {query, eventTypes: defaultEventTypes};
  }

  const parsed = parseSearch(query, {flattenParenGroups: true});
  if (!parsed) {
    return {query, eventTypes: defaultEventTypes};
  }

  const extracted: string[] = [];

  for (const token of parsed) {
    if (token.type !== Token.FILTER) {
      continue;
    }
    const key = token.key;
    if (key.type !== Token.KEY_SIMPLE || key.value !== 'event.type') {
      continue;
    }

    if (token.filter === FilterType.TEXT && token.value) {
      // single value: event.type:<value>
      extracted.push(token.value.value);
    } else if (token.filter === FilterType.TEXT_IN && token.value) {
      // list value: event.type:[a, b]
      for (const item of token.value.items) {
        if (item.value) {
          extracted.push(item.value.value);
        }
      }
    }
  }

  const filtered = extracted.filter(v => defaultEventTypes.includes(v));
  const eventTypes =
    filtered.length > 0
      ? Array.from(new Set(filtered)).toSorted()
      : Array.from(new Set(defaultEventTypes)).toSorted();

  // Remove event.type filters and all explicit space tokens; let joinQuery handle spacing
  const cleanedTokens = parsed.filter(token => {
    if (token.type === Token.SPACES) {
      return false;
    }
    if (token.type !== Token.FILTER) {
      return true;
    }
    const key = token.key;
    return key.type !== Token.KEY_SIMPLE || key.value !== 'event.type';
  });

  const cleanedQuery = joinQuery(cleanedTokens, false, true).trim();

  return {eventTypes, query: cleanedQuery};
}
