import {createContext, type Dispatch, useContext} from 'react';

import type {QueryBuilderActions} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderState';
import type {
  FilterKeySection,
  FocusOverride,
} from 'sentry/components/searchQueryBuilder/types';
import type {ParseResult} from 'sentry/components/searchSyntax/parser';
import type {SavedSearchType, Tag, TagCollection} from 'sentry/types/group';

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
  savedSearchType?: SavedSearchType;
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
