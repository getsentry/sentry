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

/**
 * Actions that can be returned from an async resource query.
 * Async results cannot themselves carry a `resource` — chained async lookups
 * are not supported. Use CommandPaletteAction for registering top-level actions.
 */
interface CommandPaletteAsyncResultGroup extends Action {
  actions: CommandPaletteAsyncResult[];
}

export type CommandPaletteAsyncResult =
  | CommandPaletteActionLink
  | CommandPaletteActionCallback
  | CommandPaletteAsyncResultGroup;

export type CMDKQueryOptions = UseQueryOptions<
  any,
  Error,
  CommandPaletteAsyncResult[],
  any
>;

export interface CommandPaletteActionLink extends Action {
  /** Navigate to a route when selected */
  to: LocationDescriptor;
}

interface CommandPaletteActionCallback extends Action {
  /**
   * Execute a callback when the action is selected.
   * Use the `to` prop if you want to navigate to a route.
   */
  onAction: () => void;
}

interface CommandPaletteAsyncAction extends Action {
  /**
   * Execute a callback when the action is selected.
   * Use the `to` prop if you want to navigate to a route.
   */
  resource: (query: string) => CMDKQueryOptions;
}

interface CommandPaletteAsyncActionGroup extends Action {
  actions: CommandPaletteAction[];
  resource: (query: string) => CMDKQueryOptions;
}

export type CommandPaletteAction =
  | CommandPaletteActionLink
  | CommandPaletteActionCallback
  | CommandPaletteActionGroup
  | CommandPaletteAsyncAction
  | CommandPaletteAsyncActionGroup;

interface CommandPaletteActionGroup extends Action {
  /** Nested actions to show when this action is selected */
  actions: CommandPaletteAction[];
}

// Internally, a key is added to the actions in order to track them for registration and selection.
type CommandPaletteActionLinkWithKey = CommandPaletteActionLink & {key: string};
type CommandPaletteActionCallbackWithKey = CommandPaletteActionCallback & {
  key: string;
};
type CommandPaletteAsyncActionWithKey = CommandPaletteAsyncAction & {
  key: string;
};
type CommandPaletteAsyncActionGroupWithKey = Omit<
  CommandPaletteAsyncActionGroup,
  'actions'
> & {
  actions: CommandPaletteActionWithKey[];
  key: string;
};

export type CommandPaletteActionWithKey =
  // Sync actions (to, callback, group)
  | CommandPaletteActionLinkWithKey
  | CommandPaletteActionCallbackWithKey
  | CommandPaletteActionGroupWithKey
  // Async actions
  | CommandPaletteAsyncActionWithKey
  | CommandPaletteAsyncActionGroupWithKey;

interface CommandPaletteActionGroupWithKey extends CommandPaletteActionGroup {
  actions: Array<
    | CommandPaletteActionLinkWithKey
    | CommandPaletteActionCallbackWithKey
    | CommandPaletteActionGroupWithKey
    | CommandPaletteAsyncActionWithKey
    | CommandPaletteAsyncActionGroupWithKey
  >;
  key: string;
}
