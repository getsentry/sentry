import {initializeOrg} from 'sentry-test/initializeOrg';
import {renderGlobalModal} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import {RedirectToProjectModal} from 'sentry/components/modals/redirectToProject';

jest.unmock('sentry/utils/recreateRoute');

describe('RedirectToProjectModal', function () {
  jest.useFakeTimers();

  it('has timer to redirect to new slug after mounting', function () {
    const {router} = initializeOrg({
      ...initializeOrg(),
      router: {
        ...initializeOrg().router,
        routes: [
          {path: '/', childRoutes: []},
          {name: 'Organizations', path: ':orgId/', childRoutes: []},
          {name: 'Projects', path: ':projectId/', childRoutes: []},
        ],
      },
    });

    jest.spyOn(window.location, 'assign').mockImplementation(() => {});

    renderGlobalModal();

    openModal(modalProps => (
      <RedirectToProjectModal
        {...modalProps}
        routes={router.routes}
        router={router}
        location={router.location}
        slug="new-slug"
        params={{orgId: 'org-slug', projectId: 'project-slug'}}
      />
    ));

    jest.advanceTimersByTime(4900);
    expect(window.location.assign).not.toHaveBeenCalled();

    jest.advanceTimersByTime(200);
    expect(window.location.assign).toHaveBeenCalledTimes(1);
    expect(window.location.assign).toHaveBeenCalledWith('/org-slug/new-slug/');
  });
});
