import {createContext, type Dispatch, useContext} from 'react';

import type {QueryBuilderActions} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderState';
import type {
  FilterKeySection,
  FocusOverride,
} from 'sentry/components/searchQueryBuilder/types';
import type {ParseResult} from 'sentry/components/searchSyntax/parser';
import type {SavedSearchType, Tag, TagCollection} from 'sentry/types/group';
import type {FieldDefinition, FieldKind} from 'sentry/utils/fields';

export interface SearchQueryBuilderContextData {
  disabled: boolean;
  disallowFreeText: boolean;
  disallowWildcard: boolean;
  dispatch: Dispatch<QueryBuilderActions>;
  filterKeyMenuWidth: number;
  filterKeySections: FilterKeySection[];
  filterKeys: TagCollection;
  focusOverride: FocusOverride | null;
  getFieldDefinition: (key: string, kind?: FieldKind) => FieldDefinition | null;
  getTagValues: (tag: Tag, query: string) => Promise<string[]>;
  handleSearch: (query: string) => void;
  parsedQuery: ParseResult | null;
  query: string;
  searchSource: string;
  size: 'small' | 'normal';
  wrapperRef: React.RefObject<HTMLDivElement>;
  placeholder?: string;
  recentSearches?: SavedSearchType;
}

export function useSearchQueryBuilder() {
  return useContext(SearchQueryBuilderContext);
}

export const SearchQueryBuilderContext = createContext<SearchQueryBuilderContextData>({
  query: '',
  focusOverride: null,
  filterKeys: {},
  filterKeyMenuWidth: 360,
  filterKeySections: [],
  getFieldDefinition: () => null,
  getTagValues: () => Promise.resolve([]),
  dispatch: () => {},
  parsedQuery: null,
  wrapperRef: {current: null},
  handleSearch: () => {},
  searchSource: '',
  size: 'normal',
  disabled: false,
  disallowFreeText: false,
  disallowWildcard: false,
});
