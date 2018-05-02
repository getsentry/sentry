import React from 'react';
import {mount} from 'enzyme';
import AssigneeSelector from 'app/components/assigneeSelector';

import LoadingIndicator from 'app/components/loadingIndicator';
import {Client} from 'app/api';

import GroupStore from 'app/stores/groupStore';
import MemberListStore from 'app/stores/memberListStore';
import ConfigStore from 'app/stores/configStore';
import TeamStore from 'app/stores/teamStore';
import ProjectsStore from 'app/stores/projectsStore';

import stubReactComponents from '../../helpers/stubReactComponent';

describe('AssigneeSelector', function() {
  let sandbox;
  let assigneeSelector;
  let assignToUser;
  let USER_1, USER_2, USER_3;
  let TEAM_1;
  let PROJECT_1;
  let GROUP_1;
  let PATH;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    stubReactComponents(sandbox, [LoadingIndicator]);

    USER_1 = TestStubs.User({
      id: '1',
      name: 'Jane Doe',
      email: 'janedoe@example.com',
    });
    USER_2 = TestStubs.User({
      id: '2',
      name: 'John Smith',
      email: 'johnsmith@example.com',
    });
    USER_3 = TestStubs.User({
      id: '3',
      name: 'J J',
      email: 'jj@example.com',
    });

    TEAM_1 = TestStubs.Team({
      id: '3',
      name: 'COOL TEAM',
      slug: 'cool-team',
    });

    PROJECT_1 = TestStubs.Project({
      teams: [TEAM_1],
    });

    GROUP_1 = TestStubs.Group({
      id: '1337',
      project: {
        id: PROJECT_1.id,
        slug: PROJECT_1.slug,
      },
    });

    PATH = `/issues/${GROUP_1.id}/`;

    sandbox.stub(MemberListStore, 'getAll').returns([USER_1, USER_2]);
    sandbox.stub(TeamStore, 'getAll').returns([TEAM_1]);
    sandbox.stub(ProjectsStore, 'getAll').returns([PROJECT_1]);
    sandbox.stub(GroupStore, 'get').returns(GROUP_1);
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('statics', function() {
    const filterAssignees = AssigneeSelector.filterAssignees;

    describe('filterAssignees()', function() {
      it('should return the full array when filter is falsy', function() {
        expect(filterAssignees([USER_1, USER_2], '')).toEqual([USER_1, USER_2]);
        expect(filterAssignees([USER_1, USER_2], null)).toEqual([USER_1, USER_2]);
        expect(filterAssignees([USER_1, USER_2], undefined)).toEqual([USER_1, USER_2]);
      });

      it('should match on email', function() {
        expect(filterAssignees([USER_1, USER_2], 'johnsmith@example.com')).toEqual([
          USER_2,
        ]);
      });

      it('should match on name', function() {
        expect(filterAssignees([USER_1, USER_2], 'John Smith')).toEqual([USER_2]);
      });

      it('should ignore capitalization', function() {
        expect(filterAssignees([USER_1], 'Jane')).toEqual([USER_1]);
        expect(filterAssignees([USER_1], 'jane')).toEqual([USER_1]);
      });
    });

    const putSessionUserFirst = AssigneeSelector.putSessionUserFirst;

    describe('putSessionUserFirst()', function() {
      it('should place the session user at the top of the member list if present', function() {
        sandbox
          .stub(ConfigStore, 'get')
          .withArgs('user')
          .returns({
            id: '2',
            name: 'John Smith',
            email: 'johnsmith@example.com',
          });
        expect(putSessionUserFirst([USER_1, USER_2])).toEqual([USER_2, USER_1]);
      });

      it("should return the same member list if the session user isn't present", function() {
        sandbox
          .stub(ConfigStore, 'get')
          .withArgs('user')
          .returns({
            id: '555',
            name: 'Here Comes a New Challenger',
            email: 'guile@mail.us.af.mil',
          });

        expect(putSessionUserFirst([USER_1, USER_2])).toEqual([USER_1, USER_2]);
      });
    });
  });

  describe('loading', function() {
    let openMenu;

    beforeEach(function() {
      // Reset sandbox because we don't want <LoadingIndicator /> stubbed
      sandbox.restore();
      sandbox = sinon.sandbox.create();
      sandbox.stub(MemberListStore, 'getAll').returns([USER_1, USER_2]);
      sandbox.stub(TeamStore, 'getAll').returns([TEAM_1]);
      sandbox.stub(ProjectsStore, 'getAll').returns([PROJECT_1]);
      sandbox.stub(GroupStore, 'get').returns(GROUP_1);

      Client.addMockResponse({
        method: 'PUT',
        url: `/issues/${GROUP_1.id}/`,
        body: {
          ...GROUP_1,
          assignedTo: USER_1,
        },
      });

      MemberListStore.items = [];
      MemberListStore.loaded = false;

      assigneeSelector = mount(
        <AssigneeSelector id={GROUP_1.id} />,
        TestStubs.routerContext()
      );
      assigneeSelector.setContext({
        organization: {id: '1', features: new Set(['new-teams'])},
      });

      openMenu = () => assigneeSelector.find('a').simulate('click');
    });

    afterEach(function() {
      Client.clearMockResponses();
    });

    it('should initially have loading state', function() {
      openMenu();
      expect(assigneeSelector.find('LoadingIndicator').exists()).toBe(true);
    });

    it('does not have loading state and shows member list after calling MemberListStore.loadInitialData', function() {
      openMenu();
      MemberListStore.loadInitialData([USER_1, USER_2]);
      assigneeSelector.update();
      expect(assigneeSelector.instance().assignableTeams()).toHaveLength(1);

      expect(assigneeSelector.find('Avatar')).toHaveLength(3);
      expect(assigneeSelector.find('UserAvatar')).toHaveLength(2);
      expect(assigneeSelector.find('TeamAvatar')).toHaveLength(1);
      expect(assigneeSelector.find('LoadingIndicator').exists()).toBe(false);
    });

    it('does NOT update member list after initial load', function() {
      openMenu();
      MemberListStore.loadInitialData([USER_1, USER_2]);
      assigneeSelector.update();

      expect(assigneeSelector.find('Avatar')).toHaveLength(3);
      expect(assigneeSelector.find('LoadingIndicator').exists()).toBe(false);

      MemberListStore.loadInitialData([USER_1, USER_2, USER_3]);
      assigneeSelector.update();

      expect(assigneeSelector.find('Avatar')).toHaveLength(3);
      expect(assigneeSelector.find('LoadingIndicator').exists()).toBe(false);
    });

    it('successfully assigns users', function(done) {
      openMenu();
      MemberListStore.loadInitialData([USER_1, USER_2]);
      assigneeSelector.update();
      assigneeSelector
        .find('Avatar')
        .first()
        .simulate('click');
      assigneeSelector.update();
      expect(assigneeSelector.find('LoadingIndicator').exists()).toBe(true);

      setTimeout(() => {
        assigneeSelector.update();
        expect(assigneeSelector.find('LoadingIndicator').exists()).toBe(false);
        expect(assigneeSelector.find('ActorAvatar')).toHaveLength(1);
        done();
      }, 100); //hack
    });

    it('successfully assigns teams', function(done) {
      openMenu();
      MemberListStore.loadInitialData([USER_1, USER_2]);
      assigneeSelector.update();
      assigneeSelector
        .find('TeamAvatar')
        .first()
        .simulate('click');
      assigneeSelector.update();
      expect(assigneeSelector.find('LoadingIndicator').exists()).toBe(true);

      setTimeout(() => {
        assigneeSelector.update();
        expect(assigneeSelector.find('LoadingIndicator').exists()).toBe(false);
        expect(assigneeSelector.find('ActorAvatar')).toHaveLength(1);
        done();
      }, 100); //hack
    });

    it('successfully clears assignment', function() {
      openMenu();
      MemberListStore.loadInitialData([USER_1, USER_2]);
      assigneeSelector.update();
      assigneeSelector
        .find('Avatar')
        .first()
        .simulate('click');
      assigneeSelector.update();
      expect(assigneeSelector.find('LoadingIndicator').exists()).toBe(true);

      expect(
        Client.findMockResponse(PATH, {
          method: 'PUT',
        })[0].callCount
      ).toBe(1);

      assigneeSelector.instance().clearAssignTo();

      expect(
        Client.findMockResponse(PATH, {
          method: 'PUT',
        })[0].callCount
      ).toBe(2);
      //api was called with empty string, clearing assignment
      expect(
        Client.findMockResponse(PATH, {
          method: 'PUT',
        })[1].mock.calls[1][1].data.assignedTo
      ).toBe('');
    });

    it('shows invite member button', function() {
      openMenu();
      assigneeSelector.update();
      expect(assigneeSelector.find('MenuItem.invite-member').exists()).toBe(false);

      sandbox
        .stub(ConfigStore, 'get')
        .withArgs('invitesEnabled')
        .returns(true);
      // Create a new selector because assigneeSelector.update() won't re-render
      // if the state doesn't change.
      let sel = mount(<AssigneeSelector id={GROUP_1.id} />, TestStubs.routerContext());
      sel.find('a').simulate('click');
      expect(sel.find('MenuItem.invite-member')).toHaveLength(1);

      // Remove org:write access permission and make sure invite member button is not shown.
      sel = mount(<AssigneeSelector id={GROUP_1.id} />, TestStubs.routerContext());
      sel.setContext({
        organization: {id: '1', features: new Set(['new-teams'])},
      });
      sel.find('a').simulate('click');
      expect(sel.find('MenuItem.invite-member').exists()).toBe(false);
    });
  });

  describe('onFilterKeyDown()', function() {
    beforeEach(function() {
      MemberListStore.loaded = true;
      if (assigneeSelector) {
        assigneeSelector.unmount();
      }
      assigneeSelector = mount(
        <AssigneeSelector id={GROUP_1.id} />,
        TestStubs.routerContext()
      );
      // open menu
      assigneeSelector.find('a').simulate('click');

      assignToUser = sandbox.stub(assigneeSelector.instance(), 'assignToUser');
    });

    afterEach(function() {
      MemberListStore.loaded = false;
    });

    it('should assign the first filtered member when the Enter key is pressed and filter is truthy', function() {
      assigneeSelector.setState({filter: 'Jane'});

      let filter = assigneeSelector.find('input');
      filter.simulate('keyDown', {key: 'Enter', keyCode: 13, which: 13});

      expect(assignToUser.calledOnce).toBeTruthy();
      expect(assignToUser.lastCall.args[0]).toHaveProperty('name', 'Jane Doe');
    });

    it('should do nothing when the Enter key is pressed, but filter is the empty string', function() {
      assigneeSelector.setState({filter: ''});

      let filter = assigneeSelector.find('input');
      filter.simulate('keyDown', {key: 'Enter', keyCode: 13, which: 13});

      expect(assignToUser.notCalled).toBeTruthy();
    });

    it('should do nothing if a non-Enter key is pressed', function() {
      assigneeSelector.setState({filter: 'Jane'});

      let filter = assigneeSelector.find('input');
      filter.simulate('keyDown', {key: 'h', keyCode: 72, which: 72});
      expect(assignToUser.notCalled).toBeTruthy();
    });
  });

  describe('onFilterKeyUp()', function() {
    beforeEach(function() {
      MemberListStore.loaded = true;
      if (assigneeSelector) {
        assigneeSelector.unmount();
      }

      assigneeSelector = mount(
        <AssigneeSelector id={GROUP_1.id} />,
        TestStubs.routerContext()
      );

      // open menu
      assigneeSelector.find('a').simulate('click');
    });

    afterEach(function() {
      MemberListStore.loaded = false;
    });

    it('should close the dropdown when keyup is triggered with the Escape key', function() {
      let filter = assigneeSelector.find('input');
      filter.simulate('keyUp', {key: 'Escape'});

      expect(assigneeSelector.state('isOpen')).toBe(false);
    });

    it('should update the local filter state if any other key is pressed', function() {
      let filter = assigneeSelector.find('input');
      filter.simulate('keyUp', {target: {value: 'foo'}});
      expect(assigneeSelector.state('filter')).toEqual('foo');
    });
  });
});
