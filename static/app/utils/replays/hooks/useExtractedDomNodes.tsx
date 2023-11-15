import {useQuery} from 'sentry/utils/queryClient';
import extractDomNodes from 'sentry/utils/replays/extractDomNodes';
import ReplayReader from 'sentry/utils/replays/replayReader';

export default function useExtractedDomNodes({replay}: {replay: null | ReplayReader}) {
  return useQuery(
    ['getDomNodes', replay],
    () =>
      extractDomNodes({
        frames: replay?.getDOMFrames(),
        rrwebEvents: replay?.getRRWebFrames(),
        startTimestampMs: replay?.getReplay().started_at.getTime() ?? 0,
      }),
    {enabled: Boolean(replay), cacheTime: Infinity}
  );
}
