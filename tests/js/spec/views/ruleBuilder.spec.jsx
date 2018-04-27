import React from 'react';
import {mount} from 'enzyme';

import {ThemeProvider} from 'emotion-theming';
import theme from 'app/utils/theme';
import MemberListStore from 'app/stores/memberListStore';
import TeamStore from 'app/stores/teamStore';

import RuleBuilder from 'app/views/settings/project/projectOwnership/ruleBuilder';

jest.mock('jquery');

describe('RuleBuilder', function() {
  let sandbox;

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
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('render()', function() {
    it('renders', function() {
      let wrapper = mount(
        <ThemeProvider theme={theme}>
          <RuleBuilder project={project} onAddRule={handleAdd} />
        </ThemeProvider>,
        TestStubs.routerContext()
      );

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
  });

  describe('renders with suggestions', function() {
    it('renders', function() {
      let wrapper = mount(
        <ThemeProvider theme={theme}>
          <RuleBuilder
            project={project}
            onAddRule={handleAdd}
            urls={['example.com/a', 'example.com/a/foo']}
            paths={['a/bar', 'a/foo']}
          />
        </ThemeProvider>,
        TestStubs.routerContext()
      );

      // Simulate select first element via down arrow / enter
      wrapper.find('SelectOwners .Select-control').simulate('keyDown', {keyCode: 40});
      wrapper.find('SelectOwners .Select-control').simulate('keyDown', {keyCode: 13});

      let ruleCandidate = wrapper.find('RuleCandidate').first();
      ruleCandidate.simulate('click');

      let add = wrapper.find('RuleAddButton');
      expect(wrapper.find(RuleBuilder)).toMatchSnapshot();

      add.simulate('click');
      expect(handleAdd).toHaveBeenCalled();
    });
  });
});
