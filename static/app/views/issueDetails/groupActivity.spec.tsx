import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import type {Group} from 'sentry/types/group';
import {GroupActivityType, PriorityLevel} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import GroupActivity from 'sentry/views/issueDetails/groupActivity';

describe('GroupActivity', function () {
  let project!: Project;
  const dateCreated = '2021-10-01T15:31:38.950115Z';

  beforeEach(function () {
    project = ProjectFixture();
    ProjectsStore.loadInitialData([project]);
    ConfigStore.init();
    ConfigStore.set('user', UserFixture({id: '123'}));
    GroupStore.init();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  function createWrapper({
    activity,
  }: {
    activity?: Group['activity'];
  } = {}) {
    const group = GroupFixture({
      id: '1337',
      activity: activity ?? [
        {
          type: GroupActivityType.NOTE,
          id: 'note-1',
          data: {text: 'Test Note'},
          dateCreated: '2020-01-01T00:00:00',
          user: UserFixture(),
          project,
        },
      ],
      project,
    });
    GroupStore.add([group]);

    const {organization, router} = initializeOrg({
      router: {
        params: {orgId: 'org-slug', groupId: group.id},
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: group,
    });

    TeamStore.loadInitialData([TeamFixture({id: '999', slug: 'no-team'})]);
    OrganizationStore.onUpdate(organization, {replace: true});
    return render(<GroupActivity />, {router, organization});
  }

  it('renders a NoteInput', async function () {
    createWrapper();
    expect(await screen.findByTestId('activity-note-body')).toBeInTheDocument();
  });

  it('renders a marked reviewed activity', async function () {
    const user = UserFixture({name: 'Samwise'});
    createWrapper({
      activity: [
        {
          type: GroupActivityType.MARK_REVIEWED,
          id: 'reviewed-1',
          dateCreated: '',
          project: ProjectFixture(),
          data: {},
          user,
        },
      ],
    });
    expect(await screen.findByText('marked this issue as reviewed')).toBeInTheDocument();
    expect(screen.getByText(user.name)).toBeInTheDocument();
  });

  it('renders a pr activity', async function () {
    const user = UserFixture({name: 'Test User'});
    const repository = RepositoryFixture();
    createWrapper({
      activity: [
        {
          dateCreated: '',
          project: ProjectFixture(),
          type: GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST,
          id: 'pr-1',
          data: {
            pullRequest: {
              externalUrl: '',
              id: '',
              title: '',
              repository,
            },
          },
          user,
        },
      ],
    });
    expect((await screen.findAllByTestId('activity-item')).at(-1)).toHaveTextContent(
      'Test User has created a PR for this issue:'
    );
  });

  it('renders a assigned to self activity', async function () {
    const user = UserFixture({id: '123', name: 'Mark'});
    createWrapper({
      activity: [
        {
          data: {
            assignee: user.id,
            assigneeEmail: user.email,
            assigneeType: 'user',
            user,
          },
          user,
          dateCreated: '2021-10-01T15:31:38.950115Z',
          id: '117',
          project: ProjectFixture(),
          type: GroupActivityType.ASSIGNED,
        },
      ],
    });
    expect((await screen.findAllByTestId('activity-item')).at(-1)).toHaveTextContent(
      /Mark assigned this issue to themselves/
    );
  });

  it('renders an assigned via codeowners activity', async function () {
    createWrapper({
      activity: [
        {
          data: {
            assignee: '123',
            assigneeEmail: 'anotheruser@sentry.io',
            assigneeType: 'user',
            integration: 'codeowners',
            rule: 'path:something/*.py #workflow',
            user: UserFixture(),
          },
          project: ProjectFixture(),
          dateCreated: '2021-10-01T15:31:38.950115Z',
          id: '117',
          type: GroupActivityType.ASSIGNED,
          user: null,
        },
      ],
    });
    expect((await screen.findAllByTestId('activity-item')).at(-1)).toHaveTextContent(
      /Sentry auto-assigned this issue to anotheruser@sentry.io/
    );
  });

  it('renders an assigned via slack activity', async function () {
    const user = UserFixture({id: '301', name: 'Mark'});
    createWrapper({
      activity: [
        {
          data: {
            assignee: '123',
            assigneeEmail: 'anotheruser@sentry.io',
            assigneeType: 'user',
            integration: 'slack',
            user: UserFixture(),
          },
          project: ProjectFixture(),
          dateCreated: '2021-10-01T15:31:38.950115Z',
          id: '117',
          type: GroupActivityType.ASSIGNED,
          user,
        },
      ],
    });
    const item = (await screen.findAllByTestId('activity-item')).at(-1);
    expect(item).toHaveTextContent(/Mark assigned this issue to anotheruser@sentry.io/);
    expect(item).toHaveTextContent(/Assigned via Slack/);
  });

  it('renders an assigned via suspect commit activity', async function () {
    createWrapper({
      activity: [
        {
          data: {
            assignee: '123',
            assigneeEmail: 'anotheruser@sentry.io',
            assigneeType: 'user',
            integration: 'suspectCommitter',
            user: UserFixture(),
          },
          project: ProjectFixture(),
          dateCreated: '1999-10-01T15:31:38.950115Z',
          id: '117',
          type: GroupActivityType.ASSIGNED,
          user: null,
        },
      ],
    });
    const activity = (await screen.findAllByTestId('activity-item')).at(-1);
    expect(activity).toHaveTextContent(
      /Sentry auto-assigned this issue to anotheruser@sentry.io/
    );
    expect(activity).toHaveTextContent(/Assigned via Suspect Commit/);
  });

  it('does not render undefined when integration is not recognized', async function () {
    createWrapper({
      activity: [
        // @ts-ignore-next-line -> committing type crimes on `integration`
        {
          data: {
            assignee: '123',
            assigneeEmail: 'anotheruser@sentry.io',
            assigneeType: 'user',
            integration: 'lottery',
            user: UserFixture(),
          },
          project: ProjectFixture(),
          dateCreated: '1999-10-01T15:31:38.950115Z',
          id: '117',
          type: GroupActivityType.ASSIGNED,
          user: null,
        },
      ],
    });

    const activity = (await screen.findAllByTestId('activity-item')).at(-1);
    expect(activity).toHaveTextContent(
      /Sentry assigned this issue to anotheruser@sentry.io/
    );
    expect(activity).not.toHaveTextContent(/Assigned via Suspect Commit/);
  });

  it('resolved in commit with no releases', async function () {
    createWrapper({
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED_IN_COMMIT,
          id: '123',
          project: ProjectFixture(),
          dateCreated: '',
          data: {
            commit: {
              dateCreated: '',
              message: '',
              id: 'komal-commit',
              repository: RepositoryFixture(),
              releases: [],
            },
          },
          user: UserFixture(),
        },
      ],
    });
    const activity = (await screen.findAllByTestId('activity-item')).at(-1);
    expect(activity).toHaveTextContent(
      'Foo Bar marked this issue as resolved in komal-commit'
    );
  });

  it('resolved in commit with one release', async function () {
    createWrapper({
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED_IN_COMMIT,
          id: '123',
          project: ProjectFixture(),
          dateCreated: '',
          data: {
            commit: {
              id: 'komal-commit',
              dateCreated: '',
              message: '',
              repository: RepositoryFixture(),
              releases: [
                ReleaseFixture({
                  dateCreated: '2022-05-01',
                  dateReleased: '2022-05-02',
                  version: 'random',
                }),
              ],
            },
          },
          user: UserFixture(),
        },
      ],
    });
    const activity = (await screen.findAllByTestId('activity-item')).at(-1);
    expect(activity).toHaveTextContent(
      'Foo Bar marked this issue as resolved in komal-commit This commit was released in random'
    );
  });

  it('resolved in commit with multiple releases', async function () {
    createWrapper({
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED_IN_COMMIT,
          id: '123',
          project: ProjectFixture(),
          dateCreated: '',
          data: {
            commit: {
              id: 'komal-commit',
              dateCreated: '',
              message: '',
              repository: RepositoryFixture(),
              releases: [
                ReleaseFixture({
                  dateCreated: '2022-05-01',
                  dateReleased: '2022-05-02',
                  version: 'random',
                }),
                ReleaseFixture({
                  dateCreated: '2022-06-01',
                  dateReleased: '2022-06-02',
                  version: 'newest',
                }),
                ReleaseFixture({
                  dateCreated: '2021-08-03',
                  dateReleased: '2021-08-03',
                  version: 'oldest-release',
                }),
                ReleaseFixture({
                  dateCreated: '2022-04-21',
                  dateReleased: '2022-04-21',
                  version: 'randomTwo',
                }),
              ],
            },
          },
          user: UserFixture(),
        },
      ],
    });
    const activity = (await screen.findAllByTestId('activity-item')).at(-1);
    expect(activity).toHaveTextContent(
      'Foo Bar marked this issue as resolved in komal-commit This commit was released in oldest-release and 3 others'
    );
  });

  it('requests assignees that are not in the team store', async function () {
    const team = TeamFixture({id: '123', name: 'workflow'});
    const teamRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/teams/`,
      body: [team],
    });
    createWrapper({
      activity: [
        {
          id: '123',
          user: null,
          type: GroupActivityType.ASSIGNED,
          project: ProjectFixture(),
          data: {
            assignee: team.id,
            assigneeType: 'team',
            user: UserFixture(),
          },
          dateCreated: '2021-10-28T13:40:10.634821Z',
        },
      ],
    });

    await waitFor(() => expect(teamRequest).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(`assigned this issue to #${team.slug}`)
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('activity-item').at(-1)).toHaveTextContent(
      /Sentry assigned this issue to #team-slug/
    );
  });

  describe('Delete', function () {
    let deleteMock: jest.Mock;

    beforeEach(function () {
      deleteMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/1337/comments/note-1/',
        method: 'DELETE',
      });
      ConfigStore.set('user', UserFixture({id: '123', isSuperuser: true}));
    });

    it('should remove remove the item from the GroupStore make a DELETE API request', async function () {
      createWrapper();
      renderGlobalModal();

      const commentActions = await screen.findByRole('button', {name: 'Comment Actions'});
      await userEvent.click(commentActions);
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Remove'}));
      expect(
        screen.getByText('Are you sure you wish to delete this comment?')
      ).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

      expect(deleteMock).toHaveBeenCalledTimes(1);
    });
  });

  it('renders archived until escalating', async function () {
    createWrapper({
      activity: [
        {
          id: '123',
          type: GroupActivityType.SET_IGNORED,
          project: ProjectFixture(),
          data: {
            ignoreUntilEscalating: true,
          },
          user: UserFixture(),
          dateCreated,
        },
      ],
    });
    const activity = (await screen.findAllByTestId('activity-item')).at(-1);
    expect(activity).toHaveTextContent('Foo Bar archived this issue until it escalates');
  });

  it('renders escalating with forecast and plural events', async function () {
    createWrapper({
      activity: [
        {
          id: '123',
          type: GroupActivityType.SET_UNRESOLVED,
          project: ProjectFixture(),
          data: {
            forecast: 200,
          },
          user: null,
          dateCreated,
        },
        {
          id: '124',
          type: GroupActivityType.SET_ESCALATING,
          project: ProjectFixture(),
          data: {
            forecast: 400,
          },
          user: null,
          dateCreated: '2021-10-05T15:31:38.950115Z',
        },
      ],
    });
    const activities = await screen.findAllByTestId('activity-item');
    expect(activities.at(-1)).toHaveTextContent(
      'Sentry flagged this issue as escalating because over 400 events happened in an hour'
    );
    expect(activities.at(-2)).toHaveTextContent(
      'Sentry flagged this issue as escalating because over 200 events happened in an hour'
    );
  });

  it('renders escalating with forecast and singular event', async function () {
    createWrapper({
      activity: [
        {
          id: '123',
          type: GroupActivityType.SET_UNRESOLVED,
          project: ProjectFixture(),
          data: {
            forecast: 1,
          },
          user: null,
          dateCreated,
        },
      ],
    });
    const activity = (await screen.findAllByTestId('activity-item')).at(-1);
    expect(activity).toHaveTextContent(
      'Sentry flagged this issue as escalating because over 1 event happened in an hour'
    );
  });

  it('renders issue unresvoled via jira', async function () {
    createWrapper({
      activity: [
        {
          id: '123',
          type: GroupActivityType.SET_UNRESOLVED,
          project: ProjectFixture(),
          data: {
            integration_id: '1',
            provider_key: 'jira',
            provider: 'Jira',
          },
          user: null,
          dateCreated,
        },
      ],
    });
    const activity = (await screen.findAllByTestId('activity-item')).at(-1);
    expect(activity).toHaveTextContent('Sentry marked this issue as unresolved via Jira');
  });

  it('renders issue resolved via jira', async function () {
    createWrapper({
      activity: [
        {
          id: '123',
          type: GroupActivityType.SET_RESOLVED,
          project: ProjectFixture(),
          data: {
            integration_id: '1',
            provider_key: 'jira',
            provider: 'Jira',
          },
          user: null,
          dateCreated,
        },
      ],
    });
    const activity = (await screen.findAllByTestId('activity-item')).at(-1);
    expect(activity).toHaveTextContent('Sentry marked this issue as resolved via Jira');
  });

  it('renders escalating since it happened x times in time window', async function () {
    createWrapper({
      activity: [
        {
          id: '123',
          type: GroupActivityType.SET_ESCALATING,
          project: ProjectFixture(),
          data: {
            expired_snooze: {
              count: 400,
              window: 1,
              until: null,
              user_count: null,
              user_window: null,
            },
          },
          dateCreated,
        },
      ],
    });
    const activity = (await screen.findAllByTestId('activity-item')).at(-1);
    expect(activity).toHaveTextContent(
      'Sentry flagged this issue as escalating because 400 events happened in 1 minute'
    );
  });

  it('renders escalating since x users were affected in time window', async function () {
    createWrapper({
      activity: [
        {
          id: '123',
          type: GroupActivityType.SET_ESCALATING,
          project: ProjectFixture(),
          data: {
            expired_snooze: {
              user_count: 1,
              user_window: 1,
              until: null,
              count: null,
              window: null,
            },
          },
          dateCreated,
        },
      ],
    });
    const activity = (await screen.findAllByTestId('activity-item')).at(-1);
    expect(activity).toHaveTextContent(
      'Sentry flagged this issue as escalating because 1 user was affected in 1 minute'
    );
  });

  it('renders escalating since until date passed', async function () {
    const date = new Date('2018-10-30');
    createWrapper({
      activity: [
        {
          id: '123',
          type: GroupActivityType.SET_ESCALATING,
          project: ProjectFixture(),
          data: {
            expired_snooze: {
              until: date,
              user_count: null,
              user_window: null,
              count: null,
              window: null,
            },
          },
          dateCreated,
        },
      ],
    });
    const activity = (await screen.findAllByTestId('activity-item')).at(-1);
    expect(activity).toHaveTextContent(
      'Sentry flagged this issue as escalating because Oct 30, 2018 12:00 AM passed'
    );
  });

  it('renders archived forever', async function () {
    createWrapper({
      activity: [
        {
          id: '123',
          type: GroupActivityType.SET_IGNORED,
          project: ProjectFixture(),
          data: {},
          user: UserFixture(),
          dateCreated,
        },
      ],
    });
    const activity = (await screen.findAllByTestId('activity-item')).at(-1);
    expect(activity).toHaveTextContent('Foo Bar archived this issue forever');
  });

  it('renders resolved in release with semver information', async function () {
    createWrapper({
      activity: [
        {
          id: '123',
          type: GroupActivityType.SET_RESOLVED_IN_RELEASE,
          project: ProjectFixture(),
          data: {
            version: 'frontend@1.0.0',
          },
          user: UserFixture(),
          dateCreated,
        },
      ],
    });
    const activity = (await screen.findAllByTestId('activity-item')).at(-1);
    expect(activity).toHaveTextContent(
      'Foo Bar marked this issue as resolved in 1.0.0 (semver)'
    );
  });

  it('renders resolved in next release with semver information', async function () {
    createWrapper({
      activity: [
        {
          id: '123',
          type: GroupActivityType.SET_RESOLVED_IN_RELEASE,
          project: ProjectFixture(),
          data: {
            current_release_version: 'frontend@1.0.0',
          },
          user: UserFixture(),
          dateCreated,
        },
      ],
    });
    const activity = (await screen.findAllByTestId('activity-item')).at(-1);
    expect(activity).toHaveTextContent(
      'Foo Bar marked this issue as resolved in releases greater than 1.0.0 (semver)'
    );
  });

  describe('regression', function () {
    it('renders basic regression', async function () {
      createWrapper({
        activity: [
          {
            id: '123',
            type: GroupActivityType.SET_REGRESSION,
            project: ProjectFixture(),
            data: {},
            dateCreated,
          },
        ],
      });
      const activity = (await screen.findAllByTestId('activity-item')).at(-1);
      expect(activity).toHaveTextContent('Sentry marked this issue as a regression');
    });

    it('renders regression with version', async function () {
      createWrapper({
        activity: [
          {
            id: '123',
            type: GroupActivityType.SET_REGRESSION,
            project: ProjectFixture(),
            data: {
              version: 'frontend@1.0.0',
            },
            dateCreated,
          },
        ],
      });
      const activity = (await screen.findAllByTestId('activity-item')).at(-1);
      expect(activity).toHaveTextContent(
        'Sentry marked this issue as a regression in 1.0.0'
      );
    });

    it('renders regression with semver description', async function () {
      createWrapper({
        activity: [
          {
            id: '123',
            type: GroupActivityType.SET_REGRESSION,
            project: ProjectFixture(),
            data: {
              version: 'frontend@2.0.0',
              resolved_in_version: 'frontend@1.0.0',
              follows_semver: true,
            },
            dateCreated,
          },
        ],
      });
      const activity = (await screen.findAllByTestId('activity-item')).at(-1);
      expect(activity).toHaveTextContent(
        'Sentry marked this issue as a regression in 2.0.0'
      );
      expect(activity).toHaveTextContent(
        '2.0.0 is greater than or equal to 1.0.0 compared via semver'
      );
    });

    it('renders regression with non-semver description', async function () {
      createWrapper({
        activity: [
          {
            id: '123',
            type: GroupActivityType.SET_REGRESSION,
            project: ProjectFixture(),
            data: {
              version: 'frontend@abc1',
              resolved_in_version: 'frontend@abc2',
              follows_semver: false,
            },
            dateCreated,
          },
        ],
      });
      const activity = (await screen.findAllByTestId('activity-item')).at(-1);
      expect(activity).toHaveTextContent(
        'Sentry marked this issue as a regression in abc1'
      );
      expect(activity).toHaveTextContent(
        'abc1 is greater than or equal to abc2 compared via release date'
      );
    });

    it('renders a set priority activity for escalating issues', async function () {
      createWrapper({
        activity: [
          {
            id: '123',
            type: GroupActivityType.SET_PRIORITY,
            project: ProjectFixture(),
            data: {
              priority: PriorityLevel.HIGH,
              reason: 'escalating',
            },
            dateCreated,
          },
        ],
      });
      const activity = (await screen.findAllByTestId('activity-item')).at(-1);
      expect(activity).toHaveTextContent(
        'Sentry updated the priority value of this issue to be high after it escalated'
      );
    });

    it('renders a set priority activity for ongoing issues', async function () {
      createWrapper({
        activity: [
          {
            id: '123',
            type: GroupActivityType.SET_PRIORITY,
            project: ProjectFixture(),
            data: {
              priority: PriorityLevel.LOW,
              reason: 'ongoing',
            },
            dateCreated,
          },
        ],
      });
      const activity = (await screen.findAllByTestId('activity-item')).at(-1);
      expect(activity).toHaveTextContent(
        'Sentry updated the priority value of this issue to be low after it was marked as ongoing'
      );
    });

    it('renders a deleted attachment activity', async function () {
      createWrapper({
        activity: [
          {
            id: '123',
            type: GroupActivityType.DELETED_ATTACHMENT,
            project: ProjectFixture(),
            data: {},
            dateCreated,
            user: UserFixture(),
          },
        ],
      });
      const activity = (await screen.findAllByTestId('activity-item')).at(-1);
      expect(activity).toHaveTextContent('deleted an attachment');
    });
  });
});
