import {createContext, useContext, useMemo} from 'react';

import {
  useSpanBuiltinNumericTags,
  useSpanBuiltinStringTags,
  useSpanCustomNumericTags,
  useSpanCustomStringTags,
  useSpanFunctionTags,
} from 'sentry/components/performance/spanSearchQueryBuilder';
import type {PageFilters} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';

type SpanAttributes = {
  builtinNumerics: TagCollection;
  builtinStrings: TagCollection;
  customNumerics: TagCollection;
  customStrings: TagCollection;
  functions: TagCollection;
};

const ExploreAttributesProviderContext = createContext<SpanAttributes>({
  builtinNumerics: {},
  builtinStrings: {},
  customNumerics: {},
  customStrings: {},
  functions: {},
});

interface ExploreAttributesProviderProps {
  children: React.ReactNode;
  pageFilters: Readonly<PageFilters>;
}

export function ExploreAttributesProvider(props: ExploreAttributesProviderProps) {
  const builtinNumerics = useSpanBuiltinNumericTags();
  const builtinStrings = useSpanBuiltinStringTags({});
  const customNumerics = useSpanCustomNumericTags({});
  const customStrings = useSpanCustomStringTags({});
  const functions = useSpanFunctionTags({
    functions: ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  });

  const attributes: SpanAttributes = useMemo(() => {
    return {
      builtinNumerics,
      builtinStrings,
      customNumerics,
      customStrings,
      functions,
    };
  }, [builtinNumerics, builtinStrings, customNumerics, customStrings, functions]);

  return (
    <ExploreAttributesProviderContext.Provider value={attributes}>
      {props.children}
    </ExploreAttributesProviderContext.Provider>
  );
}

export function useExploreAttributes() {
  return useContext(ExploreAttributesProviderContext);
}
