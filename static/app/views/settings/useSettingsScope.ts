import {matchPath} from 'react-router';

import {useLocation} from 'sentry/utils/useLocation';

export type SettingsScope = 'account' | 'org' | 'project';

/**
 * Which settings scope the current route belongs to. Derived from the pathname
 * only, so the primary rail, the settings header and the secondary sidebar
 * stay aligned. The scope is null outside of `/settings`, e.g. in the admin
 * pages that reuse the settings navigation.
 */
export function useSettingsScope(): {
  /**
   * The project slug in the route. Only set for the `project` scope.
   */
  projectSlug: string | undefined;
  scope: SettingsScope | null;
} {
  const {pathname} = useLocation();

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
