import React from 'react';
import {mount} from 'enzyme';
import AssigneeSelector from 'app/components/assigneeSelector';

import LoadingIndicator from 'app/components/loadingIndicator';

import GroupStore from 'app/stores/groupStore';
import MemberListStore from 'app/stores/memberListStore';
import ConfigStore from 'app/stores/configStore';

import stubReactComponents from '../../helpers/stubReactComponent';

describe('AssigneeSelector', function() {
  const USER_1 = {
    id: 1,
    name: 'Jane Doe',
    email: 'janedoe@example.com'
  };
  const USER_2 = {
    id: 2,
    name: 'John Smith',
    email: 'johnsmith@example.com'
  };

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
    stubReactComponents(this.sandbox, [LoadingIndicator]);

    this.sandbox.stub(MemberListStore, 'getAll').returns([USER_1, USER_2]);
    this.sandbox.stub(GroupStore, 'get').returns({
      id: 1337,
      assignedTo: null
    });
  });

  afterEach(function() {
    this.sandbox.restore();
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
          USER_2
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
        this.sandbox.stub(ConfigStore, 'get').withArgs('user').returns({
          id: 2,
          name: 'John Smith',
          email: 'johnsmith@example.com'
        });
        expect(putSessionUserFirst([USER_1, USER_2])).toEqual([USER_2, USER_1]);
      });

      it("should return the same member list if the session user isn't present", function() {
        this.sandbox.stub(ConfigStore, 'get').withArgs('user').returns({
          id: 555,
          name: 'Here Comes a New Challenger',
          email: 'guile@mail.us.af.mil'
        });

        expect(putSessionUserFirst([USER_1, USER_2])).toEqual([USER_1, USER_2]);
      });
    });
  });

  describe('onFilterKeyDown()', function() {
    beforeEach(function() {
      let assigneeSelector = (this.assigneeSelector = mount(
        <AssigneeSelector id="1337" />
      ));

      this.assignTo = this.sandbox.stub(assigneeSelector.instance(), 'assignTo');
    });

    it('should assign the first filtered member when the Enter key is pressed and filter is truthy', function() {
      let assigneeSelector = this.assigneeSelector;
      assigneeSelector.setState({filter: 'Jane'});

      assigneeSelector
        .ref('filter')
        .simulate('keyDown', {key: 'Enter', keyCode: 13, which: 13});

      expect(this.assignTo.calledOnce).toBeTruthy;
      expect(this.assignTo.lastCall.args[0]).toHaveProperty('name', 'Jane Doe');
    });

    it('should do nothing when the Enter key is pressed, but filter is the empty string', function() {
      let assigneeSelector = this.assigneeSelector;
      assigneeSelector.setState({filter: ''});

      assigneeSelector
        .ref('filter')
        .simulate('keyDown', {key: 'Enter', keyCode: 13, which: 13});

      expect(this.assignTo.notCalled).toBeTruthy;
    });

    it('should do nothing if a non-Enter key is pressed', function() {
      let assigneeSelector = this.assigneeSelector;
      assigneeSelector.setState({filter: 'Jane'});

      assigneeSelector
        .ref('filter')
        .simulate('keyDown', {key: 'h', keyCode: 72, which: 72});
      expect(this.assignTo.notCalled).toBeTruthy;
    });
  });

  describe('onFilterKeyUp()', function() {
    beforeEach(function() {
      this.assigneeSelector = mount(<AssigneeSelector id="1337" />);
    });

    it('should close the dropdown when keyup is triggered with the Escape key', function() {
      let assigneeSelector = this.assigneeSelector;
      let closeStub = this.sandbox.stub(
        assigneeSelector.instance().refs.dropdown,
        'close'
      );

      assigneeSelector.ref('filter').simulate('keyUp', {key: 'Escape'});

      expect(closeStub.calledOnce).toBeTruthy;
    });

    it('should update the local filter state if any other key is pressed', function() {
      let assigneeSelector = this.assigneeSelector;

      assigneeSelector.ref('filter').simulate('keyUp', {target: {value: 'foo'}});
      expect(assigneeSelector.state('filter')).toEqual('foo');
    });
  });

  describe('componentDidUpdate()', function() {
    beforeEach(function() {
      this.assigneeSelector = mount(<AssigneeSelector id="1337" />);
    });

    it('should destroy old assignee tooltip and create a new assignee tooltip', function() {
      let instance = this.assigneeSelector.instance();
      this.sandbox.spy(instance, 'attachTooltips');
      this.sandbox.spy(instance, 'removeTooltips');

      this.assigneeSelector.setState({assignedTo: USER_1});

      expect(instance.attachTooltips.calledOnce).toBeTruthy;
      expect(instance.removeTooltips.calledOnce).toBeTruthy;
    });
  });
});
