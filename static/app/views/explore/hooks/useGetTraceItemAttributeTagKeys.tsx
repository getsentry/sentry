import {useCallback} from 'react';

import type {GetTagKeys} from 'sentry/components/searchQueryBuilder';
import type {PageFilters} from 'sentry/types/core';
import type {Tag, TagCollection} from 'sentry/types/group';
import {useGetTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useGetTraceItemAttributeKeys';
import type {TraceItemDataset} from 'sentry/views/explore/types';

export function useGetTraceItemAttributeTagKeys({
  itemType,
  projects,
  extraTags,
  query,
  hiddenKeys,
}: {
  itemType: TraceItemDataset;
  extraTags?: TagCollection;
  hiddenKeys?: string[];
  projects?: PageFilters['projects'];
  query?: string;
}): GetTagKeys {
  const getStringKeys = useGetTraceItemAttributeKeys({
    traceItemType: itemType,
    type: 'string',
    projectIds: projects,
    query,
  });
  const getNumberKeys = useGetTraceItemAttributeKeys({
    traceItemType: itemType,
    type: 'number',
    projectIds: projects,
    query,
  });
  const getBooleanKeys = useGetTraceItemAttributeKeys({
    traceItemType: itemType,
    type: 'boolean',
    projectIds: projects,
    query,
  });

  return useCallback(
    async (searchQuery: string): Promise<Tag[]> => {
      const [s, n, b] = await Promise.all([
        getStringKeys(searchQuery),
        getNumberKeys(searchQuery),
        getBooleanKeys(searchQuery),
      ]);
      const hiddenKeySet = hiddenKeys ? new Set(hiddenKeys) : undefined;
      const fetched = [...Object.values(s), ...Object.values(n), ...Object.values(b)];
      const filteredFetched = hiddenKeySet
        ? fetched.filter(t => !hiddenKeySet.has(t.key))
        : fetched;
      const fetchedKeySet = new Set(filteredFetched.map(t => t.key));
      return [
        ...filteredFetched,
        ...Object.values(extraTags ?? []).filter(t => !fetchedKeySet.has(t.key)),
      ];
    },
    [getStringKeys, getNumberKeys, getBooleanKeys, extraTags, hiddenKeys]
  );
}
