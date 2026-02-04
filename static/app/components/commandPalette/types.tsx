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
  type: 'navigate';
}

export interface CommandPaletteActionCallback extends CommonCommandPaletteAction {
  /**
   * Execute a callback when the action is selected.
   * Use the `to` prop if you want to navigate to a route.
   */
  onAction: () => void;
  type: 'callback';
}

export type CommandPaletteActionChild =
  | CommandPaletteActionCallback
  | CommandPaletteActionLink;

export interface CommandPaletteActionGroup<
  T = CommandPaletteActionChild,
> extends CommonCommandPaletteAction {
  /** Nested actions to show when this action is selected */
  actions: T[];
  type: 'group';
}

export type CommandPaletteAction =
  | CommandPaletteActionLink
  | CommandPaletteActionCallback
  | CommandPaletteActionGroup;

// Internally, a key is added to the actions in order to track them for registration and selection.
export type CommandPaletteActionLinkWithKey = CommandPaletteActionLink & {key: string};
export type CommandPaletteActionCallbackWithKey = CommandPaletteActionCallback & {
  key: string;
};
type CommandPaletteActionGroupWithKey<T> = CommandPaletteActionGroup<T> & {
  key: string;
};
export type CommandPaletteActionWithKey =
  | CommandPaletteActionLinkWithKey
  | CommandPaletteActionCallbackWithKey
  | CommandPaletteActionGroupWithKey<
      CommandPaletteActionLinkWithKey | CommandPaletteActionCallbackWithKey
    >;
