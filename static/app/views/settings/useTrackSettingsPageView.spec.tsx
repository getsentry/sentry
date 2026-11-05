import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';

import {useTrackSettingsPageView} from './useTrackSettingsPageView';

jest.mock('sentry/utils/analytics');

describe('useTrackSettingsPageView', () => {
  const organization = OrganizationFixture();

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does not track pages outside of settings', () => {
    renderHookWithProviders(useTrackSettingsPageView, {
      organization,
      initialRouterConfig: {
        location: {pathname: `/organizations/${organization.slug}/issues/`},
      },
    });

    expect(trackAnalytics).not.toHaveBeenCalled();
  });

  it('tracks entering settings from outside and navigating within settings', () => {
    const {router} = renderHookWithProviders(useTrackSettingsPageView, {
      organization,
      initialRouterConfig: {
        location: {pathname: `/organizations/${organization.slug}/issues/`},
      },
    });

    act(() => router.navigate(`/settings/${organization.slug}/projects/foo/`));

    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenLastCalledWith('settings.page_viewed', {
      organization,
      scope: 'project',
      path: expect.any(String),
      from_settings: false,
    });

    act(() => router.navigate('/settings/account/details/'));

    expect(trackAnalytics).toHaveBeenCalledTimes(2);
    expect(trackAnalytics).toHaveBeenLastCalledWith(
      'settings.page_viewed',
      expect.objectContaining({scope: 'account', from_settings: true})
    );
  });

  it('tracks the initial settings page once', () => {
    const {rerender} = renderHookWithProviders(useTrackSettingsPageView, {
      organization,
      initialRouterConfig: {
        location: {pathname: `/settings/${organization.slug}/members/`},
      },
    });

    rerender();

    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'settings.page_viewed',
      expect.objectContaining({scope: 'org', from_settings: false})
    );
  });
});
