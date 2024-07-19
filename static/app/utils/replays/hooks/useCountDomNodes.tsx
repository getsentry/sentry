import {useQuery} from 'sentry/utils/queryClient';
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

function countDomNodes({
  replay,
}: {
  replay: null | ReplayReader;
}): Promise<Map<RecordingFrame, DomNodeChartDatapoint>> {
  return replay?.getCountDomNodes() ?? Promise.resolve(new Map());
}

export default function useCountDomNodes({replay}: {replay: null | ReplayReader}) {
  return useQuery(
    ['countDomNodes', replay],
    () =>
      countDomNodes({
        replay,
      }),
    {enabled: Boolean(replay), cacheTime: Infinity}
  );
}
