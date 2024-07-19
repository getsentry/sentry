import {useQuery} from 'sentry/utils/queryClient';
import type ReplayReader from 'sentry/utils/replays/replayReader';

function countDomNodes({replay}: {replay: null | ReplayReader}) {
  return replay?.getCountDomNodes();
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
