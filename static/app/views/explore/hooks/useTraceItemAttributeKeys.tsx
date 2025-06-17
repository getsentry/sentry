import {useMemo} from 'react';

import type {TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {useQuery} from 'sentry/utils/queryClient';
import usePrevious from 'sentry/utils/usePrevious';
import {
  useGetTraceItemAttributeKeys,
  useTraceItemAttributeKeysQueryOptions,
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
  const queryOptions = useTraceItemAttributeKeysQueryOptions({
    traceItemType,
    type,
    projectIds: defined(projects) ? projects.map(project => project.id) : undefined,
  });

  const queryKey = useMemo(
    () => ['use-trace-item-attribute-keys', queryOptions],
    [queryOptions]
  );

  const getTraceItemAttributeKeys = useGetTraceItemAttributeKeys({
    traceItemType,
    type,
    projectIds: defined(projects) ? projects.map(project => project.id) : undefined,
  });

  const {data, isFetching} = useQuery<TagCollection>({
    enabled,
    queryKey,
    queryFn: () => getTraceItemAttributeKeys(''),
  });

  const previous = usePrevious(data, isFetching);

  return {
    attributes: isFetching ? previous : data,
    isLoading: isFetching,
  };
}
