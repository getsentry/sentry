import {mountWithTheme} from 'sentry-test/enzyme';
import {act} from 'sentry-test/reactTestingLibrary';
import {findOption, openMenu, selectByValueAsync} from 'sentry-test/select-new';

import MemberListStore from 'sentry/stores/memberListStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import RuleBuilder from 'sentry/views/settings/project/projectOwnership/ruleBuilder';

describe('RuleBuilder', function () {
  const organization = TestStubs.Organization();
  let project;
  let handleAdd;
  const USER_1 = TestStubs.User({
    id: '1',
    name: 'Jane Bloggs',
    email: 'janebloggs@example.com',
    user: {
      id: '1',
      name: 'Jane Bloggs',
      email: 'janebloggs@example.com',
    },
  });
  const USER_2 = TestStubs.User({
    id: '2',
    name: 'John Smith',
    email: 'johnsmith@example.com',
    user: {
      id: '2',
      name: 'John Smith',
      email: 'johnsmith@example.com',
    },
  });

  const TEAM_1 = TestStubs.Team({
    id: '3',
    name: 'COOL TEAM',
    slug: 'cool-team',
  });

  // This team is in project
  const TEAM_2 = TestStubs.Team({
    id: '4',
    name: 'TEAM NOT IN PROJECT',
    slug: 'team-not-in-project',
  });

  beforeEach(function () {
    // User in project
    MemberListStore.loadInitialData([USER_1]);
    // All teams
    jest.spyOn(TeamStore, 'getAll').mockImplementation(() => [TEAM_1, TEAM_2]);

    handleAdd = jest.fn();

    project = TestStubs.Project({
      // Teams in project
      teams: [TEAM_1],
    });
    act(() => ProjectsStore.loadInitialData([project]));
    jest.spyOn(ProjectsStore, 'getBySlug').mockImplementation(() => project);
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [USER_1, USER_2],
    });
  });

  afterEach(function () {});

  it('renders', async function () {
    const wrapper = mountWithTheme(
      <RuleBuilder project={project} organization={organization} onAddRule={handleAdd} />
    );

    await tick();
    wrapper.update();

    const add = wrapper.find('AddButton');
    add.simulate('click');
    expect(handleAdd).not.toHaveBeenCalled();

    const text = wrapper.find('BuilderInput');
    text.simulate('change', {target: {value: 'some/path/*'}});
    expect(wrapper.find('AddButton').prop('disabled')).toBe(true);

    add.simulate('click');
    expect(handleAdd).not.toHaveBeenCalled();

    // Select the first item in the list.
    await selectByValueAsync(wrapper, 'user:1', {name: 'owners', control: true});
    await wrapper.update();

    expect(wrapper.find('AddButton').prop('disabled')).toBe(false);
    add.simulate('click');
    expect(handleAdd).toHaveBeenCalled();

    // This is because after selecting, react-select (async) reloads
    await tick();
    wrapper.update();
    expect(wrapper.find(RuleBuilder)).toSnapshot();
  });

  it('renders with suggestions', async function () {
    const wrapper = mountWithTheme(
      <RuleBuilder
        project={project}
        organization={organization}
        onAddRule={handleAdd}
        urls={['example.com/a', 'example.com/a/foo']}
        paths={['a/bar', 'a/foo']}
      />
    );

    // Open the menu so we can do some assertions.
    openMenu(wrapper, {name: 'owners', control: true});
    await tick();
    wrapper.update();

    // Should have all 4 users/teams listed
    expect(wrapper.find('IdBadge')).toHaveLength(4);

    // Should have 1 user not in project and 1 team not in project
    expect(wrapper.find('DisabledLabel IdBadge')).toHaveLength(2);

    // Team not in project should not be selectable
    expect(wrapper.find('DisabledLabel IdBadge').at(0).prop('team').id).toBe('4');

    // John Smith should not be selectable
    expect(wrapper.find('DisabledLabel IdBadge').at(1).prop('user').id).toBe('2');

    // Enter to select Jane Bloggs
    findOption(wrapper, {value: 'user:1'}, {name: 'owners', control: true})
      .at(0)
      .simulate('click');

    const ruleCandidate = wrapper.find('RuleCandidate').first();
    ruleCandidate.simulate('click');

    // This is because after selecting, react-select (async) reloads
    await tick();
    wrapper.update();
    expect(wrapper.find(RuleBuilder)).toSnapshot();

    wrapper.find('AddButton').simulate('click');
    expect(handleAdd).toHaveBeenCalled();
  });
});
