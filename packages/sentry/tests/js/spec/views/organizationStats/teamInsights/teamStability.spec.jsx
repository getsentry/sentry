import {render, screen} from 'sentry-test/reactTestingLibrary';

import TeamStability from 'sentry/views/organizationStats/teamInsights/teamStability';

describe('TeamStability', () => {
  it('should comparse selected past crash rate with current week', () => {
    const sessionsApi = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/sessions/`,
      body: TestStubs.SessionStatusCountByProjectInPeriod(),
    });
    const project = TestStubs.Project({hasSessions: true, id: 123});
    render(
      <TeamStability
        projects={[project]}
        organization={TestStubs.Organization()}
        period="7d"
      />
    );

    expect(screen.getByText('project-slug')).toBeInTheDocument();
    expect(screen.getAllByText('90%')).toHaveLength(2);
    expect(screen.getByText('0%')).toBeInTheDocument(2);
    expect(sessionsApi).toHaveBeenCalledTimes(3);
  });

  it('should render no sessions', () => {
    const noSessionProject = TestStubs.Project({hasSessions: false, id: 123});
    render(
      <TeamStability
        projects={[noSessionProject]}
        organization={TestStubs.Organization()}
        period="7d"
      />
    );

    expect(screen.getAllByText('\u2014')).toHaveLength(3);
  });

  it('should render no projects', () => {
    render(
      <TeamStability projects={[]} organization={TestStubs.Organization()} period="7d" />
    );

    expect(
      screen.getByText('No projects with release health enabled')
    ).toBeInTheDocument();
  });
});
