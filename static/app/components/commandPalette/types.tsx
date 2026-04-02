import type {ReactNode} from 'react';
import type {LocationDescriptor} from 'history';

import type {UseQueryOptions} from 'sentry/utils/queryClient';

interface Action {
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

export interface CommandPaletteActionLink extends Action {
  /** Navigate to a route when selected */
  to: LocationDescriptor;
}

export interface CommandPaletteActionCallback extends Action {
  /**
   * Execute a callback when the action is selected.
   * Use the `to` prop if you want to navigate to a route.
   */
  onAction: () => void;
}

export interface CommandPaletteAsyncAction extends Action {
  /**
   * Execute a callback when the action is selected.
   * Use the `to` prop if you want to navigate to a route.
   */
  resource: (
    query: string
  ) => UseQueryOptions<any, Error, readonly CommandPaletteAction[], any>;
}

export interface CommandPaletteAsyncActionGroup extends Action {
  actions: CommandPaletteAsyncAction[];
  resource: (
    query: string
  ) => UseQueryOptions<any, Error, readonly CommandPaletteAsyncAction[], any>;
}

export type CommandPaletteAction =
  | CommandPaletteActionLink
  | CommandPaletteActionCallback
  | CommandPaletteActionGroup
  | CommandPaletteAsyncAction
  | CommandPaletteAsyncActionGroup;

export interface CommandPaletteActionGroup extends Action {
  /** Nested actions to show when this action is selected */
  actions: CommandPaletteAction[];
}

// Internally, a key is added to the actions in order to track them for registration and selection.
export type CommandPaletteActionLinkWithKey = CommandPaletteActionLink & {key: string};
export type CommandPaletteActionCallbackWithKey = CommandPaletteActionCallback & {
  key: string;
};
export type CommandPaletteAsyncActionWithKey = CommandPaletteAsyncAction & {
  key: string;
};
export type CommandPaletteAsyncActionGroupWithKey = CommandPaletteAsyncActionGroup & {
  key: string;
};
export type CommandPaletteActionWithKey =
  | CommandPaletteActionLinkWithKey
  | CommandPaletteActionCallbackWithKey
  | CommandPaletteActionGroupWithKey
  | CommandPaletteAsyncActionWithKey
  | CommandPaletteAsyncActionGroupWithKey;

export interface CommandPaletteActionGroupWithKey extends CommandPaletteActionGroup {
  actions: Array<
    | CommandPaletteActionLinkWithKey
    | CommandPaletteActionCallbackWithKey
    | CommandPaletteActionGroupWithKey
    | CommandPaletteAsyncActionWithKey
    | CommandPaletteAsyncActionGroupWithKey
  >;
  key: string;
}
