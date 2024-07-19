import {useQuery} from 'sentry/utils/queryClient';
import type ReplayReader from 'sentry/utils/replays/replayReader';

export default function useExtractDomNodes({replay}: {replay: null | ReplayReader}) {
  return useQuery(
    ['getDomNodes', replay],
    () => {
      return replay?.getExtractDomNodes();
    },
    {enabled: Boolean(replay), cacheTime: Infinity}
  );
}
