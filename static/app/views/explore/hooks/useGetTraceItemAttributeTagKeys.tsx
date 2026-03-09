import {useCallback, useMemo} from 'react';

import type {GetTagKeys} from 'sentry/components/searchQueryBuilder';
import type {PageFilters} from 'sentry/types/core';
import type {Tag, TagCollection} from 'sentry/types/group';
import {useGetTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useGetTraceItemAttributeKeys';
import type {TraceItemDataset} from 'sentry/views/explore/types';

export function useGetTraceItemAttributeTagKeys({
  itemType,
  projects,
  extraTags,
}: {
  itemType: TraceItemDataset;
  extraTags?: TagCollection;
  projects?: PageFilters['projects'];
}): GetTagKeys {
  const getStringKeys = useGetTraceItemAttributeKeys({
    traceItemType: itemType,
    type: 'string',
    projectIds: projects,
  });
  const getNumberKeys = useGetTraceItemAttributeKeys({
    traceItemType: itemType,
    type: 'number',
    projectIds: projects,
  });
  const getBooleanKeys = useGetTraceItemAttributeKeys({
    traceItemType: itemType,
    type: 'boolean',
    projectIds: projects,
  });

  const extraTagValues = useMemo(
    () => (extraTags ? Object.values(extraTags) : []),
    [extraTags]
  );

  return useCallback(
    async (searchQuery: string): Promise<Tag[]> => {
      const [s, n, b] = await Promise.all([
        getStringKeys(searchQuery),
        getNumberKeys(searchQuery),
        getBooleanKeys(searchQuery),
      ]);
      const fetched = [...Object.values(s), ...Object.values(n), ...Object.values(b)];
      const fetchedKeySet = new Set(fetched.map(t => t.key));
      return [...fetched, ...extraTagValues.filter(t => !fetchedKeySet.has(t.key))];
    },
    [getStringKeys, getNumberKeys, getBooleanKeys, extraTagValues]
  );
}
