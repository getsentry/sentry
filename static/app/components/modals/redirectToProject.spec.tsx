import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, renderGlobalModal} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import {RedirectToProjectModal} from 'sentry/components/modals/redirectToProject';
import {testableWindowLocation} from 'sentry/utils/testableLocation';

jest.unmock('sentry/utils/recreateRoute');

describe('RedirectToProjectModal', function () {
  it('has timer to redirect to new slug after mounting', function () {
    jest.useFakeTimers();
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

    renderGlobalModal();

    act(() =>
      openModal(modalProps => (
        <RedirectToProjectModal {...modalProps} {...routerProps} slug="new-slug" />
      ))
    );

    act(() => jest.advanceTimersByTime(4900));
    expect(testableWindowLocation.assign).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(200));
    expect(testableWindowLocation.assign).toHaveBeenCalledTimes(1);
    expect(testableWindowLocation.assign).toHaveBeenCalledWith('/org-slug/new-slug/');
  });
});
