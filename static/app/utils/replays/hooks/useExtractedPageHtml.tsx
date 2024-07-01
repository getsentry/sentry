import {useQuery} from 'sentry/utils/queryClient';
import extractPageHtml from 'sentry/utils/replays/extractPageHtml';
import type ReplayReader from 'sentry/utils/replays/replayReader';

interface Props {
  offsetMsToStopAt: number[];
  replay: ReplayReader | null;
}

export default function useExtractedPageHtml({replay, offsetMsToStopAt}: Props) {
  return useQuery(
    ['extactPageHtml', replay],
    () =>
      extractPageHtml({
        offsetMsToStopAt,
        rrwebEvents: replay?.getRRWebFrames(),
        startTimestampMs: replay?.getReplay().started_at.getTime() ?? 0,
      }),
    {enabled: Boolean(replay), cacheTime: Infinity}
  );
}
