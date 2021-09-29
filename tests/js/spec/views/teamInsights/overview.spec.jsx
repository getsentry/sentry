import {fireEvent, mountWithTheme, waitFor} from 'sentry-test/reactTestingLibrary';

import localStorage from 'app/utils/localStorage';
import {TeamInsightsOverview} from 'app/views/teamInsights/overview';

jest.mock('app/utils/localStorage');

describe('TeamInsightsOverview', () => {
  const project1 = TestStubs.Project({id: '2', name: 'js', slug: 'js'});
  const project2 = TestStubs.Project({id: '3', name: 'py', slug: 'py'});
  const team1 = TestStubs.Team({id: '2', name: 'frontend', projects: [project1]});
  const team2 = TestStubs.Team({id: '3', name: 'backend', projects: [project2]});
  const mockRouter = {push: jest.fn()};

  beforeEach(() => {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/key-transactions-list/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/legacy-key-transactions-count/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {
          user: 'string',
          transaction: 'string',
          project: 'string',
          tpm: 'number',
          count_unique_user: 'number',
          count_miserable_user: 'number',
          user_misery: 'number',
        },
        data: [
          {
            key_transaction: 1,
            transaction: '/apple/cart',
            project: project1.slug,
            tpm: 30,
            count_unique_user: 1000,
            count_miserable_user: 122,
            user_misery: 0.114,
            project_threshold_config: ['duration', 300],
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/teams/org-slug/${team1.slug}/alerts-triggered/`,
      body: TestStubs.TeamAlertsTriggered(),
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  function createWrapper() {
    const teams = [team1, team2];
    const projects = [project1, project2];
    const organization = TestStubs.Organization({teams, projects});
    const context = TestStubs.routerContext([{organization}]);

    return mountWithTheme(
      <TeamInsightsOverview
        api={new MockApiClient()}
        loadingTeams={false}
        error={null}
        organization={organization}
        teams={teams}
        router={mockRouter}
        location={{}}
      />,
      {
        context,
      }
    );
  }

  it('defaults to first team', async () => {
    const wrapper = createWrapper();
    await waitFor(() => {
      expect(wrapper.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    expect(wrapper.getByText('Team: frontend')).toBeInTheDocument();
    expect(wrapper.getByText('Key transaction')).toBeInTheDocument();
  });

  it('allows team switching', async () => {
    const wrapper = createWrapper();
    await waitFor(() => {
      expect(wrapper.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    fireEvent.click(wrapper.getByText('Team: frontend'));
    expect(wrapper.getByText('backend')).toBeInTheDocument();
    fireEvent.click(wrapper.getByText('backend'));
    expect(mockRouter.push).toHaveBeenCalledWith({query: {team: team2.id}});
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'teamInsightsSelectedTeamId:org-slug',
      team2.id
    );
  });
});
