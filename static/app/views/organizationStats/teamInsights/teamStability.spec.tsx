import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {SessionStatusCountByProjectInPeriod} from 'sentry-fixture/sessions';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import TeamStability from 'sentry/views/organizationStats/teamInsights/teamStability';

describe('TeamStability', () => {
  let sessionsApi: jest.Mock;
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    sessionsApi = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/sessions/`,
      body: SessionStatusCountByProjectInPeriod(),
    });
  });

  it('should compare selected past crash rate with current week', async () => {
    const project = ProjectFixture({hasSessions: true, id: '123'});
    render(
      <TeamStability projects={[project]} organization={Organization()} period="2w" />
    );

    expect(screen.getByText('project-slug')).toBeInTheDocument();
    expect(await screen.findAllByText('90%')).toHaveLength(2);
    expect(await screen.findByText('0%')).toBeInTheDocument();
    expect(sessionsApi).toHaveBeenCalledTimes(2);
  });

  it('should render no sessions', async () => {
    const noSessionProject = ProjectFixture({hasSessions: false, id: '321'});
    render(
      <TeamStability
        projects={[noSessionProject]}
        organization={Organization()}
        period="7d"
      />
    );

    expect(await screen.findAllByText('\u2014')).toHaveLength(3);
  });

  it('should render no projects', () => {
    render(<TeamStability projects={[]} organization={Organization()} period="7d" />);

    expect(
      screen.getByText('No projects with release health enabled')
    ).toBeInTheDocument();
  });
});
