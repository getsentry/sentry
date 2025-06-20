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
}

export function useTraceItemAttributeKeys({
  enabled,
  type,
  traceItemType,
  projects,
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
    });
  }, [selection, traceItemType, type, projectIds]);

  const queryKey = useMemo(
    () => ['use-trace-item-attribute-keys', queryOptions],
    [queryOptions]
  );

  const getTraceItemAttributeKeys = useGetTraceItemAttributeKeys({
    traceItemType,
    type,
    projectIds,
  });

  const {data, isFetching, error} = useQuery<TagCollection>({
    enabled,
    queryKey,
    queryFn: () => getTraceItemAttributeKeys(),
  });

  const previous = usePrevious(data, isFetching);

  return {
    attributes: isFetching ? previous : data,
    error,
    isLoading: isFetching,
  };
}
