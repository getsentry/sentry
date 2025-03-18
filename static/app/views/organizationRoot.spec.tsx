import {render} from 'sentry-test/reactTestingLibrary';

import {setActiveProject} from 'sentry/actionCreators/projects';
import OrganizationRoot from 'sentry/views/organizationRoot';

vi.mock('sentry/actionCreators/projects', () => ({
  setActiveProject: vi.fn(),
}));

describe('OrganizationRoot', function () {
  it('sets active project as null when mounted', function () {
    render(<OrganizationRoot>{null}</OrganizationRoot>);

    expect(setActiveProject).toHaveBeenCalledWith(null);
  });
});
