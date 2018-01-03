import React from 'react';
import {mount} from 'enzyme';
import AssigneeSelector from 'app/components/assigneeSelector';

import LoadingIndicator from 'app/components/loadingIndicator';

import GroupStore from 'app/stores/groupStore';
import MemberListStore from 'app/stores/memberListStore';
import ConfigStore from 'app/stores/configStore';

import stubReactComponents from '../../helpers/stubReactComponent';

describe('AssigneeSelector', function() {
  let sandbox;
  let assigneeSelector;
  let assignTo;

  const USER_1 = {
    id: 1,
    name: 'Jane Doe',
    email: 'janedoe@example.com',
  };
  const USER_2 = {
    id: 2,
    name: 'John Smith',
    email: 'johnsmith@example.com',
  };
  const USER_3 = {
    id: 3,
    name: 'J J',
    email: 'jj@example.com',
  };

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    stubReactComponents(sandbox, [LoadingIndicator]);

    sandbox.stub(MemberListStore, 'getAll').returns([USER_1, USER_2]);
    sandbox.stub(GroupStore, 'get').returns({
      id: 1337,
      assignedTo: null,
    });
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('statics', function() {
    const filterMembers = AssigneeSelector.filterMembers;

    describe('filterMembers()', function() {
      it('should return the full array when filter is falsy', function() {
        expect(filterMembers([USER_1, USER_2], '')).toEqual([USER_1, USER_2]);
        expect(filterMembers([USER_1, USER_2], null)).toEqual([USER_1, USER_2]);
        expect(filterMembers([USER_1, USER_2], undefined)).toEqual([USER_1, USER_2]);
      });

      it('should match on email', function() {
        expect(filterMembers([USER_1, USER_2], 'johnsmith@example.com')).toEqual([
          USER_2,
        ]);
      });

      it('should match on name', function() {
        expect(filterMembers([USER_1, USER_2], 'John Smith')).toEqual([USER_2]);
      });

      it('should ignore capitalization', function() {
        expect(filterMembers([USER_1], 'Jane')).toEqual([USER_1]);
        expect(filterMembers([USER_1], 'jane')).toEqual([USER_1]);
      });
    });

    const putSessionUserFirst = AssigneeSelector.putSessionUserFirst;

    describe('putSessionUserFirst()', function() {
      it('should place the session user at the top of the member list if present', function() {
        sandbox
          .stub(ConfigStore, 'get')
          .withArgs('user')
          .returns({
            id: 2,
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
            id: 555,
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
      sandbox.stub(GroupStore, 'get').returns({
        id: 1337,
        assignedTo: null,
      });
      MemberListStore.items = [];
      MemberListStore.loaded = false;
      assigneeSelector = mount(<AssigneeSelector id="1337" />);
      openMenu = () => assigneeSelector.find('a').simulate('click');
    });

    it('should initially have loading state', function() {
      openMenu();
      expect(assigneeSelector.find('LoadingIndicator').exists()).toBe(true);
    });

    it('does not have loading state and shows member list after calling MemberListStore.loadInitialData', function() {
      openMenu();
      MemberListStore.loadInitialData([USER_1, USER_2]);
      assigneeSelector.update();

      expect(assigneeSelector.find('Avatar').length).toBe(2);
      expect(assigneeSelector.find('LoadingIndicator').exists()).toBe(false);
    });

    it('does NOT update member list after initial load', function() {
      openMenu();
      MemberListStore.loadInitialData([USER_1, USER_2]);
      assigneeSelector.update();

      expect(assigneeSelector.find('Avatar').length).toBe(2);
      expect(assigneeSelector.find('LoadingIndicator').exists()).toBe(false);

      MemberListStore.loadInitialData([USER_1, USER_2, USER_3]);
      assigneeSelector.update();

      expect(assigneeSelector.find('Avatar').length).toBe(2);
      expect(assigneeSelector.find('LoadingIndicator').exists()).toBe(false);
    });
  });

  describe('onFilterKeyDown()', function() {
    beforeEach(function() {
      MemberListStore.loaded = true;
      if (assigneeSelector) {
        assigneeSelector.unmount();
      }
      assigneeSelector = mount(<AssigneeSelector id="1337" />);
      // open menu
      assigneeSelector.find('a').simulate('click');

      assignTo = sandbox.stub(assigneeSelector.instance(), 'assignTo');
    });

    afterEach(function() {
      MemberListStore.loaded = false;
    });

    it('should assign the first filtered member when the Enter key is pressed and filter is truthy', function() {
      assigneeSelector.setState({filter: 'Jane'});

      let filter = assigneeSelector.find('input');
      filter.simulate('keyDown', {key: 'Enter', keyCode: 13, which: 13});

      expect(assignTo.calledOnce).toBeTruthy();
      expect(assignTo.lastCall.args[0]).toHaveProperty('name', 'Jane Doe');
    });

    it('should do nothing when the Enter key is pressed, but filter is the empty string', function() {
      assigneeSelector.setState({filter: ''});

      let filter = assigneeSelector.find('input');
      filter.simulate('keyDown', {key: 'Enter', keyCode: 13, which: 13});

      expect(assignTo.notCalled).toBeTruthy();
    });

    it('should do nothing if a non-Enter key is pressed', function() {
      assigneeSelector.setState({filter: 'Jane'});

      let filter = assigneeSelector.find('input');
      filter.simulate('keyDown', {key: 'h', keyCode: 72, which: 72});
      expect(assignTo.notCalled).toBeTruthy();
    });
  });

  describe('onFilterKeyUp()', function() {
    beforeEach(function() {
      MemberListStore.loaded = true;
      if (assigneeSelector) {
        assigneeSelector.unmount();
      }

      assigneeSelector = mount(<AssigneeSelector id="1337" />);

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

  describe('componentDidUpdate()', function() {
    beforeEach(function() {
      assigneeSelector = mount(<AssigneeSelector id="1337" />);
    });

    it('should destroy old assignee tooltip and create a new assignee tooltip', function() {
      let instance = assigneeSelector.instance();
      sandbox.spy(instance, 'attachTooltips');
      sandbox.spy(instance, 'removeTooltips');

      assigneeSelector.setState({assignedTo: USER_1});

      expect(instance.attachTooltips.calledOnce).toBeTruthy();
      expect(instance.removeTooltips.calledOnce).toBeTruthy();
    });
  });
});
