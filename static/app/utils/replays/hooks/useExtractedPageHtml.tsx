import {useQuery} from 'sentry/utils/queryClient';
import extractPageHtml from 'sentry/utils/replays/hooks/extractPageHtml';
import type ReplayReader from 'sentry/utils/replays/replayReader';

interface Props {
  // offsetMsToStopAt: number[];
  replay: ReplayReader | null;
}

export default function useExtractedPageHtml({replay}: Props) {
  return useQuery(
    ['extactPageHtml', replay],
    () =>
      extractPageHtml({
        replay,
      }),
    {enabled: Boolean(replay), cacheTime: Infinity}
  );
}
