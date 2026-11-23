type SearchEventBase = {
  query: string;
  search_type: string;
  is_multi_project?: boolean;
  new_experience?: boolean;
  search_source?: string;
};

type ProjectSelectorEvent = {path: string};

export type SearchEventParameters = {
  'projectselector.apply': ProjectSelectorEvent & {count: number; multi: boolean};
  'projectselector.cancel': ProjectSelectorEvent;
  'projectselector.clear': ProjectSelectorEvent;
  'projectselector.direct_selection': ProjectSelectorEvent;
  'projectselector.toggle': ProjectSelectorEvent & {action: 'added' | 'removed'};
  'projectselector.update': ProjectSelectorEvent & {count: number; multi: boolean};
  'search.docs_opened': SearchEventBase;
  'search.key_autocompleted': Omit<SearchEventBase, 'query'> & {
    item_name: string | undefined;
    filtered?: boolean;
    item_kind?: string;
    item_type?: string;
    item_value_type?: string;
    search_operator?: string;
  };
  'search.key_manually_typed': Omit<SearchEventBase, 'query'> & {
    item_kind: string;
    item_name: string;
    item_value_type: string;
  };
  'search.multi_value_selected': Omit<SearchEventBase, 'query'> & {
    filter_key: string;
    filter_operator: string;
    filter_value_type: string;
    selected: boolean;
    selected_count: number;
  };
  'search.operator_autocompleted': SearchEventBase & {
    search_operator: string;
    filter_key?: string;
  };
  'search.search_with_invalid': SearchEventBase;
  'search.searched': SearchEventBase;
  'search.searched_filter': SearchEventBase & {key: string; values: string[]};
  'search.value_autocompleted': Omit<SearchEventBase, 'query'> & {
    filter_key: string;
    filter_operator: string;
    filter_value: string;
    filter_value_type: string;
  };
  'search.value_manual_submitted': Omit<SearchEventBase, 'query'> & {
    filter_key: string;
    filter_operator: string;
    filter_value: string;
    filter_value_type: string;
    invalid: boolean;
  };
};

type SearchEventKey = keyof SearchEventParameters;

export const searchEventMap: Record<SearchEventKey, string | null> = {
  'search.searched': 'Search: Performed search',
  'search.searched_filter': 'Search: Performed search filter',
  'search.key_autocompleted': 'Search: Key Autocompleted',
  'search.key_manually_typed': 'Search: Key Manually Typed',
  'search.multi_value_selected': 'Search: Multi-Select Value Toggled',
  'search.docs_opened': 'Search: Docs Opened',
  'search.search_with_invalid': 'Search: Attempted Invalid Search',
  'search.operator_autocompleted': 'Search: Operator Autocompleted',
  'projectselector.apply': 'Project Selector: Applied',
  'projectselector.cancel': 'Project Selector: Cancelled',
  'projectselector.direct_selection': 'Project Selector: Direct Selection',
  'projectselector.update': 'Project Selector: Update',
  'projectselector.clear': 'Project Selector: Clear',
  'projectselector.toggle': 'Project Selector: Toggle',
  'search.value_autocompleted': 'Search: Filter Value Autocompleted',
  'search.value_manual_submitted': 'Search: Filter Value Submitted Manually',
};
