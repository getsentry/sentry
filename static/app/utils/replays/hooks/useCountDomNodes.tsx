import {useQuery} from 'sentry/utils/queryClient';
import type ReplayReader from 'sentry/utils/replays/replayReader';

export type DomNodeChartDatapoint = {
  added: number;
  count: number;
  endTimestampMs: number;
  removed: number;
  startTimestampMs: number;
  timestampMs: number;
};

export default function useCountDomNodes({replay}: {replay: null | ReplayReader}) {
  return useQuery(
    ['countDomNodes', replay],
    () => {
      return replay?.getCountDomNodes();
    },
    {enabled: Boolean(replay), cacheTime: Infinity}
  );
}
