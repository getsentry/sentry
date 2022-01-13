interface SearchEventBase {
  query: string;
  search_type: string;
  search_source?: string;
}

export interface SearchEventParameters {
  'search.searched': SearchEventBase & {search_source?: string};
  'search.operator_autocompleted': SearchEventBase & {search_operator: string};
  'organization_saved_search.selected': {
    search_type: string;
    id: number;
  };
}

export type SearchEventKey = keyof SearchEventParameters;

export const searchEventMap: Record<SearchEventKey, string | null> = {
  'search.searched': 'Search: Performed search',
  'search.operator_autocompleted': 'Search: Operator Autocompleted',
  'organization_saved_search.selected':
    'Organization Saved Search: Selected saved search',
};
