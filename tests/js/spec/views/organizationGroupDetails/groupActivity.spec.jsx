import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {act} from 'sentry-test/reactTestingLibrary';

import NoteInput from 'sentry/components/activity/note/input';
import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import {GroupActivity} from 'sentry/views/organizationGroupDetails/groupActivity';

describe('GroupActivity', function () {
  let project;

  beforeEach(function () {
    project = TestStubs.Project();
    act(() => ProjectsStore.loadInitialData([project]));
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
    act(() => TeamStore.loadInitialData([TestStubs.Team({id: '999', slug: 'no-team'})]));
    act(() => OrganizationStore.onUpdate(organization, {replace: true}));
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

  it('renders a assigned to self activity', function () {
    const user = TestStubs.User({id: '301', name: 'Mark'});
    const wrapper = createWrapper({
      activity: [
        {
          data: {
            assignee: user.id,
            assigneeEmail: user.email,
            assigneeType: 'user',
          },
          dateCreated: '2021-10-01T15:31:38.950115Z',
          id: '117',
          type: 'assigned',
          user,
        },
      ],
    });
    expect(wrapper.find('GroupActivityItem').text()).toContain(
      'assigned this issue to themselves'
    );
  });
  it('resolved in commit with no releases', function () {
    const wrapper = createWrapper({
      activity: [
        {
          type: 'set_resolved_in_commit',
          id: '123',
          data: {
            author: 'hello',
            commit: {
              releases: [],
            },
          },
          user: TestStubs.User(),
        },
      ],
    });
    expect(wrapper.find('GroupActivityItem').text()).toContain(
      'marked this issue as resolved in'
    );
  });

  it('resolved in commit with releases', function () {
    const wrapper = createWrapper({
      activity: [
        {
          type: 'set_resolved_in_commit',
          id: '123',
          data: {
            author: 'hello',
            commit: {
              releases: [
                {
                  dateCreated: 'string',
                  dateReleased: 'string',
                  ref: 'string',
                  shortVersion: 'string',
                  status: ReleaseStatus.Active,
                  url: 'string',
                  version: 'string',
                },
                {},
              ],
            },
          },
          user: TestStubs.User(),
        },
      ],
    });
    expect(wrapper.find('GroupActivityItem').text()).toContain(
      'marked this issue as resolved in'
    );
  });

  it('requests assignees that are not in the team store', async function () {
    const team = TestStubs.Team({id: '123', name: 'workflow'});
    const teamRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/teams/`,
      body: [team],
    });
    const wrapper = createWrapper({
      activity: [
        {
          id: '123',
          user: null,
          type: 'assigned',
          data: {
            assignee: team.id,
            assigneeEmail: null,
            assigneeType: 'team',
          },
          dateCreated: '2021-10-28T13:40:10.634821Z',
        },
      ],
    });

    await act(() => tick());
    wrapper.update();

    expect(teamRequest).toHaveBeenCalledTimes(1);
    expect(wrapper.find('GroupActivityItem').text()).toContain(
      'assigned this issue to #team-slug'
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
