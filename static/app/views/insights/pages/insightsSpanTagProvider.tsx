import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {SpanTagsProvider} from 'sentry/views/explore/contexts/spanTagsContext';

export function InsightsSpanTagProvider({children}: {children: React.ReactNode}) {
  return (
    <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP_RPC} enabled>
      {children}
    </SpanTagsProvider>
  );
}
