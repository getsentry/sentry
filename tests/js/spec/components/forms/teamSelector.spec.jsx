import {act, fireEvent, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import {addTeamToProject} from 'app/actionCreators/projects';
import {TeamSelector} from 'app/components/forms/teamSelector';
import OrganizationStore from 'app/stores/organizationStore';
import TeamStore from 'app/stores/teamStore';

jest.mock('app/actionCreators/projects', () => ({
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
  return mountWithTheme(
    <TeamSelector
      organization={organization}
      name="teamSelector"
      aria-label="Select a team"
      {...props}
    />
  );
}

function openSelectMenu() {
  const keyDownEvent = {
    key: 'ArrowDown',
  };

  const placeholder = screen.getByText('Select...');
  fireEvent.keyDown(placeholder, keyDownEvent);
}

describe('Team Selector', function () {
  beforeEach(function () {
    act(() => void TeamStore.loadInitialData(teams));
  });

  it('renders options', function () {
    createWrapper();
    openSelectMenu();

    expect(screen.getByText('#team1')).toBeInTheDocument();
    expect(screen.getByText('#team2')).toBeInTheDocument();
    expect(screen.getByText('#team3')).toBeInTheDocument();
  });

  it('selects an option', function () {
    const onChangeMock = jest.fn();
    createWrapper({onChange: onChangeMock});
    openSelectMenu();

    const option = screen.getByText('#team1');
    fireEvent.click(option);
    expect(onChangeMock).toHaveBeenCalledWith(
      expect.objectContaining({value: 'team1'}),
      expect.anything()
    );
  });

  it('respects the team filter', async function () {
    const teamFilter = team => team.slug === 'team1';
    createWrapper({teamFilter});
    openSelectMenu();

    expect(screen.getByText('#team1')).toBeInTheDocument();

    // These options should be filtered out
    expect(screen.queryByText('#team2')).not.toBeInTheDocument();
    expect(screen.queryByText('#team3')).not.toBeInTheDocument();
  });

  it('respects the project filter', async function () {
    createWrapper({project});
    openSelectMenu();

    expect(screen.getByText('#team1')).toBeInTheDocument();

    // team2 and team3 should have add to project buttons
    expect(screen.getAllByRole('button').length).toBe(2);
  });

  it('respects the team and project filter', async function () {
    const teamFilter = team => team.slug === 'team1' || team.slug === 'team2';
    createWrapper({teamFilter, project});
    openSelectMenu();

    expect(screen.getByText('#team1')).toBeInTheDocument();

    // team3 should be filtered out
    expect(screen.queryByText('#team3')).not.toBeInTheDocument();

    // team2 should have add to project buttons
    expect(screen.getAllByRole('button').length).toBe(1);
  });

  it('allows you to add teams outside of project', async function () {
    createWrapper({project});
    openSelectMenu();

    expect(screen.getByText('#team1')).toBeInTheDocument();

    // team2 and team3 should have add to project buttons
    const addToProjectButtons = screen.getAllByRole('button');

    await act(async () => {
      // add team2 to project
      fireEvent.click(addToProjectButtons[0]);
      await tick();
    });

    expect(addTeamToProject).toHaveBeenCalled();
  });

  it('allows searching by slug with useId', function () {
    const onChangeMock = jest.fn();
    createWrapper({useId: true, onChange: onChangeMock});
    openSelectMenu();

    fireEvent.change(screen.getByLabelText('Select a team'), {
      target: {value: 'team2'},
    });

    expect(screen.getByText('#team2')).toBeInTheDocument();

    fireEvent.click(screen.getByText('#team2'));
    expect(onChangeMock).toHaveBeenCalledWith(
      expect.objectContaining({value: '2'}),
      expect.anything()
    );
  });
});
