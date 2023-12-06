import {toPermissions, toResourcePermissions} from 'sentry/utils/consolidatedScopes';

describe('ConsolidatedScopes', () => {
  let scopes;

  beforeEach(() => {
    scopes = ['event:read', 'event:admin', 'project:releases', 'org:read'];
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
});
