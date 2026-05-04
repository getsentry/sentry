import type {QueryClient} from '@tanstack/react-query';

import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {safeParseQueryKey, type ApiQueryKey} from 'sentry/utils/api/apiQueryKey';

type PrefixSearchCacheKey = {
  optionsFingerprint: string;
  queryFingerprint: string;
  substringMatch: string;
  url: string;
};

// If an earlier request with a shorter `substringMatch` (and otherwise-identical params)
// returned an empty list, any longer search that has that value as a prefix is guaranteed
// to also be empty. Reuse the cached empty response instead of re-fetching.
export function findFreshEmptyPrefixSearchCacheMatch({
  client,
  currentKey,
}: {
  client: QueryClient;
  currentKey: ApiQueryKey;
}): ApiResponse<never[]> | undefined {
  const currentSearch = getPrefixSearchCacheKey(currentKey);
  if (!currentSearch) {
    return undefined;
  }

  for (const query of client.getQueryCache().getAll()) {
    if (query.isStale()) {
      continue;
    }
    const cachedSearch = getPrefixSearchCacheKey(query.queryKey);
    if (
      !cachedSearch ||
      !(
        cachedSearch.url === currentSearch.url &&
        cachedSearch.queryFingerprint === currentSearch.queryFingerprint &&
        cachedSearch.optionsFingerprint === currentSearch.optionsFingerprint &&
        currentSearch.substringMatch.startsWith(cachedSearch.substringMatch) &&
        cachedSearch.substringMatch.length < currentSearch.substringMatch.length
      )
    ) {
      continue;
    }

    const data = query.state.data as ApiResponse<unknown[]> | undefined;
    if (data !== undefined && Array.isArray(data.json) && data.json.length === 0) {
      return data as ApiResponse<never[]>;
    }
  }

  return undefined;
}

function getPrefixSearchCacheKey(queryKey: unknown): PrefixSearchCacheKey | undefined {
  if (!Array.isArray(queryKey) || queryKey.length < 2 || queryKey.length > 3) {
    return undefined;
  }

  const parsed = safeParseQueryKey(queryKey);
  if (parsed?.version !== 'v2' || parsed.isInfinite || !parsed.options) {
    return undefined;
  }

  const query = getRecord(parsed.options.query);
  const substringMatch = query?.substringMatch;
  if (!query || typeof substringMatch !== 'string' || substringMatch.length === 0) {
    return undefined;
  }

  const {substringMatch: _ignoredSubstring, ...queryWithoutSubstring} = query;
  const {query: _ignoredQuery, ...optionsWithoutQuery} = parsed.options;

  return {
    url: parsed.url,
    substringMatch,
    queryFingerprint: JSON.stringify(queryWithoutSubstring),
    optionsFingerprint: JSON.stringify(optionsWithoutQuery),
  };
}

function getRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
