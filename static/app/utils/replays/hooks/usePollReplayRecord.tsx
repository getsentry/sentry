import {useApiQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  enabled: boolean;
  orgSlug: string;
  replayId: string;
  pollInterval?: number;
};
// A react hook to poll the replay record on the backend every POLL_INTERVAL
// to get the count_segments field.
function usePollReplayRecord({
  enabled,
  orgSlug,
  replayId,
  pollInterval = 30_000, // Default to every 30 seconds
}: Props): number | undefined {
  // we use {} to avoid colliding with the queryKey used by useReplayData
  const queryKey: ApiQueryKey = [`/organizations/${orgSlug}/replays/${replayId}/`, {}];

  const {data: replayData} = useApiQuery<{data: ReplayRecord}>(queryKey, {
    refetchInterval: pollInterval,
    enabled,
    refetchIntervalInBackground: true,
    staleTime: Infinity,
  });

  const polledReplayRecord = replayData?.data;

  return polledReplayRecord?.count_segments ?? undefined;
}

export default usePollReplayRecord;
