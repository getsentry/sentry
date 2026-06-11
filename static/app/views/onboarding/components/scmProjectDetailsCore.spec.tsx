import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import * as analytics from 'sentry/utils/analytics';
import {DEFAULT_ISSUE_ALERT_OPTIONS_VALUES} from 'sentry/views/projectInstall/issueAlertOptions';

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
    alertRuleConfig: DEFAULT_ISSUE_ALERT_OPTIONS_VALUES,
    onAlertChange: jest.fn(),
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

  it('renders the project name, team, and alert-frequency fields', () => {
    renderCore();

    expect(screen.getByText('Give your project a name')).toBeInTheDocument();
    expect(screen.getByText('Assign a team')).toBeInTheDocument();
    expect(screen.getByText('Alert frequency')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('project-name')).toHaveValue('my-project');
  });

  it('fires step_viewed analytics for the given flow on mount', () => {
    const trackAnalyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    renderCore({analyticsFlow: 'project-creation'});

    expect(trackAnalyticsSpy).toHaveBeenCalledWith(
      'project_creation.scm_project_details_step_viewed',
      expect.anything()
    );
  });

  it('hides the team selector for a no-access member', () => {
    renderCore({isOrgMemberWithNoAccess: true});

    expect(screen.getByText('Give your project a name')).toBeInTheDocument();
    expect(screen.queryByText('Assign a team')).not.toBeInTheDocument();
  });
});
