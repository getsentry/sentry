import {act, fireEvent, mountWithTheme} from 'sentry-test/reactTestingLibrary';

import {addTeamToProject} from 'app/actionCreators/projects';
import {TeamSelector} from 'app/components/forms/teamSelector';
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

function createWrapper(props = {}) {
  return mountWithTheme(
    <TeamSelector organization={organization} name="teamSelector" {...props} />
  );
}

function openSelectMenu(wrapper) {
  const keyDownEvent = {
    key: 'ArrowDown',
  };

  const placeholder = wrapper.getByText('Select...');
  fireEvent.keyDown(placeholder, keyDownEvent);
}

describe('Team Selector', function () {
  beforeEach(function () {
    act(() => void TeamStore.loadInitialData(teams));
  });

  it('renders options', function () {
    const wrapper = createWrapper();
    openSelectMenu(wrapper);

    expect(wrapper.getByText('#team1')).toBeTruthy();
    expect(wrapper.getByText('#team2')).toBeTruthy();
    expect(wrapper.getByText('#team3')).toBeTruthy();
  });

  it('selects an option', function () {
    const onChangeMock = jest.fn();
    const wrapper = createWrapper({onChange: onChangeMock});
    openSelectMenu(wrapper);

    const option = wrapper.getByText('#team1');
    fireEvent.click(option);
    expect(onChangeMock).toHaveBeenCalled();
  });

  it('respects the team filter', async function () {
    const teamFilter = team => team.slug === 'team1';
    const wrapper = createWrapper({teamFilter});
    openSelectMenu(wrapper);

    expect(wrapper.getByText('#team1')).toBeTruthy();

    // These options should be filtered out
    expect(wrapper.queryByText('#team2')).toBeFalsy();
    expect(wrapper.queryByText('#team3')).toBeFalsy();
  });

  it('respects the project filter', async function () {
    const wrapper = createWrapper({project});
    openSelectMenu(wrapper);

    expect(wrapper.getByText('#team1')).toBeTruthy();

    // team2 and team3 should have add to project buttons
    expect(wrapper.getAllByRole('button').length).toBe(2);
  });

  it('respects the team and project filter', async function () {
    const teamFilter = team => team.slug === 'team1' || team.slug === 'team2';
    const wrapper = createWrapper({teamFilter, project});
    openSelectMenu(wrapper);

    expect(wrapper.getByText('#team1')).toBeTruthy();

    // team3 should be filtered out
    expect(wrapper.queryByText('#team3')).toBeFalsy();

    // team2 should have add to project buttons
    expect(wrapper.getAllByRole('button').length).toBe(1);
  });

  it('allows you to add teams outside of project', async function () {
    const wrapper = createWrapper({project});
    openSelectMenu(wrapper);

    expect(wrapper.getByText('#team1')).toBeTruthy();

    // team2 and team3 should have add to project buttons
    const addToProjectButtons = wrapper.getAllByRole('button');

    await act(async () => {
      // add team2 to project
      fireEvent.click(addToProjectButtons[0]);
      await tick();
    });

    expect(addTeamToProject).toHaveBeenCalled();
  });
});
