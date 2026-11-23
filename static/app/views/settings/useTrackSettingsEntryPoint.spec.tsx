import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';

import {useTrackSettingsEntryPoint} from './useTrackSettingsEntryPoint';

jest.mock('sentry/utils/analytics');

function renderAt(pathname: string) {
  return renderHookWithProviders(() => useTrackSettingsEntryPoint('command_palette'), {
    initialRouterConfig: {location: {pathname}},
  });
}

describe('useTrackSettingsEntryPoint', () => {
  beforeEach(() => {
    jest.mocked(trackAnalytics).mockClear();
  });

  it.each([
    ['/settings/org-slug/members/', 'org'],
    ['/settings/org-slug/projects/project-slug/filters/', 'project'],
    ['/settings/projects/project-slug/', 'project'],
    ['/settings/account/details/', 'account'],
    [{pathname: '/settings/org-slug/', hash: '#name'}, 'org'],
  ])('tracks opening %j from outside of settings', (to, scope) => {
    const {result} = renderAt('/organizations/org-slug/issues/');

    result.current(to);

    expect(trackAnalytics).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'settings.entry_point_clicked',
      expect.objectContaining({entry_point: 'command_palette', scope})
    );
  });

  it('does not track moving between settings pages', () => {
    const {result} = renderAt('/settings/org-slug/projects/');

    result.current('/settings/org-slug/projects/project-slug/filters/');

    expect(trackAnalytics).not.toHaveBeenCalled();
  });

  it('does not track destinations outside of settings', () => {
    const {result} = renderAt('/organizations/org-slug/projects/');

    result.current('/organizations/org-slug/issues/');
    result.current('https://docs.sentry.io/settings/');

    expect(trackAnalytics).not.toHaveBeenCalled();
  });
});
