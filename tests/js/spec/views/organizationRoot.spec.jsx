import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import {setLastRoute} from 'sentry/actionCreators/navigation';
import {setActiveProject} from 'sentry/actionCreators/projects';
import OrganizationRoot from 'sentry/views/organizationRoot';

jest.mock('sentry/actionCreators/projects', () => ({
  setActiveProject: jest.fn(),
}));

jest.mock('sentry/actionCreators/navigation', () => ({
  setLastRoute: jest.fn(),
}));

describe('OrganizationRoot', function () {
  it('sets active project as null when mounted', function () {
    mountWithTheme(<OrganizationRoot location={{}}>{null}</OrganizationRoot>);

    expect(setActiveProject).toHaveBeenCalledWith(null);
  });

  it('calls `setLastRoute` when unmounted', function () {
    const {unmount} = mountWithTheme(
      <OrganizationRoot location={{pathname: '/org-slug/dashboard/'}}>
        {null}
      </OrganizationRoot>
    );

    unmount();

    expect(setLastRoute).toHaveBeenCalledWith('/org-slug/dashboard/');
  });

  it('calls `setLastRoute` when unmounted with query string', function () {
    const {unmount} = mountWithTheme(
      <OrganizationRoot location={{pathname: '/org-slug/dashboard/', search: '?test=1'}}>
        {null}
      </OrganizationRoot>
    );

    unmount();

    expect(setLastRoute).toHaveBeenCalledWith('/org-slug/dashboard/?test=1');
  });
});
