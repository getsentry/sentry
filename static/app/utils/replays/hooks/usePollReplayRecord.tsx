import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import type {ReplayRecord} from 'sentry/views/explore/replays/types';

type Props = {
  enabled: boolean;
  orgSlug: string;
  replayId: string;
};

// A react hook to poll for replay record on the backend every POLL_INTERVAL
export function usePollReplayRecord({
  enabled,
  orgSlug,
  replayId,
}: Props): ReplayRecord | undefined {
  const queryOptions = apiOptions.as<{data: ReplayRecord}>()(
    '/organizations/$organizationIdOrSlug/replays/$replayId/',
    {
      path: {organizationIdOrSlug: orgSlug, replayId},
      // we use { isPolling: true } to avoid colliding with the queryKey used by useReplayData
      query: {isPolling: true},
      staleTime: 0,
    }
  );

  const {data} = useQuery({
    ...queryOptions,
    refetchInterval: 30_000,
    enabled,
    refetchIntervalInBackground: true,
  });

  return data?.data ? mapResponseToReplayRecord(data.data) : undefined;
}
