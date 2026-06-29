import {
  getSpecialPermissions,
  toPermissions,
  toResourcePermissions,
} from 'sentry/utils/consolidatedScopes';

describe('ConsolidatedScopes', () => {
  let scopes: any;

  beforeEach(() => {
    scopes = ['event:read', 'event:admin', 'project:releases', 'org:read', 'org:ci'];
  });

  it('exposes scopes, grouped for each resource', () => {
    expect(toResourcePermissions(scopes)).toEqual(
      expect.objectContaining({
        Event: 'admin',
        Release: 'admin',
        Organization: 'read',
      })
    );
  });

  it('removes org:integrations scopes', () => {
    scopes.push('org:integrations');
    expect(toResourcePermissions(scopes)).toEqual(
      expect.objectContaining({
        Event: 'admin',
        Release: 'admin',
        Organization: 'read',
      })
    );
  });

  it('exposes scopes, grouped by access level', () => {
    expect(toPermissions(scopes)).toEqual({
      admin: expect.arrayContaining(['Event', 'Release']),
      read: ['Organization'],
      write: [],
    });
  });

  it('exposes special permissions separately', () => {
    expect(getSpecialPermissions(scopes)).toEqual([
      expect.objectContaining({
        label: 'Continuous Integration (CI)',
        scope: 'org:ci',
      }),
    ]);
  });
});
