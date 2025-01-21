import groupBy from 'lodash/groupBy';
import invertBy from 'lodash/invertBy';
import pick from 'lodash/pick';

import type {Permissions} from 'sentry/types/integrations';

const PERMISSION_LEVELS = {
  'no-access': 0,
  read: 1,
  write: 2,
  admin: 3,
};

const HUMAN_RESOURCE_NAMES = {
  project: 'Project',
  team: 'Team',
  release: 'Release',
  event: 'Event',
  org: 'Organization',
  member: 'Member',
  alerts: 'Alerts',
};

const DEFAULT_RESOURCE_PERMISSIONS: Permissions = {
  Project: 'no-access',
  Team: 'no-access',
  Release: 'no-access',
  Event: 'no-access',
  Organization: 'no-access',
  Member: 'no-access',
  Alerts: 'no-access',
};

const PROJECT_RELEASES = 'project:releases';
const ORG_INTEGRATIONS = 'org:integrations';

type PermissionLevelResources = {
  admin: string[];
  read: string[];
  write: string[];
};
/**
 * Numerical value of the scope where Admin is higher than Write,
 * which is higher than Read. Used to sort scopes by access.
 */
const permissionLevel = (scope: string): number => {
  const permission = scope.split(':')[1]!;
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return PERMISSION_LEVELS[permission];
};

const compareScopes = (a: string, b: string) => permissionLevel(a) - permissionLevel(b);

const comparePermissionLevels = (a: string, b: string) =>
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  PERMISSION_LEVELS[a] - PERMISSION_LEVELS[b];

/**
 * Return the most permissive scope for each resource.
 *
 * Example:
 *    Given the full list of scopes:
 *      ['project:read', 'project:write', 'team:read', 'team:write', 'team:admin']
 *
 *    this would return:
 *      ['project:write', 'team:admin']
 */
function topScopes(scopeList: string[]) {
  return Object.values(groupBy(scopeList, scope => scope.split(':')[0]))
    .map(scopes => scopes.sort(compareScopes))
    .map(scopes => scopes.pop());
}

/**
 * Convert into a list of Permissions, grouped by resource.
 *
 * This is used in the new/edit Sentry App form. That page displays permissions
 * in a per-Resource manner, meaning one row for Project, one for Organization, etc.
 *
 * This exposes scopes in a way that works for that UI.
 *
 * Example:
 *    {
 *      'Project': 'read',
 *      'Organization': 'write',
 *      'Team': 'no-access',
 *      ...
 *    }
 */
function toResourcePermissions(scopes: string[]): Permissions {
  const permissions = {...DEFAULT_RESOURCE_PERMISSIONS};
  let filteredScopes = [...scopes];
  // The scope for releases is `project:releases`, but instead of displaying
  // it as a permission of Project, we want to separate it out into its own
  // row for Releases.
  if (scopes.includes(PROJECT_RELEASES)) {
    permissions.Release = 'admin';
    filteredScopes = scopes.filter((scope: string) => scope !== PROJECT_RELEASES); // remove project:releases
  }

  // We have a special case with the org:integrations scope. This scope is
  // added when selecting org:admin for hierarchy, but the reverse is not true.
  // It doesn't indicate any specific org permission, so we can remove it
  // entirely.
  filteredScopes = filteredScopes.filter((scope: string) => scope !== ORG_INTEGRATIONS);

  topScopes(filteredScopes).forEach((scope: string | undefined) => {
    if (scope) {
      const [resource, permission] = scope.split(':') as [string, string];
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      permissions[HUMAN_RESOURCE_NAMES[resource]] = permission;
    }
  });

  return permissions;
}

/**
 * Convert into a list of Permissions, grouped by access and including a
 * list of resources per access level.
 *
 * This is used in the Permissions Modal when installing an App. It displays
 * scopes in a per-Permission way, meaning one row for Read, one for Write,
 * and one for Admin.
 *
 * This exposes scopes in a way that works for that UI.
 *
 * Example:
 *    {
 *      read:  ['Project', 'Organization'],
 *      write: ['Member'],
 *      admin: ['Release']
 *    }
 */
function toPermissions(scopes: string[]): PermissionLevelResources {
  const defaultPermissions = {read: [], write: [], admin: []};
  const resourcePermissions = toResourcePermissions(scopes);

  // Filter out the 'no-access' permissions
  const permissions = pick(invertBy(resourcePermissions), ['read', 'write', 'admin']);
  return {...defaultPermissions, ...permissions};
}

export {comparePermissionLevels, toPermissions, toResourcePermissions};
