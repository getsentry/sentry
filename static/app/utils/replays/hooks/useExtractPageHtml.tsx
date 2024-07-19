import {useQuery} from 'sentry/utils/queryClient';
import type ReplayReader from 'sentry/utils/replays/replayReader';

interface Props {
  // offsetMsToStopAt: number[];
  replay: ReplayReader | null;
}

async function extractPageHtml({replay}: {replay: null | ReplayReader}) {
  const results = await replay?.getExtractPageHtml();
  return Array.from(results?.entries() ?? []).map(([frame, html]) => {
    return [frame.offsetMs, html];
  });
}

export default function useExtractPageHtml({replay}: Props) {
  return useQuery(
    ['extactPageHtml', replay],
    () =>
      extractPageHtml({
        replay,
      }),
    {enabled: Boolean(replay), cacheTime: Infinity}
  );
}
