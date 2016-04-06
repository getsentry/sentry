import React from 'react';
import TestUtils from 'react-addons-test-utils';
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

  beforeEach(function () {
    this.sandbox = sinon.sandbox.create();
    stubReactComponents(this.sandbox, [LoadingIndicator]);

    this.sandbox.stub(MemberListStore, 'getAll').returns([USER_1, USER_2]);
    this.sandbox.stub(GroupStore, 'get').returns({
      id: 1337,
      assignedTo: null
    });
  });

  afterEach(function () {
    this.sandbox.restore();
  });

  describe('statics', function () {
    const filterMembers = AssigneeSelector.filterMembers;

    describe('filterMembers()', function () {
      it('should return the full array when filter is falsy', function () {
        expect(filterMembers([USER_1, USER_2], '')).to.eql([USER_1, USER_2]);
        expect(filterMembers([USER_1, USER_2], null)).to.eql([USER_1, USER_2]);
        expect(filterMembers([USER_1, USER_2], undefined)).to.eql([USER_1, USER_2]);
      });

      it('should match on email', function () {
        expect(filterMembers([USER_1, USER_2], 'johnsmith@example.com')).to.eql([USER_2]);
      });

      it('should match on name', function () {
        expect(filterMembers([USER_1, USER_2], 'John Smith')).to.eql([USER_2]);
      });

      it('should ignore capitalization', function () {
        expect(filterMembers([USER_1], 'Jane')).to.eql([USER_1]);
        expect(filterMembers([USER_1], 'jane')).to.eql([USER_1]);
      });
    });

    const putSessionUserFirst = AssigneeSelector.putSessionUserFirst;

    describe('putSessionUserFirst()', function () {
      it('should place the session user at the top of the member list if present', function () {
        this.sandbox.stub(ConfigStore, 'get').withArgs('user').returns({
          id: 2,
          name: 'John Smith',
          email: 'johnsmith@example.com'
        });
        expect(putSessionUserFirst([USER_1, USER_2])).to.eql([USER_2, USER_1]);
      });

      it('should return the same member list if the session user isn\'t present', function () {
        this.sandbox.stub(ConfigStore, 'get').withArgs('user').returns({
          id: 555,
          name: 'Here Comes a New Challenger',
          email: 'guile@mail.us.af.mil'
        });

        expect(putSessionUserFirst([USER_1, USER_2])).to.eql([USER_1, USER_2]);
      });
    });
  });

  describe('onFilterKeyDown()', function () {
    beforeEach(function () {
      let assigneeSelector = this.assigneeSelector =
        TestUtils.renderIntoDocument(<AssigneeSelector id="1337"/>);

      this.sandbox.stub(assigneeSelector, 'assignTo');
    });

    it('should assign the first filtered member when the Enter key is pressed and filter is truthy', function () {
      let assigneeSelector = this.assigneeSelector;
      assigneeSelector.state.filter = 'Jane';

      TestUtils.Simulate.keyDown(assigneeSelector.refs.filter,
        {key: 'Enter', keyCode: 13, which: 13}
      );
      expect(assigneeSelector.assignTo.calledOnce).to.be.ok;
      expect(assigneeSelector.assignTo.lastCall.args[0]).to.have.property('name', 'Jane Doe');
    });

    it('should do nothing when the Enter key is pressed, but filter is the empty string', function () {
      let assigneeSelector = this.assigneeSelector;
      assigneeSelector.state.filter = '';

      TestUtils.Simulate.keyDown(assigneeSelector.refs.filter,
        {key: 'Enter', keyCode: 13, which: 13}
      );
      expect(assigneeSelector.assignTo.notCalled).to.be.ok;
    });

    it('should do nothing if a non-Enter key is pressed', function () {
      let assigneeSelector = this.assigneeSelector;
      assigneeSelector.state.filter = 'Jane';

      TestUtils.Simulate.keyDown(assigneeSelector.refs.filter,
        {key: 'h', keyCode: 72, which: 72}
      );
      expect(assigneeSelector.assignTo.notCalled).to.be.ok;
    });
  });

  describe('onFilterKeyUp()', function () {
    beforeEach(function () {
      this.assigneeSelector =
        TestUtils.renderIntoDocument(<AssigneeSelector id="1337"/>);
    });

    it('should close the dropdown when keyup is triggered with the Escape key', function () {
      let assigneeSelector = this.assigneeSelector;
      this.sandbox.stub(assigneeSelector.refs.dropdown, 'close');

      TestUtils.Simulate.keyUp(assigneeSelector.refs.filter, {key: 'Escape'});

      expect(assigneeSelector.refs.dropdown.close.calledOnce).to.be.ok;
    });

    it('should update the local filter state if any other key is pressed', function () {
      let assigneeSelector = this.assigneeSelector;

      TestUtils.Simulate.keyUp(assigneeSelector.refs.filter, {target: {value: 'foo'}});
      expect(assigneeSelector.state.filter).to.eql('foo');
    });
  });

  describe('componentDidUpdate()', function() {
    beforeEach(function() {
      this.assigneeSelector = TestUtils.renderIntoDocument(<AssigneeSelector id="1337"/>);
    });

    it('should destroy old assignee tooltip and create a new assignee tooltip', function(done) {
      this.sandbox.spy(this.assigneeSelector, 'attachTooltips');
      this.sandbox.spy(this.assigneeSelector, 'removeTooltips');

      this.assigneeSelector.setState({assignedTo: USER_1}, () => {
        expect(this.assigneeSelector.attachTooltips.calledOnce).to.be.ok;
        expect(this.assigneeSelector.removeTooltips.calledOnce).to.be.ok;
        done();
      });
    });
  });
});

