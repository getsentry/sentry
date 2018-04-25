import React from 'react';
import {mount} from 'enzyme';

import MemberListStore from 'app/stores/memberListStore';
import TeamStore from 'app/stores/teamStore';

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
  });
  let USER_2 = TestStubs.User({
    id: '2',
    name: 'John Smith',
    email: 'johnsmith@example.com',
  });

  let TEAM_1 = TestStubs.Team({
    id: '3',
    name: 'COOL TEAM',
    slug: 'cool-team',
  });

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    MemberListStore.loadInitialData([USER_1, USER_2]);
    sandbox.stub(TeamStore, 'getAll').returns([TEAM_1]);

    handleAdd = jest.fn();
    project = TestStubs.Project();
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

    add.simulate('click');
    expect(handleAdd).not.toHaveBeenCalled();

    // Simulate select first element via down arrow / enter
    wrapper.find('SelectOwners .Select-control').simulate('keyDown', {keyCode: 40});
    wrapper.find('SelectOwners .Select-control').simulate('keyDown', {keyCode: 13});

    add.simulate('click');
    expect(handleAdd).toHaveBeenCalled();

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

    await tick();
    wrapper.update();

    // Simulate select first element via down arrow / enter
    wrapper.find('SelectOwners .Select-control').simulate('keyDown', {keyCode: 40});
    wrapper.find('SelectOwners .Select-control').simulate('keyDown', {keyCode: 13});

    let ruleCandidate = wrapper.find('RuleCandidate').first();
    ruleCandidate.simulate('click');

    expect(wrapper.find(RuleBuilder)).toMatchSnapshot();

    wrapper.find('RuleAddButton').simulate('click');
    expect(handleAdd).toHaveBeenCalled();
  });
});
