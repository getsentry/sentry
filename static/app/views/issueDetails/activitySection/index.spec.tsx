import {CommitFixture} from 'sentry-fixture/commit';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {PullRequestFixture} from 'sentry-fixture/pullRequest';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {ConfigStore} from 'sentry/stores/configStore';
import {GroupStore} from 'sentry/stores/groupStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {GroupActivity} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import {ActivitySection} from 'sentry/views/issueDetails/activitySection';

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

    render(<ActivitySection group={group} />);

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

    render(<ActivitySection group={group} />);

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

    render(<ActivitySection group={group} variant="standalone" size="md" />);

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
    const deleteMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/1337/comments/note-1/',
      method: 'DELETE',
    });

    render(<ActivitySection group={group} />);
    renderGlobalModal();
    expect(await screen.findByText('Test Note')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Comment Actions'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Comment Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Remove'}));

    expect(
      screen.getByText('Are you sure you want to remove this comment?')
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Remove comment'}));

    expect(deleteMock).toHaveBeenCalledTimes(1);

    expect(screen.queryByText('Test Note')).not.toBeInTheDocument();
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

    render(<ActivitySection group={activityGroup} />);

    expect(await screen.findByTestId('activity-note-body')).toContainElement(
      screen.getByText('Bold Note').closest('strong')
    );
    expect(screen.getByRole('link', {name: 'docs'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/'
    );
    expect(screen.getByText('10m ago')).toBeInTheDocument();
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

    render(<ActivitySection group={activityGroup} />, {
      organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
    });

    expect(await screen.findByText('User note')).toBeInTheDocument();
    expect(screen.getByTestId('user-activity-marker')).toBeInTheDocument();
    expect(screen.getByTestId('sentry-activity-marker')).toBeInTheDocument();
  });

  it('does not render activity actor markers when the feature is disabled', async () => {
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
      ],
      project,
    });

    render(<ActivitySection group={activityGroup} />);

    expect(await screen.findByText('User note')).toBeInTheDocument();
    expect(screen.queryByTestId('user-activity-marker')).not.toBeInTheDocument();
  });

  it('does not render user avatar as icon for notes in two-column layout', async () => {
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
      ],
      project,
    });

    render(<ActivitySection group={activityGroup} />, {
      organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
    });

    expect(await screen.findByText('User note')).toBeInTheDocument();
    expect(screen.getByTestId('user-activity-marker')).toBeInTheDocument();
    expect(screen.queryByTestId('letter_avatar-avatar')).not.toBeInTheDocument();
  });

  it('renders provider-specific icon for create issue in two-column layout', async () => {
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

    render(<ActivitySection group={createIssueGroup} />, {
      organization: OrganizationFixture({features: ['issue-activity-feed-v2']}),
    });

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

    render(<ActivitySection group={createIssueGroup} />);

    expect(await screen.findByText('Created Issue')).toBeInTheDocument();
    expect(screen.getByText('Created external issue')).toBeInTheDocument();
    expect(screen.getByText('Linked Issue')).toBeInTheDocument();
    expect(screen.getByText('Linked external issue')).toBeInTheDocument();
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

    render(<ActivitySection group={autoResolvedGroup} />);

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

    render(<ActivitySection group={editGroup} />);
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

    expect(editMock).toHaveBeenCalledTimes(1);
    expect(indicators.addSuccessMessage).toHaveBeenCalledWith('Comment updated');
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

    render(<ActivitySection group={newGroup} />);
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

    render(<ActivitySection group={updatedActivityGroup} />);
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

    render(<ActivitySection group={updatedActivityGroup} />);
    expect(await screen.findByText('Test Note 1')).toBeInTheDocument();
    expect(await screen.findByText('Test Note 3')).toBeInTheDocument();
    expect(screen.queryByText('Test Note 7')).not.toBeInTheDocument();
    expect(await screen.findByText('View 4 more')).toBeInTheDocument();
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
      <ActivitySection group={updatedActivityGroup} variant="standalone" size="md" />
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
      <ActivitySection
        group={updatedActivityGroup}
        variant="standalone"
        size="md"
        filterComments
      />
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

  it('renders auto ongoing activity duration from backend data', async () => {
    const ongoingGroup = GroupFixture({
      id: '1339',
      activity: [
        {
          type: GroupActivityType.AUTO_SET_ONGOING,
          id: 'auto-ongoing-1',
          dateCreated: '2020-01-01T00:00:00',
          data: {after_days: 7},
        },
      ],
      project,
    });

    render(<ActivitySection group={ongoingGroup} />);

    expect(await screen.findByText('Marked as Ongoing')).toBeInTheDocument();
    expect(
      screen.getAllByText(
        (_, element) => element?.textContent === 'automatically by Sentry after 7 days'
      )
    ).not.toHaveLength(0);
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

    render(<ActivitySection group={resolvedGroup} />);
    expect(await screen.findByText('Resolved')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '1.0.0'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Jira Server'})).toBeInTheDocument();
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

    render(<ActivitySection group={resolvedGroup} />);
    expect(await screen.findByText('Resolved')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '1.0.0'})).toBeInTheDocument();
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

    render(<ActivitySection group={referencedGroup} />);
    expect(await screen.findByText('Referenced in Commit')).toBeInTheDocument();
    expect(screen.getByText('f7f395d')).toBeInTheDocument();
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

    render(<ActivitySection group={seerGroup} />, {organization: org});
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

    render(<ActivitySection group={seerGroup} />);
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

    render(<ActivitySection group={seerPrGroup} />, {organization: org});
    expect(screen.queryByText('Pull Request Created')).not.toBeInTheDocument();
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

    render(<ActivitySection group={prGroup} />);
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

    render(<ActivitySection group={prGroup} />);
    expect(await screen.findByText('Pull Request Created')).toBeInTheDocument();
    expect(screen.getByText('Sentry')).toBeInTheDocument();
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

    render(<ActivitySection group={prGroup} />);
    expect(await screen.findByText('Pull Request Created')).toBeInTheDocument();
    expect(screen.getByText('Sentry')).toBeInTheDocument();
    expect(screen.queryByText('sentry[bot]')).not.toBeInTheDocument();
  });
});
