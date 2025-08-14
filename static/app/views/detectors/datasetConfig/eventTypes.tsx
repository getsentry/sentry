import {
  FilterType,
  joinQuery,
  parseSearch,
  Token,
} from 'sentry/components/searchSyntax/parser';

import {DetectorDataset} from './types';

/**
 * The allowed event types are also the default event types for each dataset.
 * This may change in the future.
 */
export const DEFAULT_EVENT_TYPES_BY_DATASET: Record<DetectorDataset, string[]> = {
  [DetectorDataset.ERRORS]: ['error', 'default'],
  [DetectorDataset.TRANSACTIONS]: ['transaction'],
  [DetectorDataset.SPANS]: ['trace_item_span'],
  [DetectorDataset.LOGS]: ['trace_item_log'],
  [DetectorDataset.RELEASES]: [],
};

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
    filtered.length > 0 ? Array.from(new Set(filtered)) : defaultEventTypes;

  // Remove event.type filters and all explicit space tokens; let joinQuery handle spacing
  const cleanedTokens = parsed.filter(token => {
    if (token.type === Token.SPACES) {
      return false;
    }
    if (token.type !== Token.FILTER) {
      return true;
    }
    const key = token.key;
    return !(key.type === Token.KEY_SIMPLE && key.value === 'event.type');
  });

  const cleanedQuery = joinQuery(cleanedTokens, false, true).trim();

  return {eventTypes, query: cleanedQuery};
}
