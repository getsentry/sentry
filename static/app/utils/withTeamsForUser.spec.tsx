import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import withTeamsForUser from 'sentry/utils/withTeamsForUser';

describe('withUserTeams HoC', function () {
  const api = new MockApiClient();
  const organization = Organization();

  function Output({error, teams}) {
    if (error) {
      return <p>Error: {error.responseText}</p>;
    }
    return (
      <p>
        {teams.map(team => (
          <span key={team.slug}>{team.slug}</span>
        ))}
      </p>
    );
  }

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    jest.spyOn(ProjectsStore, 'loadInitialData');
    jest.spyOn(TeamStore, 'loadInitialData');
  });

  it('forwards errors', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/user-teams/`,
      statusCode: 400,
    });
    const Container = withTeamsForUser(Output);
    render(<Container organization={organization} api={api} />);
    expect(await screen.findByText(/Error:/)).toBeInTheDocument();
  });

  it('fetches teams and loads stores', async function () {
    const mockProjectA = ProjectFixture({slug: 'a', id: '1'});
    const mockProjectB = ProjectFixture({slug: 'b', id: '2'});
    const mockTeams = [
      {
        slug: 'sentry',
        projects: [mockProjectB],
      },
      {
        slug: 'captainplanet',
        projects: [mockProjectA, mockProjectB],
      },
    ];

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/user-teams/`,
      body: mockTeams,
    });

    const Container = withTeamsForUser(Output);
    render(<Container organization={organization} api={api} />);
    expect(await screen.findByText('sentry')).toBeInTheDocument();
    expect(screen.getByText('captainplanet')).toBeInTheDocument();
  });
});
