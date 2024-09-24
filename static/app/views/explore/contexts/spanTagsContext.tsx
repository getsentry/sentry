import type React from 'react';
import {createContext, useContext} from 'react';

import type {TagCollection} from 'sentry/types/group';
import {useSpanFieldSupportedTags} from 'sentry/views/performance/utils/useSpanFieldSupportedTags';

const SpanTagsContext = createContext<TagCollection | undefined>(undefined);

export function SpanTagsProvider({children}: {children: React.ReactNode}) {
  const tags = useSpanFieldSupportedTags();

  return <SpanTagsContext.Provider value={tags}>{children}</SpanTagsContext.Provider>;
}

export const useSpanTags = (): TagCollection => {
  const context = useContext(SpanTagsContext);

  if (context === undefined) {
    throw new Error('useSpanTags must be used within a SpanTagsProvider');
  }

  return context;
};
