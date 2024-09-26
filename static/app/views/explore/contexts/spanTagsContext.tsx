import type React from 'react';
import {createContext, useContext} from 'react';

import type {TagCollection} from 'sentry/types/group';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useSpanFieldSupportedTags} from 'sentry/views/performance/utils/useSpanFieldSupportedTags';

const SpanTagsContext = createContext<
  UseApiQueryResult<TagCollection, RequestError> | undefined
>(undefined);

export function SpanTagsProvider({children}: {children: React.ReactNode}) {
  const results = useSpanFieldSupportedTags();

  return <SpanTagsContext.Provider value={results}>{children}</SpanTagsContext.Provider>;
}

export const useSpanTags = (): UseApiQueryResult<TagCollection, RequestError> => {
  const context = useContext(SpanTagsContext);

  if (context === undefined) {
    throw new Error('useSpanTags must be used within a SpanTagsProvider');
  }

  return context;
};
