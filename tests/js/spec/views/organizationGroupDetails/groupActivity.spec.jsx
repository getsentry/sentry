import React from 'react';
import {mount} from 'enzyme';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import {GroupActivity} from 'app/views/organizationGroupDetails/groupActivity';
import NoteInput from 'app/components/activity/note/input';
import ConfigStore from 'app/stores/configStore';
import GroupStore from 'app/stores/groupStore';

describe('GroupActivity', function() {
  const group = TestStubs.Group({
    id: '1337',
    activity: [
      {type: 'note', id: 'note-1', data: {text: 'Test Note'}, user: TestStubs.User()},
    ],
    project: TestStubs.Project(),
  });
  const {organization, routerContext} = initializeOrg({
    group,
  });
  beforeEach(function() {
    jest.spyOn(ConfigStore, 'get').mockImplementation(key => {
      if (key === 'user') {
        return {
          id: '123',
        };
      }
      return {};
    });
  });

  afterEach(function() {});

  it('renders a NoteInput', function() {
    const wrapper = mount(
      <GroupActivity
        api={new MockApiClient()}
        group={group}
        organization={organization}
      />,
      routerContext
    );
    expect(wrapper.find(NoteInput)).toHaveLength(1);
  });

  describe('Delete', function() {
    let wrapper;
    let deleteMock;

    beforeEach(function() {
      deleteMock = MockApiClient.addMockResponse({
        url: '/issues/1337/comments/note-1/',
        method: 'DELETE',
      });
      wrapper = mount(
        <GroupActivity
          api={new MockApiClient()}
          group={group}
          organization={organization}
        />,
        routerContext
      );
    });

    it('should do nothing if not present in GroupStore', function() {
      jest.spyOn(GroupStore, 'removeActivity').mockImplementation(() => -1); // not found

      // Would rather call simulate on the actual component but it's in a styled component
      // that is only visible on hover
      wrapper.find('NoteHeader').prop('onDelete')();
      expect(deleteMock).not.toHaveBeenCalled();
    });

    it('should remove remove the item from the GroupStore make a DELETE API request', function() {
      jest.spyOn(GroupStore, 'removeActivity').mockImplementation(() => 1);

      // Would rather call simulate on the actual component but it's in a styled component
      // that is only visible on hover
      wrapper.find('NoteHeader').prop('onDelete')();
      expect(deleteMock).toHaveBeenCalledTimes(1);
    });
  });
});
