import {useEffect, useState} from 'react';
import {useQuery} from '@tanstack/react-query';

import type {useFeedbackListApiOptions} from 'sentry/components/feedback/useFeedbackListApiOptions';

type FeedbackListApiOptions = ReturnType<typeof useFeedbackListApiOptions>;

interface Props {
  listPrefetchApiOptions: FeedbackListApiOptions;
}

const POLLING_INTERVAL_MS = 10_000;

export function useFeedbackHasNewItems({listPrefetchApiOptions}: Props) {
  const [foundData, setFoundData] = useState(false);

  const {data} = useQuery({
    ...listPrefetchApiOptions,
    refetchInterval: POLLING_INTERVAL_MS,
    staleTime: 0,
    enabled: !foundData,
  });

  useEffect(() => {
    // Once we found something, no need to keep polling.
    setFoundData(Boolean(data?.length));
  }, [data]);

  useEffect(() => {
    // New key, start polling again
    setFoundData(false);
  }, [listPrefetchApiOptions]);

  return Boolean(data?.length);
}
