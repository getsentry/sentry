import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
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
  const queryKey: ApiQueryKey = [
    getApiUrl('/organizations/$organizationIdOrSlug/replays/$replayId/', {
      path: {organizationIdOrSlug: orgSlug, replayId},
    }),
    {
      // we use { isPolling: true } to avoid colliding with the queryKey used by useReplayData
      query: {isPolling: true},
    },
  ];

  const {data} = useApiQuery<{data: ReplayRecord}>(queryKey, {
    refetchInterval: 30_000,
    enabled,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  return data?.data ? mapResponseToReplayRecord(data.data) : undefined;
}
