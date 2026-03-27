import type {ReactNode} from 'react';
import type {LocationDescriptor} from 'history';

export type CommandPaletteGroupKey = 'navigate' | 'add' | 'help';

interface CommonCommandPaletteAction {
  display: {
    /** Primary text shown to the user */
    label: string;
    /** Additional context or description */
    details?: string;
    /** Icon to render for this action */
    icon?: ReactNode;
  };
  /** Section to group the action in the palette */
  groupingKey?: CommandPaletteGroupKey;
  /** Whether this action should be hidden from the palette */
  hidden?: boolean;

  /** Optional keywords to improve searchability */
  keywords?: string[];
}

export interface CommandPaletteActionLink extends CommonCommandPaletteAction {
  /** Navigate to a route when selected */
  to: LocationDescriptor;
}

export interface CommandPaletteActionCallback extends CommonCommandPaletteAction {
  /** Callback to be executed when the action is selected. */
  onAction: () => void;
}

interface CommandPaletteGroupAction extends CommonCommandPaletteAction {
  /** Actions to show when this action is selected */
  actions: CommandPaletteAction[];
}

export type CommandPaletteAction =
  | CommandPaletteActionLink
  | CommandPaletteActionCallback
  | CommandPaletteGroupAction;

// Internally, a key is added to the actions in order to track them for registration and selection.
// This type should only be used inside the command palette component and should not be exposed to the callers
export type CommandPaletteGroupActionWithKey = Omit<
  CommandPaletteGroupAction,
  'actions'
> & {
  actions: CommandPaletteActionWithKey[];
  key: string;
};

type CommandPaletteActionLinkWithKey = CommandPaletteActionLink & {key: string};
type CommandPaletteActionCallbackWithKey = CommandPaletteActionCallback & {key: string};

export type CommandPaletteActionWithKey =
  | CommandPaletteActionLinkWithKey
  | CommandPaletteActionCallbackWithKey
  | CommandPaletteGroupActionWithKey;
