import {createContext, type Dispatch, useContext} from 'react';

import type {QueryBuilderFocusState} from 'sentry/components/searchQueryBuilder/types';
import type {QueryBuilderActions} from 'sentry/components/searchQueryBuilder/useQueryBuilderState';
import type {ParseResult} from 'sentry/components/searchSyntax/parser';
import type {Tag, TagCollection} from 'sentry/types';

interface SearchQueryBuilerContext {
  dispatch: Dispatch<QueryBuilderActions>;
  focus: QueryBuilderFocusState | null;
  getTagValues: (tag: Tag, query: string) => Promise<string[]>;
  parsedQuery: ParseResult | null;
  query: string;
  tags: TagCollection;
}

export function useSearchQueryBuilder() {
  return useContext(SearchQueryBuilerContext);
}

export const SearchQueryBuilerContext = createContext<SearchQueryBuilerContext>({
  focus: null,
  query: '',
  tags: {},
  getTagValues: () => Promise.resolve([]),
  dispatch: () => {},
  parsedQuery: null,
});
