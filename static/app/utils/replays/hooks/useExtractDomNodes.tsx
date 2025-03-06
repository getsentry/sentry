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
    // Note: we filter out `style` mutations due to perf issues.
    // We can do this as long as we only need the HTML and not need to
    // visualize the rendered elements
    queryFn: () => replay?.getExtractDomNodes({withoutStyles: true}),
    enabled: Boolean(replay),
    gcTime: Infinity,
  });
}
