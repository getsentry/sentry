import {createContext, type Dispatch, useContext} from 'react';

import type {
  QueryBuilderFocusState,
  QueryBuilderToken,
} from 'sentry/components/searchQueryBuilder/types';
import type {QueryBuilderActions} from 'sentry/components/searchQueryBuilder/useQueryBuilderState';
import type {Tag, TagCollection} from 'sentry/types';

interface SearchQueryBuilerContext {
  dispatch: Dispatch<QueryBuilderActions>;
  focus: QueryBuilderFocusState | null;
  getTagValues: (tag: Tag, query: string) => Promise<string[]>;
  tags: TagCollection;
  tokens: QueryBuilderToken[];
}

export function useSearchQueryBuilder() {
  return useContext(SearchQueryBuilerContext);
}

export const SearchQueryBuilerContext = createContext<SearchQueryBuilerContext>({
  focus: null,
  tokens: [],
  tags: {},
  getTagValues: () => Promise.resolve([]),
  dispatch: () => {},
});
