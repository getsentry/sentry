import {useQuery, type UseQueryResult} from 'sentry/utils/queryClient';
import type {Extraction} from 'sentry/utils/replays/extractDomNodes';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import type {ReplayFrame} from 'sentry/utils/replays/types';

export default function useExtractDomNodes({
  replay,
}: {
  replay: null | ReplayReader;
}): UseQueryResult<Map<ReplayFrame, Extraction>> {
  return useQuery({
    queryKey: ['getDomNodes', replay],
    queryFn: () => replay?.getExtractDomNodes({withoutStyles: true}),
    enabled: Boolean(replay),
    gcTime: Infinity,
  });
}
