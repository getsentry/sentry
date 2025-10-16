import {useRef} from 'react';

import {useApiQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  isLive: boolean;
  orgSlug: string;
  replayId: string;
  replayReader: ReplayReader | null;
  pollInterval?: number;
};
// A react hook to poll the replay record on the backend every POLL_INTERVAL to
// check if the replay record has been updated based on count_segments field.
function usePollReplayRecord({
  isLive,
  orgSlug,
  replayId,
  replayReader,
  pollInterval = 30_000, // Default to every 30 seconds
}: Props): boolean {
  // we use {} to avoid colliding with the queryKey used by useReplayData
  const queryKey: ApiQueryKey = [`/organizations/${orgSlug}/replays/${replayId}/`, {}];

  const isUpdated = useRef(false);

  const {data: replayData} = useApiQuery<{data: ReplayRecord}>(queryKey, {
    refetchInterval: () => {
      return !isUpdated.current && isLive ? pollInterval : false;
    },
    refetchIntervalInBackground: true,
    staleTime: Infinity,
  });

  const polledReplayRecord = replayData?.data;
  if (
    polledReplayRecord &&
    replayReader &&
    polledReplayRecord.count_segments !== replayReader.getReplay().count_segments
  ) {
    isUpdated.current = true;
  }

  return isUpdated.current;
}

export default usePollReplayRecord;
