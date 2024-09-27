import type React from 'react';
import {createContext, useContext} from 'react';

import type {TagCollection} from 'sentry/types/group';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {
  type SpanFieldsResponse,
  useSpanFieldSupportedTags,
} from 'sentry/views/performance/utils/useSpanFieldSupportedTags';

const SpanTagsContext = createContext<
  | (Omit<UseApiQueryResult<SpanFieldsResponse, RequestError>, 'data'> & {
      data: TagCollection;
    })
  | undefined
>(undefined);

export function SpanTagsProvider({children}: {children: React.ReactNode}) {
  const results = useSpanFieldSupportedTags();

  return <SpanTagsContext.Provider value={results}>{children}</SpanTagsContext.Provider>;
}

export const useSpanTags = () => {
  const context = useContext(SpanTagsContext);

  if (context === undefined) {
    throw new Error('useSpanTags must be used within a SpanTagsProvider');
  }

  return context;
};
