import React from 'react';
import {mount} from 'enzyme';

import MemberListStore from 'app/stores/memberListStore';
import TeamStore from 'app/stores/teamStore';
import ProjectsStore from 'app/stores/projectsStore';

import RuleBuilder from 'app/views/settings/project/projectOwnership/ruleBuilder';

jest.mock('jquery');

describe('RuleBuilder', function() {
  let sandbox;

  let organization = TestStubs.Organization();
  let project;
  let handleAdd;
  let USER_1 = TestStubs.User({
    id: '1',
    name: 'Jane Doe',
    email: 'janedoe@example.com',
    user: {
      id: '1',
      name: 'Jane Doe',
      email: 'janedoe@example.com',
    },
  });
  let USER_2 = TestStubs.User({
    id: '2',
    name: 'John Smith',
    email: 'johnsmith@example.com',
    user: {
      id: '2',
      name: 'John Smith',
      email: 'johnsmith@example.com',
    },
  });

  let TEAM_1 = TestStubs.Team({
    id: '3',
    name: 'COOL TEAM',
    slug: 'cool-team',
  });

  // This team is in project
  let TEAM_2 = TestStubs.Team({
    id: '4',
    name: 'TEAM NOT IN PROJECT',
    slug: 'team-not-in-project',
  });

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    // User in project
    MemberListStore.loadInitialData([USER_1]);
    // All teams
    sandbox.stub(TeamStore, 'getAll').returns([TEAM_1, TEAM_2]);

    handleAdd = jest.fn();

    project = TestStubs.Project({
      // Teams in project
      teams: [TEAM_1],
    });
    ProjectsStore.loadInitialData([project]);
    sandbox.stub(ProjectsStore, 'getBySlug').returns(project);
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [USER_1, USER_2],
    });
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('renders', async function() {
    let wrapper = mount(
      <RuleBuilder project={project} organization={organization} onAddRule={handleAdd} />,
      TestStubs.routerContext()
    );

    await tick();
    wrapper.update();

    let add = wrapper.find('RuleAddButton');
    add.simulate('click');
    expect(handleAdd).not.toHaveBeenCalled();

    let text = wrapper.find('BuilderInput');
    text.simulate('change', {target: {value: 'some/path/*'}});
    expect(wrapper.find('RuleAddButton').prop('disabled')).toBe(true);

    add.simulate('click');
    expect(handleAdd).not.toHaveBeenCalled();

    // Simulate select first element via down arrow / enter
    wrapper.find('SelectOwners .Select-control').simulate('keyDown', {keyCode: 40});
    wrapper.find('SelectOwners .Select-control').simulate('keyDown', {keyCode: 13});

    expect(wrapper.find('RuleAddButton').prop('disabled')).toBe(false);
    add.simulate('click');
    expect(handleAdd).toHaveBeenCalled();

    // This is because after selecting, react-select (async) reloads
    await tick();
    wrapper.update();
    expect(wrapper.find(RuleBuilder)).toMatchSnapshot();
  });

  it('renders with suggestions', async function() {
    let wrapper = mount(
      <RuleBuilder
        project={project}
        organization={organization}
        onAddRule={handleAdd}
        urls={['example.com/a', 'example.com/a/foo']}
        paths={['a/bar', 'a/foo']}
      />,
      TestStubs.routerContext()
    );

    wrapper.find('SelectOwners .Select-input input').simulate('focus');

    await tick();
    wrapper.update();

    // Simulate select first element via down arrow / enter
    wrapper.find('SelectOwners .Select-control').simulate('keyDown', {keyCode: 40});

    // Should have all 4 users/teams listed
    expect(wrapper.find('IdBadge')).toHaveLength(4);

    // Should have 1 user not in project and 1 team not in project
    expect(wrapper.find('DisabledLabel IdBadge')).toHaveLength(2);

    // Team not in project should not be selectable
    expect(
      wrapper
        .find('DisabledLabel IdBadge')
        .at(0)
        .prop('team').id
    ).toBe('4');

    // John Smith should not be selectable
    expect(
      wrapper
        .find('DisabledLabel IdBadge')
        .at(1)
        .prop('user').id
    ).toBe('2');

    // Enter to select Jane Doe
    wrapper.find('SelectOwners .Select-control').simulate('keyDown', {keyCode: 13});

    let ruleCandidate = wrapper.find('RuleCandidate').first();
    ruleCandidate.simulate('click');

    // This is because after selecting, react-select (async) reloads
    await tick();
    wrapper.update();
    expect(wrapper.find(RuleBuilder)).toMatchSnapshot();

    wrapper.find('RuleAddButton').simulate('click');
    expect(handleAdd).toHaveBeenCalled();
  });
});
