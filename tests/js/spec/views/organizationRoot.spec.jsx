import {mount} from 'sentry-test/enzyme';

import {OrganizationRoot} from 'app/views/organizationRoot';
import {setActiveProject} from 'app/actionCreators/projects';
import {setLastRoute} from 'app/actionCreators/navigation';

jest.mock('app/actionCreators/projects', () => ({
  setActiveProject: jest.fn(),
}));

jest.mock('app/actionCreators/navigation', () => ({
  setLastRoute: jest.fn(),
}));

describe('OrganizationRoot', function () {
  it('sets active project as null when mounted', function () {
    mount(<OrganizationRoot location={{}}>{null}</OrganizationRoot>);

    expect(setActiveProject).toHaveBeenCalledWith(null);
  });

  it('calls `setLastRoute` when unmounted', function () {
    const wrapper = mount(
      <OrganizationRoot location={{pathname: '/org-slug/dashboard/'}}>
        {null}
      </OrganizationRoot>
    );

    wrapper.unmount();

    expect(setLastRoute).toHaveBeenCalledWith('/org-slug/dashboard/');
  });

  it('calls `setLastRoute` when unmounted with query string', function () {
    const wrapper = mount(
      <OrganizationRoot location={{pathname: '/org-slug/dashboard/', search: '?test=1'}}>
        {null}
      </OrganizationRoot>
    );

    wrapper.unmount();

    expect(setLastRoute).toHaveBeenCalledWith('/org-slug/dashboard/?test=1');
  });
});
