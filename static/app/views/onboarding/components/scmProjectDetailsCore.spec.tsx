import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import * as analytics from 'sentry/utils/analytics';

import {ScmProjectDetailsCore} from './scmProjectDetailsCore';

type CoreProps = React.ComponentProps<typeof ScmProjectDetailsCore>;

function renderCore(overrides: Partial<CoreProps> = {}) {
  const props: CoreProps = {
    analyticsFlow: 'project-creation',
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
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the project name and team fields', () => {
    renderCore();

    expect(screen.getByText('Project name')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('project-name')).toHaveValue('my-project');
  });

  it('fires step_viewed analytics in onboarding on mount', () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    renderCore({analyticsFlow: 'onboarding'});

    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'onboarding.scm_project_details_step_viewed',
      expect.anything()
    );
  });

  it('does not fire step_viewed in project creation (page-viewed fires once upstream)', () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    renderCore({analyticsFlow: 'project-creation'});

    expect(trackAnalyticsSpy).not.toHaveBeenCalledWith(
      'onboarding.scm_project_details_step_viewed',
      expect.anything()
    );
  });

  it('hides the team selector for a no-access member', () => {
    renderCore({isOrgMemberWithNoAccess: true});

    expect(screen.getByText('Project name')).toBeInTheDocument();
    expect(screen.queryByText('Team')).not.toBeInTheDocument();
  });
});
