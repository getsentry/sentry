type CommandPaletteOpenedEvent = {
  /** How the command palette was opened */
  source: 'button' | 'keyboard';
};

type CommandPaletteActionSelectedEvent = {
  /** The label of the selected action, serialized by the caller */
  action: string;
  /** The search query that led to the action being selected */
  query: string;
};

type CommandPaletteNoResultsEvent = {
  /** The selected group action label if the empty state occurred inside a group, undefined otherwise */
  action: string | undefined;
  /** The search query that produced no results */
  query: string;
};

export type CommandPaletteEventParameters = {
  'command_palette.action_selected': CommandPaletteActionSelectedEvent;
  'command_palette.no_results': CommandPaletteNoResultsEvent;
  'command_palette.opened': CommandPaletteOpenedEvent;
};

type CommandPaletteEventKey = keyof CommandPaletteEventParameters;

export const commandPaletteEventMap: Record<CommandPaletteEventKey, string> = {
  'command_palette.opened': 'Command Palette: Opened',
  'command_palette.action_selected': 'Command Palette: Action Selected',
  'command_palette.no_results': 'Command Palette: No Results',
};
