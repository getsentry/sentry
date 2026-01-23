import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  enabled: boolean;
  orgSlug: string;
  replayId: string;
  pollInterval?: number;
};

// A react hook to poll for replay record on the backend every POLL_INTERVAL
function usePollReplayRecord({
  enabled,
  orgSlug,
  replayId,
  pollInterval = 30_000, // Default to every 30 seconds
}: Props): ReplayRecord | undefined {
  const queryKey: ApiQueryKey = [
    getApiUrl('/organizations/$organizationIdOrSlug/replays/$replayId/', {
      path: {organizationIdOrSlug: orgSlug, replayId},
    }),
    {}, // we use {} to avoid colliding with the queryKey used by useReplayData
  ];

  const {data} = useApiQuery<{data: ReplayRecord}>(queryKey, {
    refetchInterval: pollInterval,
    enabled,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  return data?.data ? mapResponseToReplayRecord(data.data) : undefined;
}

export default usePollReplayRecord;
