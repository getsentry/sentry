import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {getSettingsScope, useSettingsScope} from './useSettingsScope';

describe('useSettingsScope', () => {
  it.each([
    ['/settings/org-slug/', {scope: 'org', projectSlug: undefined}],
    ['/settings/org-slug/members/', {scope: 'org', projectSlug: undefined}],
    ['/settings/org-slug/projects/', {scope: 'org', projectSlug: undefined}],
    [
      '/settings/org-slug/projects/project-slug/',
      {scope: 'project', projectSlug: 'project-slug'},
    ],
    [
      '/settings/org-slug/projects/project-slug/keys/123/',
      {scope: 'project', projectSlug: 'project-slug'},
    ],
    ['/settings/account/', {scope: 'account', projectSlug: undefined}],
    ['/settings/account/security/', {scope: 'account', projectSlug: undefined}],
    ['/manage/status/mail/', {scope: null, projectSlug: undefined}],
    ['/organizations/org-slug/issues/', {scope: null, projectSlug: undefined}],
  ])('derives the scope for %s', (pathname, expected) => {
    const {result} = renderHookWithProviders(useSettingsScope, {
      initialRouterConfig: {location: {pathname}},
    });

    expect(result.current).toEqual(expected);
  });
});

describe('getSettingsScope', () => {
  it.each([
    ['/settings/org-slug/', 'org'],
    ['/settings/organization/', 'org'],
    ['/settings/org-slug/projects/project-slug/filters/', 'project'],
    ['/settings/projects/project-slug/', 'project'],
    ['/settings/account/details/', 'account'],
    ['/organizations/org-slug/issues/', null],
  ])('derives the scope for %s', (pathname, expected) => {
    expect(getSettingsScope(pathname).scope).toBe(expected);
  });
});
