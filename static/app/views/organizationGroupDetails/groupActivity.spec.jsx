import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import PullRequestLink from 'sentry/components/pullRequestLink';
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
    ProjectsStore.loadInitialData([project]);
    ConfigStore.init();
    ConfigStore.set('user', {id: '123'});
    GroupStore.init();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  function createWrapper({activity, organization: additionalOrg} = {}) {
    const group = TestStubs.Group({
      id: '1337',
      activity: activity ?? [
        {type: 'note', id: 'note-1', data: {text: 'Test Note'}, user: TestStubs.User()},
      ],
      project,
    });
    const {organization, routerContext} = initializeOrg({
      organization: additionalOrg,
      group,
    });
    GroupStore.add([group]);
    TeamStore.loadInitialData([TestStubs.Team({id: '999', slug: 'no-team'})]);
    OrganizationStore.onUpdate(organization, {replace: true});
    return render(
      <GroupActivity
        api={new MockApiClient()}
        params={{orgId: 'org-slug'}}
        group={group}
        organization={organization}
      />,
      {context: routerContext}
    );
  }

  it('renders a NoteInput', function () {
    createWrapper();
    expect(screen.getByTestId('activity-note-body')).toBeInTheDocument();
  });

  it('renders a marked reviewed activity', function () {
    const user = TestStubs.User({name: 'Samwise'});
    createWrapper({
      activity: [{type: 'mark_reviewed', id: 'reviewed-1', data: {}, user}],
    });
    expect(screen.getByText('marked this issue as reviewed')).toBeInTheDocument();
    expect(screen.getByText(user.name)).toBeInTheDocument();
  });

  it('renders a pr activity', function () {
    const user = TestStubs.User({name: 'Test User'});
    const repository = TestStubs.Repository();
    const pullRequest = TestStubs.PullRequest({message: 'Fixes ISSUE-1'});
    createWrapper({
      activity: [
        {
          type: 'set_resolved_in_pull_request',
          id: 'pr-1',
          data: {
            pullRequest: {
              author: 'Test User',
              version: (
                <PullRequestLink
                  inline
                  pullRequest={pullRequest}
                  repository={pullRequest.repository}
                />
              ),
              repository: {repository},
            },
          },
          user,
        },
      ],
    });
    expect(screen.getAllByTestId('activity-item').at(-1)).toHaveTextContent(
      'Test User has created a PR for this issue:'
    );
  });

  it('renders a assigned to self activity', function () {
    const user = TestStubs.User({id: '301', name: 'Mark'});
    createWrapper({
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
    expect(screen.getAllByTestId('activity-item').at(-1)).toHaveTextContent(
      /Mark assigned this issue to themselves/
    );
  });

  it('renders an assigned via codeowners activity', function () {
    createWrapper({
      activity: [
        {
          data: {
            assignee: '123',
            assigneeEmail: 'anotheruser@sentry.io',
            assigneeType: 'user',
            integration: 'codeowners',
            rule: 'path:something/*.py #workflow',
          },
          dateCreated: '2021-10-01T15:31:38.950115Z',
          id: '117',
          type: 'assigned',
          user: null,
        },
      ],
    });
    expect(screen.getAllByTestId('activity-item').at(-1)).toHaveTextContent(
      /Sentry auto-assigned this issue to anotheruser@sentry.io/
    );
  });

  it('renders an assigned via slack activity', function () {
    const user = TestStubs.User({id: '301', name: 'Mark'});
    createWrapper({
      activity: [
        {
          data: {
            assignee: '123',
            assigneeEmail: 'anotheruser@sentry.io',
            assigneeType: 'user',
            integration: 'slack',
          },
          dateCreated: '2021-10-01T15:31:38.950115Z',
          id: '117',
          type: 'assigned',
          user,
        },
      ],
    });
    const item = screen.getAllByTestId('activity-item').at(-1);
    expect(item).toHaveTextContent(/Mark assigned this issue to anotheruser@sentry.io/);
    expect(item).toHaveTextContent(/Assigned via Slack/);
  });

  it('resolved in commit with no releases', function () {
    createWrapper({
      activity: [
        {
          type: 'set_resolved_in_commit',
          id: '123',
          data: {
            author: 'hello',
            commit: {
              id: 'komal-commit',
              repository: {},
              releases: [],
            },
          },
          user: TestStubs.User(),
        },
      ],
    });
    expect(screen.getAllByTestId('activity-item').at(-1)).toHaveTextContent(
      'Foo Bar marked this issue as resolved in komal-commit'
    );
  });

  it('resolved in commit with one release', function () {
    createWrapper({
      activity: [
        {
          type: 'set_resolved_in_commit',
          id: '123',
          data: {
            author: 'hello',
            commit: {
              id: 'komal-commit',
              repository: {},
              releases: [
                {
                  dateCreated: '2022-05-01',
                  dateReleased: '2022-05-02',
                  version: 'random',
                },
              ],
            },
          },
          user: TestStubs.User(),
        },
      ],
    });
    expect(screen.getAllByTestId('activity-item').at(-1)).toHaveTextContent(
      'Foo Bar marked this issue as resolved in komal-commit This commit was released in random'
    );
  });

  it('resolved in commit with multiple releases', function () {
    createWrapper({
      activity: [
        {
          type: 'set_resolved_in_commit',
          id: '123',
          data: {
            commit: {
              id: 'komal-commit',
              repository: {},
              releases: [
                {
                  dateCreated: '2022-05-01',
                  dateReleased: '2022-05-02',
                  version: 'random',
                },
                {
                  dateCreated: '2022-06-01',
                  dateReleased: '2022-06-02',
                  version: 'newest',
                },
                {
                  dateCreated: '2021-08-03',
                  dateReleased: '2021-08-03',
                  version: 'oldest-release',
                },
                {
                  dateCreated: '2022-04-21',
                  dateReleased: '2022-04-21',
                  version: 'randomTwo',
                },
              ],
            },
          },
          user: TestStubs.User(),
        },
      ],
    });
    expect(screen.getAllByTestId('activity-item').at(-1)).toHaveTextContent(
      'Foo Bar marked this issue as resolved in komal-commit This commit was released in oldest-release and 3 others'
    );
  });

  it('requests assignees that are not in the team store', async function () {
    const team = TestStubs.Team({id: '123', name: 'workflow'});
    const teamRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/teams/`,
      body: [team],
    });
    createWrapper({
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

    await waitFor(() => expect(teamRequest).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(`#${team.slug}`)).toBeInTheDocument();
    expect(screen.getAllByTestId('activity-item').at(-1)).toHaveTextContent(
      /Sentry assigned this issue to #team-slug/
    );
  });

  describe('Delete', function () {
    let deleteMock;

    beforeEach(function () {
      deleteMock = MockApiClient.addMockResponse({
        url: '/issues/1337/comments/note-1/',
        method: 'DELETE',
      });
      ConfigStore.set('user', {id: '123', isSuperuser: true});
    });

    it('should do nothing if not present in GroupStore', function () {
      createWrapper();
      renderGlobalModal();
      act(() => {
        // Remove note from group activity
        GroupStore.removeActivity('1337', 'note-1');
      });

      userEvent.click(screen.getByText('Remove'));
      expect(
        screen.getByText('Are you sure you wish to delete this comment?')
      ).toBeInTheDocument();
      userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      expect(deleteMock).not.toHaveBeenCalled();
    });

    it('should remove remove the item from the GroupStore make a DELETE API request', function () {
      createWrapper();
      renderGlobalModal();

      userEvent.click(screen.getByText('Remove'));
      expect(
        screen.getByText('Are you sure you wish to delete this comment?')
      ).toBeInTheDocument();
      userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      expect(deleteMock).toHaveBeenCalledTimes(1);
    });
  });
});
