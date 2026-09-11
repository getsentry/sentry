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
  it('labels the project name and team fields', () => {
    renderCore();

    expect(screen.getByRole('textbox', {name: 'Project name'})).toHaveValue('my-project');
    expect(screen.getByRole('textbox', {name: 'Team'})).toBeInTheDocument();
  });

  it('hides the team selector for a no-access member', () => {
    renderCore({isOrgMemberWithNoAccess: true});

    expect(screen.getByRole('textbox', {name: 'Project name'})).toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Team'})).not.toBeInTheDocument();
  });
});
