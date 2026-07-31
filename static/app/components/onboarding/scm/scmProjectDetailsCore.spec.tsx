import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ScmProjectDetailsCore} from './scmProjectDetailsCore';

type CoreProps = React.ComponentProps<typeof ScmProjectDetailsCore>;

function renderCore(overrides: Partial<CoreProps> = {}) {
  const props: CoreProps = {
    projectName: 'my-project',
    onProjectNameChange: jest.fn(),
    onProjectNameBlur: jest.fn(),
    teamSlug: 'my-team',
    onTeamChange: jest.fn(),
    isOrgMemberWithNoAccess: false,
    ...overrides,
  };

  render(<ScmProjectDetailsCore {...props} />, {organization: OrganizationFixture()});
  return props;
}

describe('ScmProjectDetailsCore', () => {
  it('renders the project name and team fields', () => {
    renderCore();

    expect(screen.getByText('Project name')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('project-name')).toHaveValue('my-project');
  });

  it('hides the team selector for a no-access member', () => {
    renderCore({isOrgMemberWithNoAccess: true});

    expect(screen.getByText('Project name')).toBeInTheDocument();
    expect(screen.queryByText('Team')).not.toBeInTheDocument();
  });
});
