import type {ReactNode} from 'react';
import type {LocationDescriptor} from 'history';

interface CommonCommandPaletteAction {
  display: {
    /** Primary text shown to the user */
    label: string;
    /** Additional context or description */
    details?: string;
    /** Icon to render for this action */
    icon?: ReactNode;
  };
  /** Optional keywords to improve searchability */
  keywords?: string[];
}

export interface CommandPaletteActionLink extends CommonCommandPaletteAction {
  /** Navigate to a route when selected */
  to: LocationDescriptor;
}

export interface CommandPaletteActionCallback extends CommonCommandPaletteAction {
  /**
   * Execute a callback when the action is selected.
   * Use the `to` prop if you want to navigate to a route.
   */
  onAction: () => void;
}

export type CommandPaletteAction =
  | CommandPaletteActionLink
  | CommandPaletteActionCallback
  | CommandPaletteActionGroup;

export interface CommandPaletteActionGroup extends CommonCommandPaletteAction {
  /** Nested actions to show when this action is selected */
  actions: Array<
    CommandPaletteActionLink | CommandPaletteActionCallback | CommandPaletteActionGroup
  >;
}

// Internally, a key is added to the actions in order to track them for registration and selection.
export type CommandPaletteActionLinkWithKey = CommandPaletteActionLink & {key: string};
export type CommandPaletteActionCallbackWithKey = CommandPaletteActionCallback & {
  key: string;
};
export type CommandPaletteActionWithKey =
  | CommandPaletteActionLinkWithKey
  | CommandPaletteActionCallbackWithKey
  | CommandPaletteActionGroupWithKey;

export interface CommandPaletteActionGroupWithKey extends CommandPaletteActionGroup {
  actions: Array<
    | CommandPaletteActionLinkWithKey
    | CommandPaletteActionCallbackWithKey
    | CommandPaletteActionGroupWithKey
  >;
  key: string;
}
