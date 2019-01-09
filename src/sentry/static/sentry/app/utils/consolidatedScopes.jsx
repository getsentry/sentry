import {pull, groupBy} from 'lodash';

const PERMISSION_LEVELS = {
  read: 0,
  write: 1,
  admin: 2,
};

const HUMAN_RESOURCE_NAMES = {
  project: 'Project',
  team: 'Team',
  release: 'Release',
  event: 'Event',
  org: 'Organization',
  member: 'Member',
};

const PROJECT_RELEASES = 'project:releases';

export default class ConsolidatedScopes {
  constructor(scopes) {
    this.scopes = scopes;
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
  toResourcePermissions() {
    let scopes = [...this.scopes];
    let permissions = this.defaultResourcePermissions;

    // The scope for releases is `project:releases`, but instead of displaying
    // it as a permission of Project, we want to separate it out into its own
    // row for Releases.
    if (scopes.includes(PROJECT_RELEASES)) {
      permissions.Release = 'admin';
      pull(scopes, PROJECT_RELEASES); // remove project:releases
    }

    this.topScopes(scopes).forEach(scope => {
      let [resource, permission] = scope.split(':');
      permissions[HUMAN_RESOURCE_NAMES[resource]] = permission;
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
  toPermissions() {
    let scopes = [...this.scopes];
    let permissions = {read: [], write: [], admin: []};

    // The scope for releases is `project:releases`, but instead of displaying
    // it as a permission of Project, we want to separate it out into its own
    // row for Releases.
    if (scopes.includes(PROJECT_RELEASES)) {
      permissions.admin.push('Release');
      pull(scopes, PROJECT_RELEASES); // remove project:releases
    }

    this.topScopes(scopes).forEach(scope => {
      let [resource, permission] = scope.split(':');
      permissions[permission].push(HUMAN_RESOURCE_NAMES[resource]);
    });

    return permissions;
  }

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
  topScopes(scopeList) {
    return Object.values(groupBy(scopeList, scope => scope.split(':')[0]))
      .map(scopes => scopes.sort(this.compareScopes))
      .map(scopes => scopes.pop());
  }

  compareScopes = (a, b) => {
    return this.permissionLevel(a) - this.permissionLevel(b);
  };

  /**
   * Numerical value of the scope where Admin is higher than Write,
   * which is higher than Read. Used to sort scopes by access.
   */
  permissionLevel = scope => {
    let permission = scope.split(':')[1];
    return PERMISSION_LEVELS[permission];
  };

  get defaultResourcePermissions() {
    return {
      Project: 'no-access',
      Team: 'no-access',
      Release: 'no-access',
      Event: 'no-access',
      Organization: 'no-access',
      Member: 'no-access',
    };
  }
}
