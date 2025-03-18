import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, renderGlobalModal} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import {RedirectToProjectModal} from 'sentry/components/modals/redirectToProject';

vi.unmock('sentry/utils/recreateRoute');

describe('RedirectToProjectModal', function () {
  vi.useRealTimers();
  vi.useFakeTimers();

  it('has timer to redirect to new slug after mounting', function () {
    const {routerProps} = initializeOrg({
      router: {
        routes: [
          {path: '/', childRoutes: []},
          {name: 'Organizations', path: ':orgId/', childRoutes: []},
          {name: 'Projects', path: ':projectId/', childRoutes: []},
        ],
        params: {orgId: 'org-slug', projectId: 'project-slug'},
      },
    });

    vi.spyOn(window.location, 'assign').mockImplementation(() => {});

    renderGlobalModal();

    act(() =>
      openModal(modalProps => (
        <RedirectToProjectModal {...modalProps} {...routerProps} slug="new-slug" />
      ))
    );

    act(() => vi.advanceTimersByTime(4900));
    expect(window.location.assign).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(200));
    expect(window.location.assign).toHaveBeenCalledTimes(1);
    expect(window.location.assign).toHaveBeenCalledWith('/org-slug/new-slug/');
  });
});
