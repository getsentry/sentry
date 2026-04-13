import type {ReactNode} from 'react';
import type {LocationDescriptor} from 'history';

import {queryOptions} from 'sentry/utils/queryClient';
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

export type CMDKQueryOptions = Omit<
  UseQueryOptions<any, Error, CommandPaletteAction[], any>,
  'meta'
> & {
  meta: {[key: string]: unknown; cmdk: true};
};

/**
 * Wraps a query options object and injects the cmdk meta marker required for
 * the command palette loading indicator to track this query via useIsFetching.
 * All resource functions passed to CMDKAction must use this helper.
 */
export function cmdkQueryOptions(
  options: Omit<CMDKQueryOptions, 'meta'>
): CMDKQueryOptions {
  return queryOptions({...options, meta: {cmdk: true}}) as CMDKQueryOptions;
}

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
