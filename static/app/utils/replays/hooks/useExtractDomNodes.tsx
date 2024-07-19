import {useQuery} from 'sentry/utils/queryClient';
import type ReplayReader from 'sentry/utils/replays/replayReader';

function extractDomNodes({replay}: {replay: null | ReplayReader}) {
  return replay?.getExtractDomNodes();
}

export default function useExtractedDomNodes({replay}: {replay: null | ReplayReader}) {
  return useQuery(
    ['getDomNodes', replay],
    () =>
      extractDomNodes({
        replay,
      }),
    {enabled: Boolean(replay), cacheTime: Infinity}
  );
}
