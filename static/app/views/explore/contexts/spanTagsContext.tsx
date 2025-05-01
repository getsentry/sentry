import type React from 'react';

import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  TraceItemAttributeProvider,
  useTraceItemAttributes,
} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface SpanTagsProviderProps {
  children: React.ReactNode;
  dataset: DiscoverDatasets;
  enabled: boolean;
}

export function SpanTagsProvider({children, enabled}: SpanTagsProviderProps) {
  return (
    <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled={enabled}>
      {children}
    </TraceItemAttributeProvider>
  );
}

export function useSpanTags(type?: 'number' | 'string') {
  const {attributes, isLoading} = useTraceItemAttributes(type);
  return {
    tags: attributes,
    isLoading,
  };
}

export function useSpanTag(key: string) {
  const {tags: numberTags} = useSpanTags('number');
  const {tags: stringTags} = useSpanTags('string');

  return stringTags[key] ?? numberTags[key] ?? null;
}
