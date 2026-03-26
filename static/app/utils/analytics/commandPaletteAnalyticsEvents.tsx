type CommandPaletteOpenedEvent = {
  /** Session ID to correlate with other events in the same session */
  session_id: string;
  /** How the command palette was opened */
  source: 'button' | 'keyboard';
};

type CommandPaletteClosedEvent = {
  /** Whether the user interacted (typed a query or selected an action) before closing */
  had_interaction: boolean;
  /** How the palette was closed */
  method:
    | 'escape'
    | 'backdrop_click'
    | 'keyboard_toggle'
    | 'action_selected'
    | 'route_change';
  /** The search query at time of close */
  query: string;
  /** Session ID */
  session_id: string;
};

type CommandPaletteActionSelectedEvent = {
  /** The label of the selected action, serialized by the caller */
  action: string;
  /** The type of action selected */
  action_type: 'navigate' | 'callback' | 'group';
  /** The grouping section the action was in (e.g. 'navigate', 'add', 'help') */
  group: string;
  /** The search query that led to the action being selected */
  query: string;
  /** Position of the selected action in the results list (0-indexed) */
  result_index: number;
  /** Session ID */
  session_id: string;
};

type CommandPaletteSearchedEvent = {
  /** The search query */
  query: string;
  /** Number of results returned for the query */
  result_count: number;
  /** Session ID */
  session_id: string;
};

type CommandPaletteNoResultsEvent = {
  /** The selected group action label if the empty state occurred inside a group, undefined otherwise */
  action: string | undefined;
  /** The search query that produced no results */
  query: string;
  /** Session ID */
  session_id: string;
};

type CommandPaletteSessionEvent = {
  /** Number of actions selected (including group drills) */
  actions_selected: number;
  /** Whether the session ended with a final action (navigate/callback) */
  completed: boolean;
  /** Total time the palette was open in ms */
  duration_ms: number;
  /** Deepest level of group navigation (0 = no drill, 1 = drilled once, etc.) */
  max_drill_depth: number;
  /** Number of search queries typed */
  queries_typed: number;
  /** Session ID */
  session_id: string;
};

export type CommandPaletteEventParameters = {
  'command_palette.action_selected': CommandPaletteActionSelectedEvent;
  'command_palette.closed': CommandPaletteClosedEvent;
  'command_palette.no_results': CommandPaletteNoResultsEvent;
  'command_palette.opened': CommandPaletteOpenedEvent;
  'command_palette.searched': CommandPaletteSearchedEvent;
  'command_palette.session': CommandPaletteSessionEvent;
};

type CommandPaletteEventKey = keyof CommandPaletteEventParameters;

export const commandPaletteEventMap: Record<CommandPaletteEventKey, string> = {
  'command_palette.opened': 'Command Palette: Opened',
  'command_palette.closed': 'Command Palette: Closed',
  'command_palette.action_selected': 'Command Palette: Action Selected',
  'command_palette.searched': 'Command Palette: Searched',
  'command_palette.no_results': 'Command Palette: No Results',
  'command_palette.session': 'Command Palette: Session',
};
