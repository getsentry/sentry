import {useQuery} from '@tanstack/react-query';

import type {useFeedbackListApiOptions} from 'sentry/components/feedback/useFeedbackListApiOptions';

type FeedbackListApiOptions = ReturnType<typeof useFeedbackListApiOptions>;

interface Props {
  listPrefetchApiOptions: FeedbackListApiOptions;
}

const POLLING_INTERVAL_MS = 10_000;

export function useFeedbackHasNewItems({listPrefetchApiOptions}: Props) {
  const {data} = useQuery({
    ...listPrefetchApiOptions,
    refetchInterval: query =>
      query.state.data?.json?.length ? false : POLLING_INTERVAL_MS,
    staleTime: 0,
  });

  return Boolean(data?.length);
}
