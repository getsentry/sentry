import {useEffect, useState} from 'react';

import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';

interface Props {
  listPrefetchQueryKey: ApiQueryKey | undefined;
}

const POLLING_INTERVAL_MS = 10_000;

export default function useFeedbackHasNewItems({listPrefetchQueryKey}: Props) {
  const [foundData, setFoundData] = useState(false);

  const {data} = useApiQuery<unknown[]>(listPrefetchQueryKey ?? [''], {
    refetchInterval: POLLING_INTERVAL_MS,
    staleTime: 0,
    enabled: Boolean(listPrefetchQueryKey?.[0]) && !foundData,
  });

  useEffect(() => {
    // Once we found something, no need to keep polling.
    setFoundData(Boolean(data?.length));
  }, [data]);

  useEffect(() => {
    // New key, start polling again
    setFoundData(false);
  }, [listPrefetchQueryKey]);

  return Boolean(data?.length);
}
