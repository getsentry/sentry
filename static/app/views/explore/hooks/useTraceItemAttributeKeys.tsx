import {useMemo} from 'react';

import type {TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {useQuery} from 'sentry/utils/queryClient';
import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import {
  makeTraceItemAttributeKeysQueryOptions,
  useGetTraceItemAttributeKeys,
} from 'sentry/views/explore/hooks/useGetTraceItemAttributeKeys';
import type {UseTraceItemAttributeBaseProps} from 'sentry/views/explore/types';

interface UseTraceItemAttributeKeysProps extends UseTraceItemAttributeBaseProps {
  enabled?: boolean;
  query?: string;
  search?: string;
}

export function useTraceItemAttributeKeys({
  enabled,
  type,
  traceItemType,
  projects,
  query,
  search,
}: UseTraceItemAttributeKeysProps) {
  const {selection} = usePageFilters();

  const projectIds = defined(projects)
    ? projects.map(project => project.id)
    : selection.projects;

  const queryOptions = useMemo(() => {
    return makeTraceItemAttributeKeysQueryOptions({
      traceItemType,
      type,
      datetime: selection.datetime,
      projectIds,
      query,
    });
  }, [selection, traceItemType, type, projectIds, query]);

  const queryKey = useMemo(
    () => ['use-trace-item-attribute-keys', queryOptions],
    [queryOptions]
  );

  const getTraceItemAttributeKeys = useGetTraceItemAttributeKeys({
    traceItemType,
    type,
    projectIds,
    query,
  });

  const {data, isFetching, error} = useQuery<TagCollection>({
    enabled,
    queryKey: [...queryKey, search],
    queryFn: () => getTraceItemAttributeKeys(search),
  });

  const previous = usePrevious(data, isFetching);

  return {
    attributes: isFetching ? previous : data,
    error,
    isLoading: isFetching,
  };
}

/**
 * We want to remove attributes that have tag wrapper in some cases (eg. datascrubbing attribute field)
 * As they are not valid in some contexts (eg. relay event selectors).
 */
export function elideTagBasedAttributes(attributes: TagCollection) {
  return Object.fromEntries(
    Object.entries(attributes).filter(([key]) => !key.startsWith('tags['))
  );
}
