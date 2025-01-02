import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import {addTeamToProject} from 'sentry/actionCreators/projects';
import {TeamSelector} from 'sentry/components/teamSelector';
import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';

jest.mock('sentry/actionCreators/projects', () => ({
  addTeamToProject: jest.fn(),
}));
jest.mock('sentry/actionCreators/modal', () => ({
  openCreateTeamModal: jest.fn(),
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
const teams = teamData.map(data => TeamFixture(data));
const project = ProjectFixture({teams: [teams[0]!]});
const organization = OrganizationFixture({access: ['project:write']});
act(() => OrganizationStore.onUpdate(organization, {replace: true}));

function createWrapper(props: Partial<React.ComponentProps<typeof TeamSelector>> = {}) {
  return render(
    <TeamSelector
      organization={organization}
      name="teamSelector"
      aria-label="Select a team"
      onChange={() => {}}
      {...props}
    />
  );
}

describe('Team Selector', function () {
  beforeEach(function () {
    TeamStore.loadInitialData(teams);
  });

  it('renders options', async function () {
    createWrapper();
    await userEvent.type(screen.getByText('Select...'), '{keyDown}');

    expect(screen.getByText('#team1')).toBeInTheDocument();
    expect(screen.getByText('#team2')).toBeInTheDocument();
    expect(screen.getByText('#team3')).toBeInTheDocument();
  });

  it('selects an option', async function () {
    const onChangeMock = jest.fn();
    createWrapper({onChange: onChangeMock});
    await userEvent.type(screen.getByText('Select...'), '{keyDown}');

    const option = screen.getByText('#team1');
    await userEvent.click(option);
    expect(onChangeMock).toHaveBeenCalledWith(expect.objectContaining({value: 'team1'}));
  });

  it('respects the team filter', async function () {
    const teamFilter = team => team.slug === 'team1';
    createWrapper({teamFilter});

    await userEvent.type(screen.getByText('Select...'), '{keyDown}');

    expect(screen.getByText('#team1')).toBeInTheDocument();

    // These options should be filtered out
    expect(screen.queryByText('#team2')).not.toBeInTheDocument();
    expect(screen.queryByText('#team3')).not.toBeInTheDocument();
  });

  it('respects the project filter', async function () {
    createWrapper({project});
    await userEvent.type(screen.getByText('Select...'), '{keyDown}');

    expect(screen.getByText('#team1')).toBeInTheDocument();

    // team2 and team3 should have add to project buttons
    expect(screen.getAllByRole('button').length).toBe(2);
  });

  it('respects the team and project filter', async function () {
    const teamFilter = team => team.slug === 'team1' || team.slug === 'team2';
    createWrapper({teamFilter, project});
    await userEvent.type(screen.getByText('Select...'), '{keyDown}');

    expect(screen.getByText('#team1')).toBeInTheDocument();

    // team3 should be filtered out
    expect(screen.queryByText('#team3')).not.toBeInTheDocument();

    // team2 should have add to project buttons
    expect(screen.getAllByRole('button').length).toBe(1);
  });

  it('allows you to add teams outside of project', async function () {
    createWrapper({project});
    await userEvent.type(screen.getByText('Select...'), '{keyDown}');

    expect(screen.getByText('#team1')).toBeInTheDocument();

    // team2 and team3 should have add to project buttons
    const addToProjectButtons = screen.getAllByRole('button');

    await userEvent.click(addToProjectButtons[0]!);

    expect(addTeamToProject).toHaveBeenCalled();
  });

  it('allows searching by slug with useId', async function () {
    const onChangeMock = jest.fn();
    createWrapper({useId: true, onChange: onChangeMock});
    await userEvent.type(screen.getByText('Select...'), '{keyDown}');

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
    });

    await userEvent.type(screen.getByLabelText('Select a team'), 'team2');

    expect(screen.getByText('#team2')).toBeInTheDocument();
    await userEvent.click(screen.getByText('#team2'));
    expect(onChangeMock).toHaveBeenCalledWith(expect.objectContaining({value: '2'}));

    // Wait for store to be updated from API response
    await act(tick);
  });

  it('allows to create a new team if org admin', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
    });
    const onChangeMock = jest.fn();
    const orgWithAccess = OrganizationFixture({access: ['project:admin']});

    createWrapper({
      allowCreate: true,
      onChange: onChangeMock,
      organization: orgWithAccess,
    });

    await userEvent.type(screen.getByText('Select...'), '{keyDown}');
    await userEvent.click(screen.getByText('Create team'));
    // it opens the create team modal
    expect(openCreateTeamModal).toHaveBeenCalled();
  });

  it('allows to create a new team if org admin (multiple select)', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
    });
    const onChangeMock = jest.fn();
    const orgWithAccess = OrganizationFixture({access: ['project:admin']});

    createWrapper({
      allowCreate: true,
      onChange: onChangeMock,
      organization: orgWithAccess,
    });

    await selectEvent.select(screen.getByText('Select...'), '#team1');
    // it does no open the create team modal yet
    expect(openCreateTeamModal).not.toHaveBeenCalled();

    await selectEvent.select(screen.getByText('#team1'), ['#team2', 'Create team']);
    // it opens the create team modal since the create team option is selected
    expect(openCreateTeamModal).toHaveBeenCalled();
  });

  it('does not allow to create a new team if not org owner', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
    });
    const onChangeMock = jest.fn();
    const orgWithoutAccess = OrganizationFixture({access: ['project:write']});

    createWrapper({
      allowCreate: true,
      onChange: onChangeMock,
      organization: orgWithoutAccess,
    });

    await userEvent.type(screen.getByText('Select...'), '{keyDown}');
    await userEvent.click(screen.getByText('Create team'));
    // it does no open the create team modal
    expect(openCreateTeamModal).not.toHaveBeenCalled();
  });
});
