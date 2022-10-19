import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {addTeamToProject} from 'sentry/actionCreators/projects';
import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';

import {TeamSelector} from './teamSelector';

jest.mock('sentry/actionCreators/projects', () => ({
  addTeamToProject: jest.fn(),
}));

const teamData = [
  {
    id: '1',
    slug: 'team1',
    name: 'Team 1',
  },
  {
    id: '2',
    slug: 'team2',
    name: 'Team 2',
  },
  {
    id: '3',
    slug: 'team3',
    name: 'Team 3',
  },
];
const teams = teamData.map(data => TestStubs.Team(data));
const project = TestStubs.Project({teams: [teams[0]]});
const organization = TestStubs.Organization({access: ['project:write']});
act(() => OrganizationStore.onUpdate(organization, {replace: true}));

function createWrapper(props = {}) {
  return render(
    <TeamSelector
      organization={organization}
      name="teamSelector"
      aria-label="Select a team"
      {...props}
    />
  );
}

describe('Team Selector', function () {
  beforeEach(function () {
    TeamStore.loadInitialData(teams);
  });

  it('renders options', function () {
    createWrapper();
    userEvent.type(screen.getByText('Select...'), '{keyDown}');

    expect(screen.getByText('#team1')).toBeInTheDocument();
    expect(screen.getByText('#team2')).toBeInTheDocument();
    expect(screen.getByText('#team3')).toBeInTheDocument();
  });

  it('selects an option', function () {
    const onChangeMock = jest.fn();
    createWrapper({onChange: onChangeMock});
    userEvent.type(screen.getByText('Select...'), '{keyDown}');

    const option = screen.getByText('#team1');
    userEvent.click(option);
    expect(onChangeMock).toHaveBeenCalledWith(
      expect.objectContaining({value: 'team1'}),
      expect.anything()
    );
  });

  it('respects the team filter', function () {
    const teamFilter = team => team.slug === 'team1';
    createWrapper({teamFilter});

    userEvent.type(screen.getByText('Select...'), '{keyDown}');

    expect(screen.getByText('#team1')).toBeInTheDocument();

    // These options should be filtered out
    expect(screen.queryByText('#team2')).not.toBeInTheDocument();
    expect(screen.queryByText('#team3')).not.toBeInTheDocument();
  });

  it('respects the project filter', function () {
    createWrapper({project});
    userEvent.type(screen.getByText('Select...'), '{keyDown}');

    expect(screen.getByText('#team1')).toBeInTheDocument();

    // team2 and team3 should have add to project buttons
    expect(screen.getAllByRole('button').length).toBe(2);
  });

  it('respects the team and project filter', function () {
    const teamFilter = team => team.slug === 'team1' || team.slug === 'team2';
    createWrapper({teamFilter, project});
    userEvent.type(screen.getByText('Select...'), '{keyDown}');

    expect(screen.getByText('#team1')).toBeInTheDocument();

    // team3 should be filtered out
    expect(screen.queryByText('#team3')).not.toBeInTheDocument();

    // team2 should have add to project buttons
    expect(screen.getAllByRole('button').length).toBe(1);
  });

  it('allows you to add teams outside of project', function () {
    createWrapper({project});
    userEvent.type(screen.getByText('Select...'), '{keyDown}');

    expect(screen.getByText('#team1')).toBeInTheDocument();

    // team2 and team3 should have add to project buttons
    const addToProjectButtons = screen.getAllByRole('button');

    userEvent.click(addToProjectButtons[0]);

    expect(addTeamToProject).toHaveBeenCalled();
  });

  it('allows searching by slug with useId', async function () {
    const onChangeMock = jest.fn();
    createWrapper({useId: true, onChange: onChangeMock});
    userEvent.type(screen.getByText('Select...'), '{keyDown}');

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
    });

    userEvent.type(screen.getByLabelText('Select a team'), 'team2');

    expect(screen.getByText('#team2')).toBeInTheDocument();
    userEvent.click(screen.getByText('#team2'));
    expect(onChangeMock).toHaveBeenCalledWith(
      expect.objectContaining({value: '2'}),
      expect.anything()
    );

    // Wait for store to be updated from API response
    await act(tick);
  });
});
