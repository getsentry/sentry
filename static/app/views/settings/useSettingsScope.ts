import {matchPath} from 'react-router';

import {useLocation} from 'sentry/utils/useLocation';

import type {SettingsScope} from './settingsScope';

interface SettingsScopeMatch {
  /**
   * The project slug in the route. Only set for the `project` scope.
   */
  projectSlug: string | undefined;
  scope: SettingsScope | null;
}

/**
 * Which settings scope a pathname belongs to. The scope is null outside of
 * `/settings`, e.g. in the admin pages that reuse the settings navigation.
 */
export function getSettingsScope(pathname: string): SettingsScopeMatch {
  if (!matchPath({path: '/settings', end: false}, pathname)) {
    return {scope: null, projectSlug: undefined};
  }

  if (matchPath({path: '/settings/account', end: false}, pathname)) {
    return {scope: 'account', projectSlug: undefined};
  }

  const projectMatch = matchPath(
    {path: '/settings/:orgId?/projects/:projectId', end: false},
    pathname
  );
  if (projectMatch) {
    return {scope: 'project', projectSlug: projectMatch.params.projectId};
  }

  return {scope: 'org', projectSlug: undefined};
}

/**
 * Which settings scope the current route belongs to. Derived from the pathname
 * only, so the primary rail, the settings header and the secondary sidebar
 * stay aligned.
 */
export function useSettingsScope(): SettingsScopeMatch {
  const {pathname} = useLocation();
  return getSettingsScope(pathname);
}
