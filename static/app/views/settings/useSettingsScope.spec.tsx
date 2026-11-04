import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useSettingsScope} from 'sentry/views/settings/useSettingsScope';

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
