import type {ShortcutType} from 'sentry/components/deprecatedSmartSearchBar/types';

type SearchEventBase = {
  query: string;
  search_type: string;
  is_multi_project?: boolean;
  new_experience?: boolean;
  search_source?: string;
};

type OpenEvent = {};
type SelectEvent = {result_type: string; source_type: string; query?: string};
type QueryEvent = {query: string};
type ProjectSelectorEvent = {path: string};

export type SearchEventParameters = {
  'command_palette.open': OpenEvent;
  'command_palette.query': QueryEvent;
  'command_palette.select': SelectEvent;
  'omnisearch.open': {};
  'organization_saved_search.selected': {
    id: number;
    is_global: boolean;
    query: string;
    search_type: string;
    visibility: string;
  };
  'projectselector.clear': ProjectSelectorEvent;
  'projectselector.direct_selection': ProjectSelectorEvent;
  'projectselector.multi_button_clicked': ProjectSelectorEvent & {
    button_type: 'all' | 'my';
  };
  'projectselector.toggle': ProjectSelectorEvent & {
    action: 'added' | 'removed';
  };
  'projectselector.update': ProjectSelectorEvent & {
    count: number;
    multi: boolean;
  };
  'search.docs_opened': SearchEventBase;
  'search.invalid_field': Omit<SearchEventBase, 'query'> & {attempted_field_name: string};
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
  'search.operator_autocompleted': SearchEventBase & {
    search_operator: string;
    filter_key?: string;
  };
  'search.pin': {
    action: 'pin' | 'unpin';
    search_type: string;
    query?: string;
    sort?: string;
  };
  'search.saved_search_create': {
    name: string;
    query: string;
    search_type: string;
    sort: string;
    visibility: string;
  };
  'search.saved_search_open_create_modal': OpenEvent;
  'search.saved_search_sidebar_toggle_clicked': {open: boolean};
  'search.search_with_invalid': SearchEventBase;
  'search.searched': SearchEventBase;
  'search.searched_filter': SearchEventBase & {
    key: string;
    values: string[];
  };
  'search.shortcut_used': SearchEventBase & {
    shortcut_method: 'hotkey' | 'click';
    shortcut_type: ShortcutType;
  };
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
  'settings_search.open': OpenEvent;
  'settings_search.query': QueryEvent;
  'settings_search.select': SelectEvent;
  'sidebar_help.open': OpenEvent;
  'sidebar_help.query': QueryEvent;
  'sidebar_help.select': SelectEvent;
};

export type SearchEventKey = keyof SearchEventParameters;

export const searchEventMap: Record<SearchEventKey, string | null> = {
  'search.searched': 'Search: Performed search',
  'search.searched_filter': 'Search: Performed search filter',
  'search.key_autocompleted': 'Search: Key Autocompleted',
  'search.key_manually_typed': 'Search: Key Manually Typed',
  'search.shortcut_used': 'Search: Shortcut Used',
  'search.docs_opened': 'Search: Docs Opened',
  'search.search_with_invalid': 'Search: Attempted Invalid Search',
  'search.invalid_field': 'Search: Unsupported Field Warning Shown',
  'search.operator_autocompleted': 'Search: Operator Autocompleted',
  'organization_saved_search.selected':
    'Organization Saved Search: Selected saved search',
  'settings_search.open': 'settings_search Open',
  'command_palette.open': 'command_palette Open',
  'sidebar_help.open': 'sidebar_help Open',
  'settings_search.select': 'settings_search Select',
  'command_palette.select': 'command_palette Select',
  'sidebar_help.select': 'sidebar_help Select',
  'settings_search.query': 'settings_search Query',
  'command_palette.query': 'command_palette Query',
  'sidebar_help.query': 'sidebar_help Query',
  'projectselector.direct_selection': 'Project Selector: Direct Selection',
  'projectselector.update': 'Project Selector: Update',
  'projectselector.clear': 'Project Selector: Clear',
  'projectselector.toggle': 'Project Selector: Toggle',
  'projectselector.multi_button_clicked': 'Project Selector: Multi Button Clicked',
  'search.pin': 'Search: Pin',
  'search.saved_search_create': 'Search: Saved Search Created',
  'search.saved_search_open_create_modal': 'Search: Saved Search Modal Opened',
  'search.value_autocompleted': 'Search: Filter Value Autocompleted',
  'search.value_manual_submitted': 'Search: Filter Value Submitted Manually',
  'search.saved_search_sidebar_toggle_clicked':
    'Search: Saved Search Sidebar Toggle Clicked',
  'omnisearch.open': 'Omnisearch: Open',
};
