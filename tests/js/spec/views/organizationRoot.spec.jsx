import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import {setActiveProject} from 'sentry/actionCreators/projects';
import OrganizationRoot from 'sentry/views/organizationRoot';

jest.mock('sentry/actionCreators/projects', () => ({
  setActiveProject: jest.fn(),
}));

describe('OrganizationRoot', function () {
  it('sets active project as null when mounted', function () {
    mountWithTheme(<OrganizationRoot location={{}}>{null}</OrganizationRoot>);

    expect(setActiveProject).toHaveBeenCalledWith(null);
  });
});
