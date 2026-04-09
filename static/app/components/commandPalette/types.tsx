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

export type CMDKQueryOptions = UseQueryOptions<any, Error, CommandPaletteAction[], any>;

export interface CommandPaletteActionLink extends Action {
  /** Navigate to a route when selected */
  to: LocationDescriptor;
}

interface CommandPaletteActionCallback extends Action {
  onAction: () => void;
}

export type CommandPaletteAction =
  | CommandPaletteActionLink
  | CommandPaletteActionCallback
  | CommandPaletteActionGroup;

interface CommandPaletteActionGroup extends Action {
  /** Nested actions to show when this action is selected */
  actions: CommandPaletteAction[];
}
