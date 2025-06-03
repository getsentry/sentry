import {useQuery} from 'sentry/utils/queryClient';
import type {Extraction} from 'sentry/utils/replays/extractDomNodes';
import type ReplayReader from 'sentry/utils/replays/replayReader';
import type {ReplayFrame} from 'sentry/utils/replays/types';

interface Params {
  enabled: boolean;
  frame: ReplayFrame;
  replay: null | ReplayReader;
}

export default function useExtractDomNodes({replay, frame, enabled = true}: Params) {
  return useQuery<Extraction | null>({
    queryKey: ['getDomNodes', frame, replay],
    // Note: we filter out `style` mutations due to perf issues.
    // We can do this as long as we only need the HTML and not need to
    // visualize the rendered elements
    queryFn: () => replay?.getDomNodesForFrame({frame}) ?? null,
    enabled: Boolean(!replay?.isFetching() && enabled),
    gcTime: Infinity,
    staleTime: Infinity,
    retry: false,
  });
}
