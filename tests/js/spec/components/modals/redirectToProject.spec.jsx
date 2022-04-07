import {mountWithTheme} from 'sentry-test/enzyme';

import {RedirectToProjectModal} from 'sentry/components/modals/redirectToProject';

jest.unmock('sentry/utils/recreateRoute');
describe('RedirectToProjectModal', function () {
  jest.useFakeTimers();
  const routes = [
    {path: '/', childRoutes: []},
    {name: 'Organizations', path: ':orgId/', childRoutes: []},
    {name: 'Projects', path: ':projectId/', childRoutes: []},
  ];

  beforeEach(function () {
    jest.spyOn(window.location, 'assign').mockImplementation(() => {});
  });

  afterEach(function () {
    window.location.assign.mockRestore();
  });

  it('has timer to redirect to new slug after mounting', function () {
    mountWithTheme(
      <RedirectToProjectModal
        routes={routes}
        params={{orgId: 'org-slug', projectId: 'project-slug'}}
        slug="new-slug"
        Header={p => p.children}
        Body={p => p.children}
      />
    );

    jest.advanceTimersByTime(4900);
    expect(window.location.assign).not.toHaveBeenCalled();

    jest.advanceTimersByTime(200);
    expect(window.location.assign).toHaveBeenCalledTimes(1);
    expect(window.location.assign).toHaveBeenCalledWith('/org-slug/new-slug/');
  });
});
