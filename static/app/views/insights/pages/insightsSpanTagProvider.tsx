import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function InsightsSpanTagProvider({children}: {children: React.ReactNode}) {
  return (
    <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
      {children}
    </TraceItemAttributeProvider>
  );
}
