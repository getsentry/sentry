import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import NewProject from 'sentry/views/projectInstall/newProject';

jest.mock('sentry/views/projectInstall/createProject', () => ({
  CreateProject: () => <div>Legacy project creation</div>,
}));

jest.mock('sentry/views/projectInstall/scmCreateProject', () => ({
  ScmCreateProject: () => <div>SCM project creation</div>,
}));

describe('NewProject', () => {
  it('renders the legacy flow when SCM project creation is disabled', () => {
    render(<NewProject />, {organization: OrganizationFixture({features: []})});

    expect(screen.getByText('Legacy project creation')).toBeInTheDocument();
    expect(screen.queryByText('SCM project creation')).not.toBeInTheDocument();
  });

  it('renders the SCM flow when SCM project creation is enabled', () => {
    render(<NewProject />, {
      organization: OrganizationFixture({
        features: ['onboarding-scm-project-creation'],
      }),
    });

    expect(screen.getByText('SCM project creation')).toBeInTheDocument();
    expect(screen.queryByText('Legacy project creation')).not.toBeInTheDocument();
  });
});
