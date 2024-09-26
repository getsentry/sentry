import {useQuery, type UseQueryResult} from 'sentry/utils/queryClient';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import type {RecordingFrame} from 'sentry/utils/replays/types';

export type DomNodeChartDatapoint = {
  added: number;
  count: number;
  endTimestampMs: number;
  removed: number;
  startTimestampMs: number;
  timestampMs: number;
};

export default function useCountDomNodes({
  replay,
}: {
  replay: null | ReplayReader;
}): UseQueryResult<Map<RecordingFrame, DomNodeChartDatapoint>> {
  return useQuery({
    queryKey: ['countDomNodes', replay],
    queryFn: () => {
      return replay?.getCountDomNodes();
    },
    enabled: Boolean(replay),
    gcTime: Infinity,
  });
}
