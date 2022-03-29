type SearchEventBase = {
  query: string;
  search_type: string;
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
  'organization_saved_search.selected': {
    id: number;
    search_type: string;
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
  'search.display_changed': {};
  'search.operator_autocompleted': SearchEventBase & {search_operator: string};
  'search.searched': SearchEventBase & {search_source?: string};
  'settings_search.open': OpenEvent;
  'settings_search.query': QueryEvent;
  'settings_search.select': SelectEvent;
  'sidebar_help.open': OpenEvent;
  'sidebar_help.query': QueryEvent;
  'sidebar_help.select': SelectEvent;
};

export type SearchEventKey = keyof SearchEventParameters;

export const searchEventMap: Record<SearchEventKey, string | null> = {
  'search.display_changed': 'Search: Changed Display',
  'search.searched': 'Search: Performed search',
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
};
