import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import NoteInput from 'app/components/activity/note/input';
import ConfigStore from 'app/stores/configStore';
import GroupStore from 'app/stores/groupStore';
import ProjectsStore from 'app/stores/projectsStore';
import {GroupActivity} from 'app/views/organizationGroupDetails/groupActivity';

describe('GroupActivity', function () {
  let project;

  beforeEach(function () {
    project = TestStubs.Project();
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

  function createWrapper({activity, organization: additionalOrg} = {}) {
    const group = TestStubs.Group({
      id: '1337',
      activity: activity || [
        {type: 'note', id: 'note-1', data: {text: 'Test Note'}, user: TestStubs.User()},
      ],
      project,
    });
    const {organization, routerContext} = initializeOrg({
      organization: additionalOrg,
      group,
    });
    return mountWithTheme(
      <GroupActivity
        api={new MockApiClient()}
        params={{orgId: 'org-slug'}}
        group={group}
        organization={organization}
      />,
      routerContext
    );
  }

  it('renders a NoteInput', function () {
    const wrapper = createWrapper();
    expect(wrapper.find(NoteInput)).toHaveLength(1);
  });

  it('renders a marked reviewed activity', function () {
    const wrapper = createWrapper({
      activity: [
        {type: 'mark_reviewed', id: 'reviewed-1', data: {}, user: TestStubs.User()},
      ],
    });
    expect(wrapper.find('GroupActivityItem').text()).toContain(
      'marked this issue as reviewed'
    );
  });

  describe('Delete', function () {
    let wrapper;
    let deleteMock;

    beforeEach(function () {
      deleteMock = MockApiClient.addMockResponse({
        url: '/issues/1337/comments/note-1/',
        method: 'DELETE',
      });
      wrapper = createWrapper();
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
