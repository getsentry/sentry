import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import TeamStability from 'app/views/organizationStats/teamInsights/teamStability';

describe('TeamStability', () => {
  it('should comparse selected past crash rate with current week', async () => {
    const sessionsApi = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/sessions/`,
      body: TestStubs.SessionStatusCountByProjectInPeriod(),
    });
    const project = TestStubs.Project({hasSessions: true, id: 123});
    mountWithTheme(
      <TeamStability
        projects={[project]}
        organization={TestStubs.Organization()}
        period="7d"
      />
    );

    expect(screen.getByText('project-slug')).toBeInTheDocument();
    expect(screen.getAllByText('90%')).toHaveLength(2);
    expect(screen.getByText('0%')).toBeInTheDocument(2);
    expect(sessionsApi).toHaveBeenCalledTimes(2);
  });

  it('should render no sessions', async () => {
    const noSessionProject = TestStubs.Project({hasSessions: false, id: 123});
    mountWithTheme(
      <TeamStability
        projects={[noSessionProject]}
        organization={TestStubs.Organization()}
        period="7d"
      />
    );

    expect(screen.getAllByText('\u2014')).toHaveLength(3);
  });

  it('should render no projects', async () => {
    mountWithTheme(
      <TeamStability projects={[]} organization={TestStubs.Organization()} period="7d" />
    );

    expect(screen.getByText('There are no items to display')).toBeInTheDocument();
  });
});
