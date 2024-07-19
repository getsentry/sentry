import {useQuery} from 'sentry/utils/queryClient';
import type {Extraction} from 'sentry/utils/replays/extractHtml';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import type {ReplayFrame} from 'sentry/utils/replays/types';

function extractDomNodes({
  replay,
}: {
  replay: null | ReplayReader;
}): Promise<Map<ReplayFrame, Extraction>> {
  return replay?.getExtractDomNodes() ?? Promise.resolve(new Map());
}

export default function useExtractDomNodes({replay}: {replay: null | ReplayReader}) {
  return useQuery(
    ['getDomNodes', replay],
    () =>
      extractDomNodes({
        replay,
      }),
    {enabled: Boolean(replay), cacheTime: Infinity}
  );
}
