import {useQuery} from 'sentry/utils/queryClient';
import extractDomNodes from 'sentry/utils/replays/hooks/extractDomNodes';
import type ReplayReader from 'sentry/utils/replays/replayReader';

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
