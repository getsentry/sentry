import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import {GroupActivity} from 'app/views/organizationGroupDetails/groupActivity';
import ConfigStore from 'app/stores/configStore';
import GroupStore from 'app/stores/groupStore';
import NoteInput from 'app/components/activity/note/input';
import ProjectsStore from 'app/stores/projectsStore';

describe('GroupActivity', function () {
  const project = TestStubs.Project();
  const group = TestStubs.Group({
    id: '1337',
    activity: [
      {type: 'note', id: 'note-1', data: {text: 'Test Note'}, user: TestStubs.User()},
    ],
    project,
  });
  const {organization, routerContext} = initializeOrg({
    group,
  });

  beforeEach(function () {
    ProjectsStore.loadInitialData([project]);
    jest.spyOn(ConfigStore, 'get').mockImplementation(key => {
      if (key === 'user') {
        return {
          id: '123',
        };
      }
      return {};
    });
  });

  afterEach(function () {});

  it('renders a NoteInput', function () {
    const wrapper = mountWithTheme(
      <GroupActivity
        api={new MockApiClient()}
        group={group}
        organization={organization}
      />,
      routerContext
    );
    expect(wrapper.find(NoteInput)).toHaveLength(1);
  });

  describe('Delete', function () {
    let wrapper;
    let deleteMock;

    beforeEach(function () {
      deleteMock = MockApiClient.addMockResponse({
        url: '/issues/1337/comments/note-1/',
        method: 'DELETE',
      });
      wrapper = mountWithTheme(
        <GroupActivity
          api={new MockApiClient()}
          group={group}
          organization={organization}
        />,
        routerContext
      );
    });

    it('should do nothing if not present in GroupStore', function () {
      jest.spyOn(GroupStore, 'removeActivity').mockImplementation(() => -1); // not found

      // Would rather call simulate on the actual component but it's in a styled component
      // that is only visible on hover
      wrapper.find('NoteHeader').prop('onDelete')();
      expect(deleteMock).not.toHaveBeenCalled();
    });

    it('should remove remove the item from the GroupStore make a DELETE API request', function () {
      jest.spyOn(GroupStore, 'removeActivity').mockImplementation(() => 1);

      // Would rather call simulate on the actual component but it's in a styled component
      // that is only visible on hover
      wrapper.find('NoteHeader').prop('onDelete')();
      expect(deleteMock).toHaveBeenCalledTimes(1);
    });
  });
});
