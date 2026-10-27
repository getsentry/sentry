import {useMatches} from 'react-router';

import type {SettingsRouteHandle} from 'sentry/views/settings/types';

export const SETTINGS_PROJECT_ROOT = '/settings/:orgId/projects/:projectId/';

/**
 * The URL template of the current page under a project, for switching
 * projects without leaving the page. Taken from the deepest matched route
 * that declares `settingsProject`, or undefined if none does.
 */
export function useSettingsProjectPageTemplate(): string | undefined {
  const page = useMatches()
    .flatMap(
      match => (match.handle as SettingsRouteHandle | undefined)?.settingsProject ?? []
    )
    .findLast(Boolean)?.page;

  return page === undefined ? undefined : `${SETTINGS_PROJECT_ROOT}${page}`;
}
