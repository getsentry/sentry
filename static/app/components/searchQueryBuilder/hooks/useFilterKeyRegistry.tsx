import {useCallback, useId, useMemo} from 'react';
import {type QueryKey, useQueryClient, queryOptions} from '@tanstack/react-query';

import type {Tag, TagCollection} from 'sentry/types/group';

export function useFilterKeyRegistry({
  asyncFilterKeyRegistryQueryKey,
}: {
  asyncFilterKeyRegistryQueryKey?: QueryKey;
}) {
  const queryClient = useQueryClient();
  const fallbackRegistryId = useId();

  const filterKeyRegistryQueryKey = useMemo<QueryKey>(
    () =>
      asyncFilterKeyRegistryQueryKey ?? [
        'search-query-builder-filter-key-registry',
        fallbackRegistryId,
      ],
    [asyncFilterKeyRegistryQueryKey, fallbackRegistryId]
  );

  const filterKeyRegistryQueryOptions = useMemo(
    () =>
      queryOptions({
        queryKey: filterKeyRegistryQueryKey,
        queryFn: () => ({}),
        staleTime: Infinity,
      }),
    [filterKeyRegistryQueryKey]
  );

  const registerFilterKeys = useCallback(
    (tags: Tag[], registryQueryKey: QueryKey) => {
      if (!tags.length) {
        return;
      }

      queryClient.setQueryData(
        registryQueryKey,
        (current: TagCollection | undefined): TagCollection => {
          const next = {...current};
          let changed = false;

          for (const tag of tags) {
            const currentTag = current?.[tag.key];
            if (
              currentTag?.name === tag.name &&
              currentTag?.kind === tag.kind &&
              currentTag?.predefined === tag.predefined
            ) {
              continue;
            }

            next[tag.key] = tag;
            changed = true;
          }

          return changed ? next : (current ?? {});
        }
      );
    },
    [queryClient]
  );

  return {
    filterKeyRegistryQueryOptions,
    registerFilterKeys,
  };
}
