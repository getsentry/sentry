import {getSettingsNavItemAnalyticsId} from './settingsNavigationGroup';

describe('getSettingsNavItemAnalyticsId', () => {
  it.each([
    ['/settings/:orgId/projects/:projectId/alerts/', 'alerts'],
    ['/settings/:orgId/projects/:projectId/', 'index'],
    ['/settings/:orgId/projects/:projectId/source-maps/', 'source-maps'],
    ['/settings/account/details/', 'details'],
    ['/settings/account/api/auth-tokens/', 'api-auth-tokens'],
    ['/settings/:orgId/members/', 'members'],
  ])('maps %s to %s', (path, expected) => {
    expect(getSettingsNavItemAnalyticsId(path)).toBe(expected);
  });
});
