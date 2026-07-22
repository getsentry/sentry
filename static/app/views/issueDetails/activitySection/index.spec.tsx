import {CommitFixture} from 'sentry-fixture/commit';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {PullRequestFixture} from 'sentry-fixture/pullRequest';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {ConfigStore} from 'sentry/stores/configStore';
import {GroupStore} from 'sentry/stores/groupStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TeamStore} from 'sentry/stores/teamStore';
import type {GroupActivity} from 'sentry/types/group';
import {GroupActivityType, PriorityLevel} from 'sentry/types/group';
import {RepositoryStatus} from 'sentry/types/integrations';
import {ActivitySection} from 'sentry/views/issueDetails/activitySection';
import {GroupDataContextProvider} from 'sentry/views/issueDetails/groupDataContext';

describe('ActivitySection', () => {
  const project = ProjectFixture();
  const user = UserFixture();
  const tenMinutesAgo = () => new Date(Date.now() - 10 * 60 * 1000).toISOString();
  user.options.prefersIssueDetailsStreamlinedUI = true;
  ConfigStore.set('user', user);

  ProjectsStore.loadInitialData([project]);
  GroupStore.init();

  const group = GroupFixture({
    id: '1337',
    activity: [
      {
        type: GroupActivityType.NOTE,
        id: 'note-1',
        data: {text: 'Test Note'},
        dateCreated: '2020-01-01T00:00:00',
        user,
      },
    ],
    project,
  });

  GroupStore.add([group]);

  beforeEach(() => {
    jest.restoreAllMocks();
    TeamStore.reset();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });
    localStorage.clear();
  });

  it('renders the input with a comment button', async () => {
    const comment = 'nice work friends';
    const postMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/comments/',
      method: 'POST',
      body: {
        id: 'note-2',
        user: UserFixture({id: '2'}),
        type: 'note',
        data: {text: comment},
        dateCreated: '2024-10-31T00:00:00.000000Z',
      },
    });

    render(
      <GroupDataContextProvider group={group} project={group.project}>
        <ActivitySection group={group} />
      </GroupDataContextProvider>
    );

    const commentInput = screen.getByPlaceholderText('Add a comment…');
    expect(commentInput).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {name: 'Submit comment'})
    ).not.toBeInTheDocument();

    await userEvent.click(commentInput);

    const submitButton = screen.getByRole('button', {name: 'Submit comment'});
    expect(submitButton).toBeInTheDocument();

    expect(submitButton).toBeDisabled();
    await userEvent.type(commentInput, comment);
    expect(submitButton).toBeEnabled();

    await userEvent.click(submitButton);
    expect(postMock).toHaveBeenCalled();
  });

  it('allows submitting the comment field with hotkeys', async () => {
    const comment = 'nice work friends';
    const postMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/comments/',
      method: 'POST',
      body: {
        id: 'note-3',
        user: UserFixture({id: '2'}),
        type: 'note',
        data: {text: comment},
        dateCreated: '2024-10-31T00:00:00.000000Z',
      },
    });

    render(
      <GroupDataContextProvider group={group} project={group.project}>
        <ActivitySection group={group} />
      </GroupDataContextProvider>
    );

    const commentInput = screen.getByPlaceholderText('Add a comment…');
    await userEvent.type(commentInput, comment);
    await userEvent.keyboard('{Meta>}{Enter}{/Meta}');
    expect(postMock).toHaveBeenCalled();
  });

  it('uses loaded members for mentions in the drawer comment input', async () => {
    const mentionedUser = UserFixture({id: '42', name: 'Jane Doe'});
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [{user: mentionedUser}],
    });
    const postMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/comments/',
      method: 'POST',
      body: {
        id: 'note-4',
        user: UserFixture({id: '2'}),
        type: 'note',
        data: {text: '@Jane Doe'},
        dateCreated: '2024-10-31T00:00:00.000000Z',
      },
    });

    render(
      <GroupDataContextProvider group={group} project={group.project}>
        <ActivitySection group={group} variant="standalone" size="md" />
      </GroupDataContextProvider>
    );

    await userEvent.type(screen.getByPlaceholderText('Add a comment…'), '@jane');
    await userEvent.click(await screen.findByRole('option', {name: 'Jane Doe'}));
    await userEvent.click(screen.getByRole('button', {name: 'Comment'}));

    expect(postMock).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/1337/comments/',
      expect.objectContaining({
        method: 'POST',
        data: {
          text: '**@Jane Doe** ',
          mentions: ['user:42'],
        },
      })
    );
  });

  it('renders note and allows for delete', async () => {
    jest.spyOn(indicators, 'addSuccessMessage');

    const deleteMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/comments/note-1/',
      method: 'DELETE',
    });

    render(
      <GroupDataContextProvider group={group} project={group.project}>
        <ActivitySection group={group} />
      </GroupDataContextProvider>
    );
    renderGlobalModal();
    expect(await screen.findByText('Test Note')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Comment Actions'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Comment Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Remove'}));

    expect(
      screen.getByText('Are you sure you want to remove this comment?')
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Remove comment'}));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1));
    expect(indicators.addSuccessMessage).toHaveBeenCalledWith('Comment removed');
  });

  it('keeps the comment and modal open when deletion fails', async () => {
    const errorGroup = GroupFixture({
      id: '1400',
      activity: [
        {
          type: GroupActivityType.NOTE,
          id: 'note-1',
          data: {text: 'Undeletable Note'},
          dateCreated: '2020-01-01T00:00:00',
          user,
        },
      ],
      project,
    });
    GroupStore.add([errorGroup]);
    const deleteMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1400/comments/note-1/',
      method: 'DELETE',
      statusCode: 500,
    });

    render(
      <GroupDataContextProvider group={errorGroup} project={errorGroup.project}>
        <ActivitySection group={errorGroup} />
      </GroupDataContextProvider>
    );
    renderGlobalModal();
    expect(await screen.findByText('Undeletable Note')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Comment Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Remove'}));
    await userEvent.click(screen.getByRole('button', {name: 'Remove comment'}));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(1));

    // The modal stays open with an error, and the comment is still present.
    expect(await screen.findByText('Failed to remove comment')).toBeInTheDocument();
    expect(screen.getByText('Undeletable Note')).toBeInTheDocument();
  });

  it('renders note markdown', async () => {
    const activityGroup = GroupFixture({
      id: '1338',
      activity: [
        {
          type: GroupActivityType.NOTE,
          id: 'note-1',
          data: {text: '**Bold Note** and [docs](https://docs.sentry.io/)'},
          dateCreated: tenMinutesAgo(),
          user,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={activityGroup} project={activityGroup.project}>
        <ActivitySection group={activityGroup} />
      </GroupDataContextProvider>
    );

    expect(await screen.findByTestId('activity-note-body')).toContainElement(
      screen.getByText('Bold Note').closest('strong')
    );
    expect(screen.getByRole('link', {name: 'docs'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/'
    );
    expect(screen.getByText('10min ago')).toBeInTheDocument();
  });

  it('renders activity actor markers', async () => {
    const activityGroup = GroupFixture({
      id: '1338',
      activity: [
        {
          type: GroupActivityType.NOTE,
          id: 'note-1',
          data: {text: 'User note'},
          dateCreated: '2020-01-01T00:00:00',
          user,
        },
        {
          type: GroupActivityType.SET_RESOLVED,
          id: 'resolved-1',
          data: {},
          dateCreated: '2020-01-02T00:00:00',
          user: null,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={activityGroup} project={activityGroup.project}>
        <ActivitySection group={activityGroup} />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );

    expect(await screen.findByText('User note')).toBeInTheDocument();
    expect(screen.getByText(`${user.name} commented`)).toBeInTheDocument();
    expect(screen.getByTestId('user-activity-actor')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Comment Actions'})).toBeInTheDocument();
  });

  it('renders provider-specific icon for create issue in activity line items', async () => {
    const createIssueGroup = GroupFixture({
      id: '1345',
      activity: [
        {
          type: GroupActivityType.CREATE_ISSUE,
          id: 'create-issue-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            provider: 'GitHub',
            location: 'https://github.com/org/repo/issues/1',
            title: 'Test Issue',
          },
          user,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider
        group={createIssueGroup}
        project={createIssueGroup.project}
      >
        <ActivitySection group={createIssueGroup} />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );

    expect(await screen.findByText('Test Issue')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-add')).not.toBeInTheDocument();
  });

  it('renders create issue title based on whether the external issue is new', async () => {
    const createIssueGroup = GroupFixture({
      id: '1346',
      activity: [
        {
          type: GroupActivityType.CREATE_ISSUE,
          id: 'create-issue-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            provider: 'GitHub',
            location: 'https://github.com/org/repo/issues/1',
            title: 'Created external issue',
            new: true,
          },
          user,
        },
        {
          type: GroupActivityType.CREATE_ISSUE,
          id: 'link-issue-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            provider: 'GitHub',
            location: 'https://github.com/org/repo/issues/2',
            title: 'Linked external issue',
            new: false,
          },
          user,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider
        group={createIssueGroup}
        project={createIssueGroup.project}
      >
        <ActivitySection group={createIssueGroup} />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );

    expect(await screen.findByText('Created GitHub issue')).toBeInTheDocument();
    expect(screen.getByText('Created external issue')).toBeInTheDocument();
    expect(screen.getByText('Linked GitHub issue')).toBeInTheDocument();
    expect(screen.getByText('Linked external issue')).toBeInTheDocument();
  });

  it('renders team assignment in activity line items when team id matches the actor id', async () => {
    const assigningUser = UserFixture({id: '1', name: 'Taylor'});
    const team = TeamFixture({id: assigningUser.id, slug: 'frontend'});
    const teamRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: [team],
    });
    TeamStore.loadInitialData([team]);

    const assignedGroup = GroupFixture({
      id: '1347',
      activity: [
        {
          type: GroupActivityType.ASSIGNED,
          id: 'team-assignment-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            assignee: team.id,
            assigneeType: 'team',
          },
          user: assigningUser,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={assignedGroup} project={assignedGroup.project}>
        <ActivitySection group={assignedGroup} />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );

    const timeline = await screen.findByTestId('activity-timeline');
    expect(timeline).toHaveTextContent('Assigned');
    expect(timeline).toHaveTextContent('#frontend');
    expect(teamRequest).not.toHaveBeenCalled();
  });

  it('loads an assigned team missing from the team store', async () => {
    const team = TeamFixture({
      id: '123',
      slug: 'backend',
      avatar: {
        avatarType: 'upload',
        avatarUrl: 'https://example.com/team-avatar.jpg',
        avatarUuid: '123',
      },
    });
    const teamRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: [team],
    });
    TeamStore.loadInitialData([]);

    const assignedGroup = GroupFixture({
      id: '1347',
      activity: [
        {
          type: GroupActivityType.ASSIGNED,
          id: 'team-assignment-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            assignee: team.id,
            assigneeName: team.name,
            assigneeType: 'team',
          },
          user,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={assignedGroup} project={assignedGroup.project}>
        <ActivitySection group={assignedGroup} />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );

    expect(await screen.findByRole('img', {name: 'backend'})).toHaveAttribute(
      'src',
      'https://example.com/team-avatar.jpg?s=120'
    );
    expect(teamRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({query: {query: 'id:123'}})
    );
  });

  it('renders the stored name for a deleted team assignment', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/teams/',
      body: [],
    });
    TeamStore.loadInitialData([]);

    const assignedGroup = GroupFixture({
      id: '1347',
      activity: [
        {
          type: GroupActivityType.ASSIGNED,
          id: 'deleted-team-assignment',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            assignee: '123',
            assigneeName: 'frontend',
            assigneeType: 'team',
          },
          user,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={assignedGroup} project={assignedGroup.project}>
        <ActivitySection group={assignedGroup} />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );

    expect(await screen.findByText('#frontend (deleted)')).toBeInTheDocument();
  });

  it('preserves the assigned user avatar from activity data', async () => {
    const assignedUser = UserFixture({
      id: '123',
      name: 'David Cramer',
      avatar: {
        avatarType: 'upload',
        avatarUrl: 'https://example.com/avatar.jpg',
        avatarUuid: '123',
      },
    });
    const assignedGroup = GroupFixture({
      id: '1347',
      activity: [
        {
          type: GroupActivityType.ASSIGNED,
          id: 'user-assignment-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            assignee: assignedUser.id,
            assigneeType: 'user',
            user: assignedUser,
          },
          user,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={assignedGroup} project={assignedGroup.project}>
        <ActivitySection group={assignedGroup} />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );

    expect(await screen.findByRole('img', {name: 'David Cramer'})).toHaveAttribute(
      'src',
      'https://example.com/avatar.jpg?s=120'
    );
  });

  it('shows ownership assignment rules in an info tooltip', async () => {
    const rule = 'path:src/** #frontend';
    const assignedGroup = GroupFixture({
      id: '1347',
      activity: [
        {
          type: GroupActivityType.ASSIGNED,
          id: 'ownership-assignment-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            assignee: '123',
            assigneeName: 'David Cramer',
            assigneeType: 'user',
            integration: 'projectOwnership',
            rule,
          },
          user,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={assignedGroup} project={assignedGroup.project}>
        <ActivitySection group={assignedGroup} />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );

    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByText('David Cramer')).toBeInTheDocument();
    expect(screen.getByText('Ownership Rule')).toBeInTheDocument();

    await userEvent.hover(screen.getByText('Ownership Rule'));
    expect(await screen.findByText(rule)).toBeInTheDocument();
  });

  it('renders auto-resolved activity age as an inactivity duration', async () => {
    const autoResolvedGroup = GroupFixture({
      id: '1347',
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED_BY_AGE,
          id: 'set-resolved-by-age-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {age: 504},
          user: null,
        },
        {
          type: GroupActivityType.SET_RESOLVED_BY_AGE,
          id: 'set-resolved-by-age-2',
          dateCreated: '2020-01-02T00:00:00',
          data: {age: 11},
          user: null,
        },
        {
          type: GroupActivityType.SET_RESOLVED_BY_AGE,
          id: 'set-resolved-by-age-3',
          dateCreated: '2020-01-03T00:00:00',
          data: {age: 30},
          user: null,
        },
        {
          type: GroupActivityType.SET_RESOLVED_BY_AGE,
          id: 'set-resolved-by-age-4',
          dateCreated: '2020-01-04T00:00:00',
          data: {age: '48'},
          user: null,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider
        group={autoResolvedGroup}
        project={autoResolvedGroup.project}
      >
        <ActivitySection group={autoResolvedGroup} />
      </GroupDataContextProvider>
    );

    expect(await screen.findByText(/after 21 days of inactivity/)).toBeInTheDocument();
    expect(screen.getByText(/after 11 hours of inactivity/)).toBeInTheDocument();
    expect(screen.getByText(/after 30 hours of inactivity/)).toBeInTheDocument();
    expect(screen.getByText(/after 2 days of inactivity/)).toBeInTheDocument();
  });

  it('renders note and allows for edit', async () => {
    jest.spyOn(indicators, 'addSuccessMessage');

    const editGroup = GroupFixture({
      id: '1123',
      activity: [
        {
          type: GroupActivityType.NOTE,
          id: 'note-1',
          data: {text: 'Group Test'},
          dateCreated: '2020-01-01T00:00:00',
          user,
        },
      ],
      project,
    });
    const editMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1123/comments/note-1/',
      method: 'PUT',
      body: {
        id: 'note-1',
        data: {text: 'Group Test Updated'},
      },
    });

    render(
      <GroupDataContextProvider group={editGroup} project={editGroup.project}>
        <ActivitySection group={editGroup} />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );
    expect(await screen.findByText('Group Test')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Comment Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Edit'}));

    await userEvent.type(screen.getByDisplayValue('Group Test'), ' Updated');
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(editMock).not.toHaveBeenCalled();

    expect(await screen.findByText('Group Test')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Comment Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Edit'}));

    await userEvent.type(screen.getByDisplayValue('Group Test'), ' Updated');
    await userEvent.click(screen.getByRole('button', {name: 'Save comment'}));

    await waitFor(() => expect(editMock).toHaveBeenCalledTimes(1));
    expect(indicators.addSuccessMessage).toHaveBeenCalledWith('Comment updated');

    // Editor closes only after the update succeeds.
    await waitFor(() =>
      expect(screen.queryByRole('button', {name: 'Save comment'})).not.toBeInTheDocument()
    );
  });

  it('renders note from a sentry app', async () => {
    const newUser = UserFixture({name: 'sentry-app-proxy-user-abcd123'});
    const sentryApp = SentryAppFixture({
      name: 'Bug Bot',
      avatars: [
        {
          avatarType: 'upload',
          avatarUrl: 'https://example.com/avatar.png',
          avatarUuid: '1234567890',
          photoType: 'icon',
          color: true,
        },
      ],
    });
    const newGroup = GroupFixture({
      activity: [
        {
          type: GroupActivityType.NOTE,
          id: 'note-1',
          data: {text: 'This note came from my sentry app'},
          dateCreated: '2020-01-01T00:00:00',
          sentry_app: sentryApp,
          user: newUser,
        },
      ],
    });

    render(
      <GroupDataContextProvider group={newGroup} project={newGroup.project}>
        <ActivitySection group={newGroup} />
      </GroupDataContextProvider>
    );
    expect(
      await screen.findByText('This note came from my sentry app')
    ).toBeInTheDocument();
    expect(screen.getByTestId('upload-avatar')).toBeInTheDocument();
    expect(screen.getByText(sentryApp.name)).toBeInTheDocument();
    // We should not show the user, if a sentry app is attached
    expect(screen.queryByText(newUser.name)).not.toBeInTheDocument();
  });

  it('renders note but does not allow for deletion if written by someone else', async () => {
    const updatedActivityGroup = GroupFixture({
      id: '1338',
      activity: [
        {
          type: GroupActivityType.NOTE,
          id: 'note-1',
          data: {text: 'Test Note'},
          dateCreated: '2020-01-01T00:00:00',
          user: UserFixture({id: '2'}),
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider
        group={updatedActivityGroup}
        project={updatedActivityGroup.project}
      >
        <ActivitySection group={updatedActivityGroup} />
      </GroupDataContextProvider>
    );
    expect(await screen.findByText('Test Note')).toBeInTheDocument();

    expect(
      screen.queryByRole('button', {name: 'Comment Actions'})
    ).not.toBeInTheDocument();
  });

  it('collapses activity when there are more than 5 items', async () => {
    const activities: GroupActivity[] = Array.from({length: 7}, (_, index) => ({
      type: GroupActivityType.NOTE,
      id: `note-${index + 1}`,
      data: {text: `Test Note ${index + 1}`},
      dateCreated: '2020-01-01T00:00:00',
      user: UserFixture({id: '2'}),
      project,
    }));

    const updatedActivityGroup = GroupFixture({
      id: '1338',
      activity: activities,
      project,
    });

    render(
      <GroupDataContextProvider
        group={updatedActivityGroup}
        project={updatedActivityGroup.project}
      >
        <ActivitySection group={updatedActivityGroup} />
      </GroupDataContextProvider>
    );
    expect(await screen.findByText('Test Note 1')).toBeInTheDocument();
    expect(await screen.findByText('Test Note 3')).toBeInTheDocument();
    expect(screen.queryByText('Test Note 7')).not.toBeInTheDocument();
    expect(await screen.findByText('View 4 more')).toBeInTheDocument();
  });

  it('shows an expand link when activity does not collapse', async () => {
    const activities: GroupActivity[] = Array.from({length: 3}, (_, index) => ({
      type: GroupActivityType.NOTE,
      id: `note-${index + 1}`,
      data: {text: `Test Note ${index + 1}`},
      dateCreated: '2020-01-01T00:00:00',
      user: UserFixture({id: '2'}),
      project,
    }));

    const updatedActivityGroup = GroupFixture({
      id: '1338',
      activity: activities,
      project,
    });

    render(
      <GroupDataContextProvider
        group={updatedActivityGroup}
        project={updatedActivityGroup.project}
      >
        <ActivitySection group={updatedActivityGroup} />
      </GroupDataContextProvider>
    );

    for (const activity of activities) {
      expect(
        await screen.findByText((activity.data as {text: string}).text)
      ).toBeInTheDocument();
    }

    expect(screen.getByRole('button', {name: 'View all activity'})).toHaveTextContent(
      'Expand'
    );
    expect(screen.queryByText(/View \d+ more/)).not.toBeInTheDocument();
  });

  it('does not collapse activity when rendered in the drawer', async () => {
    const activities: GroupActivity[] = Array.from({length: 7}, (_, index) => ({
      type: GroupActivityType.NOTE,
      id: `note-${index + 1}`,
      data: {text: `Test Note ${index + 1}`},
      dateCreated: tenMinutesAgo(),
      user: UserFixture({id: '2'}),
      project,
    }));

    const updatedActivityGroup = GroupFixture({
      id: '1338',
      activity: activities,
      project,
    });

    render(
      <GroupDataContextProvider
        group={updatedActivityGroup}
        project={updatedActivityGroup.project}
      >
        <ActivitySection group={updatedActivityGroup} variant="standalone" size="md" />
      </GroupDataContextProvider>
    );

    for (const activity of activities) {
      expect(
        await screen.findByText((activity.data as {text: string}).text)
      ).toBeInTheDocument();
    }

    expect(screen.queryByText('View 4 more')).not.toBeInTheDocument();
    expect(screen.getAllByText('10 minutes ago')).toHaveLength(7);
    expect(screen.queryByText('10m ago')).not.toBeInTheDocument();
  });

  it('filters comments correctly', async () => {
    const activities: GroupActivity[] = Array.from({length: 3}, (_, index) => ({
      type: GroupActivityType.NOTE,
      id: `note-${index + 1}`,
      data: {text: `Test Note ${index + 1}`},
      dateCreated: '2020-01-01T00:00:00',
      user: UserFixture({id: '2'}),
      project,
    }));

    activities.push({
      type: GroupActivityType.SET_RESOLVED,
      id: 'resolved-1',
      data: {text: 'Resolved'},
      dateCreated: '2020-01-01T00:00:00',
      user,
    });

    const updatedActivityGroup = GroupFixture({
      id: '1338',
      activity: activities,
      project,
    });

    render(
      <GroupDataContextProvider
        group={updatedActivityGroup}
        project={updatedActivityGroup.project}
      >
        <ActivitySection
          group={updatedActivityGroup}
          variant="standalone"
          size="md"
          filterComments
        />
      </GroupDataContextProvider>
    );

    for (const activity of activities) {
      if (activity.type === GroupActivityType.SET_RESOLVED) {
        expect(screen.queryByText('Resolved')).not.toBeInTheDocument();
      } else {
        expect(
          await screen.findByText((activity.data as {text: string}).text)
        ).toBeInTheDocument();
      }
    }
  });

  it.each<{
    activity: GroupActivity;
    expectedCopy: Array<RegExp | string>;
    name: string;
  }>([
    {
      name: 'automatic ongoing',
      activity: {
        type: GroupActivityType.AUTO_SET_ONGOING,
        id: 'auto-ongoing-1',
        dateCreated: '2020-01-01T00:00:00',
        data: {after_days: 7},
      } satisfies GroupActivity,
      expectedCopy: ['Became ongoing', 'after 7 days'],
    },
    {
      name: 'priority changed after becoming ongoing',
      activity: {
        type: GroupActivityType.SET_PRIORITY,
        id: 'priority-ongoing-1',
        dateCreated: '2020-01-01T00:00:00',
        data: {priority: PriorityLevel.MEDIUM, reason: 'ongoing'},
      } satisfies GroupActivity,
      expectedCopy: ['Priority set', 'Med', /after becoming ongoing/],
    },
    {
      name: 'priority changed after escalating',
      activity: {
        type: GroupActivityType.SET_PRIORITY,
        id: 'priority-escalating-1',
        dateCreated: '2020-01-01T00:00:00',
        data: {priority: PriorityLevel.HIGH, reason: 'escalating'},
      } satisfies GroupActivity,
      expectedCopy: ['Priority set', 'High', /when it escalated/],
    },
    {
      name: 'forecast escalation',
      activity: {
        type: GroupActivityType.SET_ESCALATING,
        id: 'escalating-1',
        dateCreated: '2020-01-01T00:00:00',
        data: {forecast: 4470},
      } satisfies GroupActivity,
      expectedCopy: ['Escalated', 'after more than 4470 events in an hour'],
    },
    {
      name: 'archive expiration escalation',
      activity: {
        type: GroupActivityType.SET_ESCALATING,
        id: 'escalating-expired-archive-1',
        dateCreated: '2020-01-01T00:00:00',
        data: {
          expired_snooze: {
            count: 50,
            until: null,
            user_count: null,
            user_window: null,
            window: 10,
          },
        },
      } satisfies GroupActivity,
      expectedCopy: ['Escalated', /after reaching 50 events within/, '10 minutes'],
    },
    {
      name: 'event threshold archive',
      activity: {
        type: GroupActivityType.SET_IGNORED,
        id: 'archived-event-threshold-1',
        dateCreated: '2020-01-01T00:00:00',
        data: {ignoreCount: 50, ignoreWindow: 10},
      } satisfies GroupActivity,
      expectedCopy: ['Archived', /until 50 events occur within/, '10 minutes'],
    },
    {
      name: 'next release resolution',
      activity: {
        type: GroupActivityType.SET_RESOLVED_IN_RELEASE,
        id: 'resolved-in-next-release-1',
        dateCreated: '2020-01-01T00:00:00',
        data: {current_release_version: 'frontend@1.0.0'},
        user,
      } satisfies GroupActivity,
      expectedCopy: ['Resolved', /starting with a release after/, '1.0.0'],
    },
    {
      name: 'SemVer regression',
      activity: {
        type: GroupActivityType.SET_REGRESSION,
        id: 'regressed-release-1',
        dateCreated: '2020-01-01T00:00:00',
        data: {
          version: 'frontend@1.1.0',
          resolved_in_version: 'frontend@1.0.0',
          follows_semver: true,
        },
      } satisfies GroupActivity,
      expectedCopy: ['Regressed', /compared with/, /based on SemVer/],
    },
    {
      name: 'Seer pull request creation',
      activity: {
        type: GroupActivityType.SEER_PR_CREATED,
        id: 'seer-pr-created-1',
        dateCreated: '2020-01-01T00:00:00',
        data: {
          pull_requests: [
            {
              provider: 'github',
              pull_request: {
                pr_number: 42,
                pr_url: 'https://github.com/org/repo/pull/42',
              },
              repo_name: 'org/repo',
            },
          ],
        },
      } satisfies GroupActivity,
      expectedCopy: [/Pull request.*created/, '#42', 'on GitHub'],
    },
    {
      name: 'Seer pull request update',
      activity: {
        type: GroupActivityType.SEER_ITERATION_COMPLETED,
        id: 'seer-pr-updated-1',
        dateCreated: '2020-01-01T00:00:00',
        data: {
          pull_requests: [
            {
              provider: 'github',
              pull_request: {
                pr_number: 42,
                pr_url: 'https://github.com/org/repo/pull/42',
              },
              repo_name: 'org/repo',
            },
          ],
        },
      } satisfies GroupActivity,
      expectedCopy: [/Pull request.*updated/, '#42', 'on GitHub'],
    },
  ])('renders $name v2 activity copy', async ({activity, expectedCopy}) => {
    const activityGroup = GroupFixture({
      id: '1339',
      activity: [activity],
      project,
    });

    render(
      <GroupDataContextProvider group={activityGroup} project={activityGroup.project}>
        <ActivitySection group={activityGroup} variant="standalone" size="md" />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({
          features: [
            'display-seer-actions-as-issue-activities',
            'issue-activity-feed-v2',
          ],
        }),
      }
    );

    for (const copy of expectedCopy) {
      expect(await screen.findByText(copy)).toBeInTheDocument();
    }
  });

  it('renders reprocessed events as a linked activity update', () => {
    const activityGroup = GroupFixture({
      id: '1339',
      activity: [
        {
          type: GroupActivityType.REPROCESS,
          id: 'reprocessed-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {eventCount: 4, newGroupId: 2, oldGroupId: 1},
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={activityGroup} project={activityGroup.project}>
        <ActivitySection group={activityGroup} variant="standalone" size="md" />
      </GroupDataContextProvider>,
      {organization: OrganizationFixture({features: ['issue-activity-feed-v2']})}
    );

    expect(screen.getByText('Reprocessed')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '4 new events'})).toBeInTheDocument();
    expect(screen.getByRole('img', {name: 'Activity update'})).toBeInTheDocument();
  });

  it('shows progress markers behind activity progress', () => {
    const activityGroup = GroupFixture({
      id: '1339',
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED,
          id: 'resolved-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {},
          user,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={activityGroup} project={activityGroup.project}>
        <ActivitySection group={activityGroup} variant="standalone" size="md" />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({
          features: ['issue-activity-feed-v2', 'issue-activity-progress'],
        }),
      }
    );

    expect(screen.getByRole('img', {name: 'Fix Applied'})).toBeInTheDocument();
    expect(screen.getByTestId('user-activity-actor')).toBeInTheDocument();
  });

  it.each([
    {
      name: 'deleted attachments',
      activity: {
        type: GroupActivityType.DELETED_ATTACHMENT,
        id: 'deleted-attachment-1',
        dateCreated: '2020-01-01T00:00:00',
        data: {},
      } satisfies GroupActivity,
      copy: 'Deleted an attachment',
    },
    {
      name: 'reviewed issues',
      activity: {
        type: GroupActivityType.MARK_REVIEWED,
        id: 'reviewed-1',
        dateCreated: '2020-01-01T00:00:00',
        data: {},
      } satisfies GroupActivity,
      copy: 'Reviewed',
    },
  ])('renders $name as general activity updates', ({activity, copy}) => {
    const activityGroup = GroupFixture({id: '1339', activity: [activity], project});

    render(
      <GroupDataContextProvider group={activityGroup} project={activityGroup.project}>
        <ActivitySection group={activityGroup} variant="standalone" size="md" />
      </GroupDataContextProvider>,
      {organization: OrganizationFixture({features: ['issue-activity-feed-v2']})}
    );

    expect(screen.getByText(copy)).toBeInTheDocument();
    expect(screen.getByRole('img', {name: 'Activity update'})).toBeInTheDocument();
  });

  it('renders resolved in release with integration', async () => {
    const resolvedGroup = GroupFixture({
      id: '1339',
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED_IN_RELEASE,
          id: 'resolved-in-release-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            version: 'frontend@1.0.0',
            integration_id: 408,
            provider: 'Jira Server',
            provider_key: 'jira_server',
          },
          user,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={resolvedGroup} project={resolvedGroup.project}>
        <ActivitySection group={resolvedGroup} />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );
    expect(await screen.findByTestId('activity-timeline')).toHaveTextContent(
      'Resolved in 1.0.0 via Jira Server'
    );
    expect(screen.getByRole('link', {name: '1.0.0'})).toBeInTheDocument();
    const integrationLink = screen.getByRole('link', {name: 'Jira Server'});
    expect(within(integrationLink).getByRole('img')).toBeInTheDocument();
  });

  it('renders resolved in release without integration', async () => {
    const resolvedGroup = GroupFixture({
      id: '1340',
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED_IN_RELEASE,
          id: 'resolved-in-release-2',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            version: 'frontend@1.0.0',
          },
          user,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={resolvedGroup} project={resolvedGroup.project}>
        <ActivitySection group={resolvedGroup} />
      </GroupDataContextProvider>
    );
    expect(await screen.findByText('Resolved')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '1.0.0'})).toBeInTheDocument();
  });

  it('prefers the pull request for resolved release activity line items', async () => {
    const repository = RepositoryFixture({
      name: 'example/repository',
      provider: {id: 'integrations:github', name: 'GitHub'},
      url: 'https://github.com/example/repository',
    });
    const pullRequest = PullRequestFixture({
      id: '1234',
      externalUrl: 'https://github.com/example/repository/pull/1234',
      repository,
    });
    const resolvedGroup = GroupFixture({
      id: 'resolved-release-line-item-with-pr',
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED_IN_RELEASE,
          id: 'resolved-release-line-item-with-pr-activity',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            version: 'frontend@1.0.0',
            commit: CommitFixture({
              id: 'f7f395d14b2fe29a4e253bf1d3094d61e6ad4434',
              pullRequest,
              repository,
            }),
          },
          user,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={resolvedGroup} project={resolvedGroup.project}>
        <ActivitySection group={resolvedGroup} />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );

    expect(await screen.findByTestId('activity-timeline')).toHaveTextContent(
      'Resolved in 1.0.0 via #1234'
    );
    expect(screen.getByRole('link', {name: '#1234'})).toHaveAttribute(
      'href',
      pullRequest.externalUrl
    );
  });

  it('falls back to the commit for resolved release activity line items', async () => {
    const repository = RepositoryFixture({
      name: 'example/repository',
      provider: {id: 'integrations:github', name: 'GitHub'},
      url: 'https://github.com/example/repository',
    });
    const resolvedGroup = GroupFixture({
      id: 'resolved-release-line-item-with-commit',
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED_IN_RELEASE,
          id: 'resolved-release-line-item-with-commit-activity',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            version: 'frontend@1.0.0',
            commit: CommitFixture({
              id: 'f7f395d14b2fe29a4e253bf1d3094d61e6ad4434',
              pullRequest: null,
              repository,
            }),
          },
          user,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={resolvedGroup} project={resolvedGroup.project}>
        <ActivitySection group={resolvedGroup} />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );

    expect(await screen.findByTestId('activity-timeline')).toHaveTextContent(
      'Resolved in 1.0.0 via f7f395d'
    );
    expect(screen.getByRole('link', {name: 'f7f395d'})).toHaveAttribute(
      'href',
      'https://github.com/example/repository/commit/f7f395d14b2fe29a4e253bf1d3094d61e6ad4434'
    );
  });

  it('renders referenced in commit activity', async () => {
    const referencedGroup = GroupFixture({
      id: '1341',
      activity: [
        {
          type: GroupActivityType.REFERENCED_IN_COMMIT,
          id: 'referenced-in-commit-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            commit: CommitFixture({
              id: 'f7f395d14b2fe29a4e253bf1d3094d61e6ad4434',
            }),
          },
          user,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={referencedGroup} project={referencedGroup.project}>
        <ActivitySection group={referencedGroup} />
      </GroupDataContextProvider>
    );
    expect(await screen.findByText('Referenced in Commit')).toBeInTheDocument();
    expect(screen.getByText('f7f395d')).toBeInTheDocument();
  });

  it('links a referenced commit activity line item to its pull request', async () => {
    const repository = RepositoryFixture({
      name: 'example/repository',
      provider: {id: 'integrations:github', name: 'GitHub'},
      url: 'https://github.com/example/repository',
    });
    const pullRequest = PullRequestFixture({
      id: '1234',
      externalUrl: 'https://github.com/example/repository/pull/1234',
      repository,
    });
    const referencedGroup = GroupFixture({
      id: 'referenced-commit-line-item-with-pr',
      activity: [
        {
          type: GroupActivityType.REFERENCED_IN_COMMIT,
          id: 'referenced-commit-line-item-with-pr-activity',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            commit: CommitFixture({
              id: 'f7f395d14b2fe29a4e253bf1d3094d61e6ad4434',
              pullRequest,
              repository,
            }),
          },
          user,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={referencedGroup} project={referencedGroup.project}>
        <ActivitySection group={referencedGroup} />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );

    expect(await screen.findByTestId('activity-timeline')).toHaveTextContent(
      'Referenced in f7f395d on GitHub via #1234'
    );
    expect(screen.getByRole('link', {name: 'f7f395d'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '#1234'})).toHaveAttribute(
      'href',
      pullRequest.externalUrl
    );
  });

  it('prefers commit repository details for resolved commit activity line items', async () => {
    const commitRepository = RepositoryFixture({
      name: 'getsentry/sentry',
      provider: {id: 'integrations:github', name: 'GitHub'},
      url: 'https://github.com/getsentry/sentry',
    });
    const pullRequestRepository = RepositoryFixture({
      name: 'getsentry/seer',
      provider: {id: 'integrations:gitlab', name: 'GitLab'},
      url: 'https://gitlab.com/getsentry/seer',
    });
    const resolvedCommitGroup = GroupFixture({
      id: '1352',
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED_IN_COMMIT,
          id: 'resolved-commit-prefers-commit-repository',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            commit: CommitFixture({
              id: '90857de21d98deda68d51a17e1411048fd74fbc4',
              pullRequest: PullRequestFixture({repository: pullRequestRepository}),
              repository: commitRepository,
            }),
          },
          user: null,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider
        group={resolvedCommitGroup}
        project={resolvedCommitGroup.project}
      >
        <ActivitySection group={resolvedCommitGroup} />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );

    expect(await screen.findByText('Resolved')).toBeInTheDocument();
    expect(screen.getByText(/on GitHub/)).toBeInTheDocument();
    expect(screen.queryByText(/GitLab/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: /90857de/})).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry/commit/90857de21d98deda68d51a17e1411048fd74fbc4'
    );
  });

  it('uses pull request repository details for resolved commit activity line items when commit repository is unknown', async () => {
    const activeRepository = RepositoryFixture({
      name: 'getsentry/seer',
      provider: {id: 'integrations:github', name: 'GitHub'},
      url: 'https://github.com/getsentry/seer',
    });
    const resolvedCommitGroup = GroupFixture({
      id: '1351',
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED_IN_COMMIT,
          id: 'resolved-commit-with-pr-repository',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            commit: CommitFixture({
              id: '42485aa330b1719b43faede3436717ee2ce8a1ed',
              pullRequest: PullRequestFixture({repository: activeRepository}),
              repository: RepositoryFixture({
                name: 'getsentry/seer',
                provider: {id: 'unknown', name: 'Unknown Provider'},
                status: RepositoryStatus.DISABLED,
                url: '',
              }),
            }),
          },
          user: null,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider
        group={resolvedCommitGroup}
        project={resolvedCommitGroup.project}
      >
        <ActivitySection group={resolvedCommitGroup} />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );

    expect(await screen.findByText('Resolved')).toBeInTheDocument();
    expect(screen.getByTestId('activity-timeline')).toHaveTextContent(
      'Resolved by 42485aa on GitHub'
    );
    expect(screen.getByText(/on GitHub/)).toBeInTheDocument();
    expect(screen.queryByText(/Unknown Provider/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: /42485aa/})).toHaveAttribute(
      'href',
      'https://github.com/getsentry/seer/commit/42485aa330b1719b43faede3436717ee2ce8a1ed'
    );
  });

  it('renders fallback details for missing resolved commit activity line item data', async () => {
    const resolvedCommitGroup = GroupFixture({
      id: '1353',
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED_IN_COMMIT,
          id: 'resolved-commit-missing-commit',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            commit: null,
          },
          user: null,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider
        group={resolvedCommitGroup}
        project={resolvedCommitGroup.project}
      >
        <ActivitySection group={resolvedCommitGroup} />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );

    expect(await screen.findByText('Resolved')).toBeInTheDocument();
    expect(screen.getByText('in a commit')).toBeInTheDocument();
  });

  it('renders Seer activity when feature flag is enabled', async () => {
    const seerGroup = GroupFixture({
      id: '1342',
      activity: [
        {
          type: GroupActivityType.SEER_RCA_COMPLETED,
          id: 'seer-rca-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {run_id: 123},
          user: null,
        },
      ],
      project,
    });

    const org = OrganizationFixture({
      features: ['display-seer-actions-as-issue-activities'],
    });

    render(
      <GroupDataContextProvider group={seerGroup} project={seerGroup.project}>
        <ActivitySection group={seerGroup} />
      </GroupDataContextProvider>,
      {organization: org}
    );
    expect(await screen.findByText('Root Cause Analysis')).toBeInTheDocument();
    expect(screen.getByText('Seer completed root cause analysis')).toBeInTheDocument();
  });

  it('hides Seer activity when feature flag is disabled', () => {
    const seerGroup = GroupFixture({
      id: '1343',
      activity: [
        {
          type: GroupActivityType.SEER_RCA_COMPLETED,
          id: 'seer-rca-2',
          dateCreated: '2020-01-01T00:00:00',
          data: {run_id: 123},
          user: null,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={seerGroup} project={seerGroup.project}>
        <ActivitySection group={seerGroup} />
      </GroupDataContextProvider>
    );
    expect(screen.queryByText('Root Cause Analysis')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Seer completed root cause analysis')
    ).not.toBeInTheDocument();
  });

  it('does not render Seer PR created activity in timeline', () => {
    const seerPrGroup = GroupFixture({
      id: '1344',
      activity: [
        {
          type: GroupActivityType.SEER_PR_CREATED,
          id: 'seer-pr-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            run_id: 456,
            pull_requests: [
              {
                provider: 'github',
                pull_request: {
                  pr_number: 42,
                  pr_url: 'https://github.com/org/repo/pull/42',
                },
                repo_name: 'org/repo',
              },
            ],
          },
          user: null,
        },
      ],
      project,
    });

    const org = OrganizationFixture({
      features: ['display-seer-actions-as-issue-activities'],
    });

    render(
      <GroupDataContextProvider group={seerPrGroup} project={seerPrGroup.project}>
        <ActivitySection group={seerPrGroup} />
      </GroupDataContextProvider>,
      {organization: org}
    );
    expect(screen.queryByText('Pull Request Created')).not.toBeInTheDocument();
  });

  it('renders Seer PR iteration activity when feature flag is enabled', async () => {
    const seerIterationGroup = GroupFixture({
      id: '1346',
      activity: [
        {
          type: GroupActivityType.SEER_ITERATION_COMPLETED,
          id: 'seer-iteration-2',
          dateCreated: '2020-01-01T00:00:01',
          data: {
            run_id: 456,
            iteration_index: 1,
            pull_requests: [
              {
                provider: 'github',
                pull_request: {
                  pr_number: 42,
                  pr_url: 'https://github.com/org/repo/pull/42',
                },
                repo_name: 'org/repo',
              },
            ],
          },
          user: null,
        },
        {
          type: GroupActivityType.SEER_ITERATION_STARTED,
          id: 'seer-iteration-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {run_id: 456, iteration_index: 1},
          user: null,
        },
      ],
      project,
    });

    const org = OrganizationFixture({
      features: ['display-seer-actions-as-issue-activities'],
    });

    render(
      <GroupDataContextProvider
        group={seerIterationGroup}
        project={seerIterationGroup.project}
      >
        <ActivitySection group={seerIterationGroup} />
      </GroupDataContextProvider>,
      {organization: org}
    );
    expect(await screen.findAllByText('PR Iteration')).toHaveLength(2);
    expect(
      screen.getByText('Seer started iterating on the pull request')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'pull request'})).toHaveAttribute(
      'href',
      'https://github.com/org/repo/pull/42'
    );
  });

  it('hides Seer PR iteration activity when feature flag is disabled', () => {
    const seerIterationGroup = GroupFixture({
      id: '1347',
      activity: [
        {
          type: GroupActivityType.SEER_ITERATION_STARTED,
          id: 'seer-iteration-3',
          dateCreated: '2020-01-01T00:00:00',
          data: {run_id: 456, iteration_index: 1},
          user: null,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider
        group={seerIterationGroup}
        project={seerIterationGroup.project}
      >
        <ActivitySection group={seerIterationGroup} />
      </GroupDataContextProvider>
    );
    expect(screen.queryByText('PR Iteration')).not.toBeInTheDocument();
  });

  it('renders PR author name when activity user is null', async () => {
    const prGroup = GroupFixture({
      id: '1345',
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST,
          id: 'pr-author-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            pullRequest: PullRequestFixture({
              author: {name: 'Shashank N Jarmale', email: 'shash@sentry.io'},
            }),
          },
          user: null,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={prGroup} project={prGroup.project}>
        <ActivitySection group={prGroup} />
      </GroupDataContextProvider>
    );
    expect(await screen.findByText('Pull Request Created')).toBeInTheDocument();
    expect(screen.getByText('Shashank N Jarmale')).toBeInTheDocument();
    expect(screen.queryByText('Sentry')).not.toBeInTheDocument();
  });

  it('falls back to Sentry when PR has no author', async () => {
    const prGroup = GroupFixture({
      id: '1346',
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST,
          id: 'pr-author-2',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            pullRequest: PullRequestFixture(),
          },
          user: null,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={prGroup} project={prGroup.project}>
        <ActivitySection group={prGroup} />
      </GroupDataContextProvider>
    );
    expect(await screen.findByText('Pull Request Created')).toBeInTheDocument();
    expect(screen.getByText('Sentry')).toBeInTheDocument();
  });

  it('does not render missing pull request details in activity line items', async () => {
    const prGroup = GroupFixture({
      id: '1350',
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST,
          id: 'pr-missing-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            pullRequest: null,
          },
          user: null,
        },
        {
          type: GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST,
          id: 'pr-missing-2',
          dateCreated: '2020-01-01T00:01:00',
          data: {},
          user: null,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={prGroup} project={prGroup.project}>
        <ActivitySection group={prGroup} />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );

    expect(await screen.findAllByText('Referenced in pull request')).toHaveLength(2);
    expect(screen.queryByText('in a pull request')).not.toBeInTheDocument();
  });

  it('falls back to Sentry for bot authors with @localhost email', async () => {
    const prGroup = GroupFixture({
      id: '1347',
      activity: [
        {
          type: GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST,
          id: 'pr-author-3',
          dateCreated: '2020-01-01T00:00:00',
          data: {
            pullRequest: PullRequestFixture({
              author: {name: 'sentry[bot]', email: 'sentry[bot]@localhost'},
            }),
          },
          user: null,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={prGroup} project={prGroup.project}>
        <ActivitySection group={prGroup} />
      </GroupDataContextProvider>
    );
    expect(await screen.findByText('Pull Request Created')).toBeInTheDocument();
    expect(screen.getByText('Sentry')).toBeInTheDocument();
    expect(screen.queryByText('sentry[bot]')).not.toBeInTheDocument();
  });

  it.each([
    [GroupActivityType.PULL_REQUEST_CLOSED, 'Pull Request Closed'],
    [GroupActivityType.PULL_REQUEST_REOPENED, 'Pull Request Reopened'],
    [GroupActivityType.PULL_REQUEST_MERGED, 'Pull Request Merged'],
    [GroupActivityType.PULL_REQUEST_UNLINKED, 'Pull Request Unlinked'],
  ] as const)('renders %s in the legacy activity UI', async (type, title) => {
    const pullRequest = PullRequestFixture();
    const prGroup = GroupFixture({
      activity: [
        {
          type,
          id: `pr-${type}`,
          dateCreated: '2020-01-01T00:00:00',
          data: {pullRequest},
          user: null,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={prGroup} project={prGroup.project}>
        <ActivitySection group={prGroup} />
      </GroupDataContextProvider>
    );

    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: 'example/repo-name #3: Fix first issue'})
    ).toHaveAttribute('href', pullRequest.externalUrl);
  });

  it.each([
    [GroupActivityType.PULL_REQUEST_CLOSED, 'closed'],
    [GroupActivityType.PULL_REQUEST_REOPENED, 'reopened'],
    [GroupActivityType.PULL_REQUEST_MERGED, 'merged'],
    [GroupActivityType.PULL_REQUEST_UNLINKED, 'unlinked'],
  ] as const)('renders %s in the new activity UI', async (type, action) => {
    const pullRequest = PullRequestFixture();
    const prGroup = GroupFixture({
      activity: [
        {
          type,
          id: `pr-${type}`,
          dateCreated: '2020-01-01T00:00:00',
          data: {pullRequest},
          user: null,
        },
      ],
      project,
    });

    render(
      <GroupDataContextProvider group={prGroup} project={prGroup.project}>
        <ActivitySection group={prGroup} />
      </GroupDataContextProvider>,
      {
        organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
      }
    );

    expect(await screen.findByTestId('activity-timeline')).toHaveTextContent(
      `Pull request #3 ${action} on GitHub`
    );
    expect(screen.getByRole('link', {name: '#3'})).toHaveAttribute(
      'href',
      pullRequest.externalUrl
    );
  });
});
