import {createContext, type Dispatch, useContext} from 'react';

import type {
  FilterKeySection,
  FocusOverride,
} from 'sentry/components/searchQueryBuilder/types';
import type {QueryBuilderActions} from 'sentry/components/searchQueryBuilder/useQueryBuilderState';
import type {ParseResult} from 'sentry/components/searchSyntax/parser';
import type {Tag, TagCollection} from 'sentry/types/group';

interface ContextData {
  dispatch: Dispatch<QueryBuilderActions>;
  filterKeySections: FilterKeySection[];
  filterKeys: TagCollection;
  focusOverride: FocusOverride | null;
  getTagValues: (tag: Tag, query: string) => Promise<string[]>;
  handleSearch: (query: string) => void;
  parsedQuery: ParseResult | null;
  query: string;
  searchSource: string;
  size: 'small' | 'normal';
  wrapperRef: React.RefObject<HTMLDivElement>;
}

export function useSearchQueryBuilder() {
  return useContext(SearchQueryBuilerContext);
}

export const SearchQueryBuilerContext = createContext<ContextData>({
  query: '',
  focusOverride: null,
  filterKeys: {},
  filterKeySections: [],
  getTagValues: () => Promise.resolve([]),
  dispatch: () => {},
  parsedQuery: null,
  wrapperRef: {current: null},
  handleSearch: () => {},
  searchSource: '',
  size: 'normal',
});
