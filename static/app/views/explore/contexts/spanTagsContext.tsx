import type React from 'react';

import type {Project} from 'sentry/types/project';
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
  projects?: Project[];
}

export function SpanTagsProvider({children, enabled, projects}: SpanTagsProviderProps) {
  return (
    <TraceItemAttributeProvider
      traceItemType={TraceItemDataset.SPANS}
      enabled={enabled}
      projects={projects}
    >
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
