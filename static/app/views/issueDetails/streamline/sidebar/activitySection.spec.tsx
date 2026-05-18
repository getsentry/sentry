import {CommitFixture} from 'sentry-fixture/commit';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
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
import {GroupActivityType, GroupStatus} from 'sentry/types/group';
import {
  getIssueActivityTimelineStatuses,
  ISSUE_ACTIVITY_TIMELINE_STATUS,
  StreamlinedActivitySection,
} from 'sentry/views/issueDetails/streamline/sidebar/activitySection';

function getStatusEntries(currentStatus: GroupStatus, activity: GroupActivity[]) {
  return Object.fromEntries(getIssueActivityTimelineStatuses(currentStatus, activity));
}

describe('StreamlinedActivitySection', () => {
  const project = ProjectFixture();
  const user = UserFixture();
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

  it('infers resolved activity status until an unresolved state change', () => {
    const activities = [
      {
        type: GroupActivityType.NOTE,
        id: 'latest-note',
        data: {text: 'Resolved comment'},
        dateCreated: '2020-01-04T00:00:00',
        user,
      },
      {
        type: GroupActivityType.SET_RESOLVED,
        id: 'resolved',
        data: {},
        dateCreated: '2020-01-03T00:00:00',
        user,
      },
      {
        type: GroupActivityType.NOTE,
        id: 'resolved-period-note',
        data: {text: 'Still resolved'},
        dateCreated: '2020-01-02T00:00:00',
        user,
      },
      {
        type: GroupActivityType.SET_REGRESSION,
        id: 'regressed',
        data: {},
        dateCreated: '2020-01-01T00:00:00',
        user,
      },
    ] as GroupActivity[];

    expect(getStatusEntries(GroupStatus.RESOLVED, activities)).toEqual({
      'latest-note': GroupStatus.RESOLVED,
      resolved: GroupStatus.RESOLVED,
      'resolved-period-note': GroupStatus.UNRESOLVED,
      regressed: GroupStatus.UNRESOLVED,
    });
  });

  it('infers unresolved activity status until a resolved state change', () => {
    const activities = [
      {
        type: GroupActivityType.NOTE,
        id: 'latest-note',
        data: {text: 'Open comment'},
        dateCreated: '2020-01-04T00:00:00',
        user,
      },
      {
        type: GroupActivityType.SET_UNRESOLVED,
        id: 'unresolved',
        data: {},
        dateCreated: '2020-01-03T00:00:00',
        user,
      },
      {
        type: GroupActivityType.ASSIGNED,
        id: 'assigned',
        data: {
          assignee: '1',
          assigneeType: 'user',
          user,
        },
        dateCreated: '2020-01-02T00:00:00',
        user,
      },
      {
        type: GroupActivityType.SET_RESOLVED_IN_COMMIT,
        id: 'resolved-in-commit',
        data: {},
        dateCreated: '2020-01-01T00:00:00',
        user,
      },
    ] as GroupActivity[];

    expect(getStatusEntries(GroupStatus.UNRESOLVED, activities)).toEqual({
      'latest-note': GroupStatus.UNRESOLVED,
      unresolved: GroupStatus.UNRESOLVED,
      assigned: GroupStatus.RESOLVED,
      'resolved-in-commit': GroupStatus.RESOLVED,
    });
  });

  it('keeps ignored activity status neutral and inherits it for non-state actions', () => {
    const activities = [
      {
        type: GroupActivityType.SET_IGNORED,
        id: 'ignored',
        data: {},
        dateCreated: '2020-01-03T00:00:00',
        user,
      },
      {
        type: GroupActivityType.NOTE,
        id: 'ignored-note',
        data: {text: 'Archived comment'},
        dateCreated: '2020-01-02T00:00:00',
        user,
      },
      {
        type: GroupActivityType.FIRST_SEEN,
        id: 'first-seen',
        data: {},
        dateCreated: '2020-01-01T00:00:00',
        user,
      },
    ] as GroupActivity[];

    expect(getStatusEntries(GroupStatus.IGNORED, activities)).toEqual({
      ignored: GroupStatus.IGNORED,
      'ignored-note': ISSUE_ACTIVITY_TIMELINE_STATUS.NEW,
      'first-seen': ISSUE_ACTIVITY_TIMELINE_STATUS.NEW,
    });
  });

  it('keeps first seen neutral and marks the initial period as new until regression', () => {
    const activities = [
      {
        type: GroupActivityType.SET_REGRESSION,
        id: 'regressed',
        data: {},
        dateCreated: '2020-01-03T00:00:00',
        user,
      },
      {
        type: GroupActivityType.NOTE,
        id: 'initial-note',
        data: {text: 'Still new'},
        dateCreated: '2020-01-02T00:00:00',
        user,
      },
      {
        type: GroupActivityType.FIRST_SEEN,
        id: 'first-seen',
        data: {},
        dateCreated: '2020-01-01T00:00:00',
        user,
      },
    ] as GroupActivity[];

    expect(getStatusEntries(GroupStatus.UNRESOLVED, activities)).toEqual({
      regressed: GroupStatus.UNRESOLVED,
      'initial-note': ISSUE_ACTIVITY_TIMELINE_STATUS.NEW,
      'first-seen': ISSUE_ACTIVITY_TIMELINE_STATUS.NEW,
    });
  });

  it('infers archived to unresolved activity statuses', () => {
    const activities = [
      {
        type: GroupActivityType.SET_IGNORED,
        id: 'ignored',
        data: {},
        dateCreated: '2020-01-03T00:00:00',
        user,
      },
      {
        type: GroupActivityType.AUTO_SET_ONGOING,
        id: 'ongoing',
        data: {after_days: 7},
        dateCreated: '2020-01-02T00:00:00',
        user,
      },
    ] as GroupActivity[];

    expect(getStatusEntries(GroupStatus.IGNORED, activities)).toEqual({
      ignored: GroupStatus.IGNORED,
      ongoing: GroupStatus.UNRESOLVED,
    });
  });

  it('infers unresolved to archived activity statuses', () => {
    const activities = [
      {
        type: GroupActivityType.AUTO_SET_ONGOING,
        id: 'ongoing',
        data: {after_days: 7},
        dateCreated: '2020-01-03T00:00:00',
        user,
      },
      {
        type: GroupActivityType.SET_IGNORED,
        id: 'ignored',
        data: {},
        dateCreated: '2020-01-02T00:00:00',
        user,
      },
    ] as GroupActivity[];

    expect(getStatusEntries(GroupStatus.UNRESOLVED, activities)).toEqual({
      ongoing: GroupStatus.UNRESOLVED,
      ignored: GroupStatus.IGNORED,
    });
  });

  it('marks auto-assignment before an auto-ongoing action as unresolved', () => {
    const activities = [
      {
        type: GroupActivityType.AUTO_SET_ONGOING,
        id: 'ongoing-latest',
        data: {after_days: 7},
        dateCreated: '2026-01-29T04:15:38.602909Z',
        user: null,
      },
      {
        type: GroupActivityType.SET_REGRESSION,
        id: 'regressed-latest',
        data: {
          event_id: 'c0c33473114446f09a3ec1b9e4263450',
          version: 'backend@fe6617548efb4bfb775413964cedbba11340ad6f',
        },
        dateCreated: '2026-01-22T04:07:42.973057Z',
        user: null,
      },
      {
        type: GroupActivityType.SET_RESOLVED_BY_AGE,
        id: 'resolved-by-age',
        data: {age: 168},
        dateCreated: '2025-12-09T22:00:22.672404Z',
        user: null,
      },
      {
        type: GroupActivityType.ASSIGNED,
        id: 'auto-assigned',
        data: {
          assignee: '4509562243055616',
          assigneeEmail: null,
          assigneeName: 'issue-workflow',
          assigneeType: 'team',
          integration: 'codeowners',
          rule: 'codeowners:/sentry/api/endpoints/ #issue-workflow',
        },
        dateCreated: '2025-09-15T14:58:04.047879Z',
        user: null,
      },
      {
        type: GroupActivityType.AUTO_SET_ONGOING,
        id: 'ongoing-older',
        data: {after_days: 7},
        dateCreated: '2025-08-13T17:30:46.558476Z',
        user: null,
      },
    ] as GroupActivity[];

    expect(getStatusEntries(GroupStatus.UNRESOLVED, activities)).toEqual({
      'ongoing-latest': GroupStatus.UNRESOLVED,
      'regressed-latest': GroupStatus.UNRESOLVED,
      'resolved-by-age': GroupStatus.RESOLVED,
      'auto-assigned': GroupStatus.UNRESOLVED,
      'ongoing-older': GroupStatus.UNRESOLVED,
    });
  });

  it('infers unresolved statuses between consecutive regression actions', () => {
    const activities = [
      {
        type: GroupActivityType.SET_REGRESSION,
        id: 'regressed-3',
        data: {
          event_id: 'adf10121c17245d98d84d7d93935353a',
          version: 'backend@03a4083d745168a555a83e76f58130eb0c650a09',
        },
        dateCreated: '2026-05-12T13:15:04.308524Z',
        user: null,
      },
      {
        type: GroupActivityType.SET_REGRESSION,
        id: 'regressed-2',
        data: {
          event_id: '4005102101874a19a7c421c70cde39bd',
          version: 'backend@03a4083d745168a555a83e76f58130eb0c650a09',
        },
        dateCreated: '2026-05-12T13:14:59.980800Z',
        user: null,
      },
      {
        type: GroupActivityType.SET_REGRESSION,
        id: 'regressed-1',
        data: {
          event_id: 'ed43aae8cf534f95b94112148d7bc260',
          version: 'backend@03a4083d745168a555a83e76f58130eb0c650a09',
        },
        dateCreated: '2026-05-12T13:14:53.414692Z',
        user: null,
      },
      {
        type: GroupActivityType.SET_RESOLVED_BY_AGE,
        id: 'resolved-by-age',
        data: {age: 168},
        dateCreated: '2026-05-05T19:50:09.586524Z',
        user: null,
      },
    ] as GroupActivity[];

    expect(getStatusEntries(GroupStatus.UNRESOLVED, activities)).toEqual({
      'regressed-3': GroupStatus.UNRESOLVED,
      'regressed-2': GroupStatus.UNRESOLVED,
      'regressed-1': GroupStatus.UNRESOLVED,
      'resolved-by-age': GroupStatus.RESOLVED,
    });
  });

  it('infers statuses during the interval between state changes', () => {
    const activities = [
      {
        type: GroupActivityType.AUTO_SET_ONGOING,
        id: 'ongoing',
        data: {after_days: 7},
        dateCreated: '2020-01-03T00:00:00',
        user,
      },
      {
        type: GroupActivityType.SET_RESOLVED,
        id: 'resolved',
        data: {},
        dateCreated: '2020-01-02T00:00:00',
        user,
      },
      {
        type: GroupActivityType.SET_REGRESSION,
        id: 'regressed',
        data: {},
        dateCreated: '2020-01-01T00:00:00',
        user,
      },
    ] as GroupActivity[];

    expect(getStatusEntries(GroupStatus.UNRESOLVED, activities)).toEqual({
      ongoing: GroupStatus.UNRESOLVED,
      resolved: GroupStatus.RESOLVED,
      regressed: GroupStatus.UNRESOLVED,
    });
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

    render(<StreamlinedActivitySection group={group} />);

    const commentInput = screen.getByRole('textbox', {name: 'Add a comment'});
    expect(commentInput).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Submit comment'})
    ).not.toBeInTheDocument();

    await userEvent.click(commentInput);

    // Button appears after input is focused
    const submitButton = await screen.findByRole('button', {name: 'Submit comment'});
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

    render(<StreamlinedActivitySection group={group} />);

    const commentInput = screen.getByRole('textbox', {name: 'Add a comment'});
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

    render(<StreamlinedActivitySection group={group} isDrawer />);

    await userEvent.type(screen.getByRole('textbox', {name: 'Add a comment'}), '@jane');
    await userEvent.click(await screen.findByRole('option', {name: 'Jane Doe'}));
    await userEvent.click(screen.getByRole('button', {name: 'Submit comment'}));

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

    render(<StreamlinedActivitySection group={group} />);
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

    render(<StreamlinedActivitySection group={editGroup} />);
    expect(await screen.findByText('Group Test')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Comment Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Edit'}));

    await userEvent.type(screen.getByRole('textbox', {name: 'Edit comment'}), ' Updated');
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    expect(editMock).not.toHaveBeenCalled();

    expect(await screen.findByText('Group Test')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Comment Actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Edit'}));

    await userEvent.type(screen.getByRole('textbox', {name: 'Edit comment'}), ' Updated');
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

    render(<StreamlinedActivitySection group={newGroup} />);
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

    render(<StreamlinedActivitySection group={updatedActivityGroup} />);
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

    render(<StreamlinedActivitySection group={updatedActivityGroup} />);
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
      dateCreated: '2020-01-01T00:00:00',
      user: UserFixture({id: '2'}),
      project,
    }));

    const updatedActivityGroup = GroupFixture({
      id: '1338',
      activity: activities,
      project,
    });

    render(<StreamlinedActivitySection group={updatedActivityGroup} isDrawer />);

    for (const activity of activities) {
      expect(
        await screen.findByText((activity.data as {text: string}).text)
      ).toBeInTheDocument();
    }

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
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
      <StreamlinedActivitySection group={updatedActivityGroup} isDrawer filterComments />
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

  it('only applies status timeline colors to state-change items in the drawer', () => {
    const activities = [
      {
        type: GroupActivityType.SET_RESOLVED,
        id: 'resolved-1',
        data: {},
        dateCreated: '2020-01-03T00:00:00',
        user,
      },
      {
        type: GroupActivityType.NOTE,
        id: 'note-1',
        data: {text: 'Still resolved'},
        dateCreated: '2020-01-02T12:00:00',
        user,
      },
      {
        type: GroupActivityType.SET_REGRESSION,
        id: 'regressed-1',
        data: {},
        dateCreated: '2020-01-02T00:00:00',
        user,
      },
      {
        type: GroupActivityType.SET_IGNORED,
        id: 'ignored-1',
        data: {},
        dateCreated: '2020-01-01T00:00:00',
        user,
      },
    ] as GroupActivity[];
    const tintedGroup = GroupFixture({
      id: '1342',
      activity: activities,
      project,
      status: GroupStatus.RESOLVED,
    });

    const {unmount} = render(<StreamlinedActivitySection group={tintedGroup} isDrawer />);

    const resolvedRow = screen
      .getByText('Resolved')
      .closest<HTMLElement>('[data-test-id="activity-timeline-row"]')!;
    const regressedRow = screen
      .getByText('Regressed')
      .closest<HTMLElement>('[data-test-id="activity-timeline-row"]')!;
    const noteRow = screen
      .getByText('Still resolved')
      .closest<HTMLElement>('[data-test-id="activity-timeline-row"]')!;
    const ignoredRow = screen
      .getByText('Archived')
      .closest<HTMLElement>('[data-test-id="activity-timeline-row"]')!;

    expect(resolvedRow.style.getPropertyValue('--timeline-connector-color')).toBe('');
    expect(regressedRow.style.getPropertyValue('--timeline-connector-color')).toBe('');
    expect(noteRow.style.getPropertyValue('--timeline-connector-color')).toBe('');
    expect(ignoredRow.style.getPropertyValue('--timeline-connector-color')).toBe('');
    expect(
      resolvedRow.querySelector<HTMLElement>('.timeline-icon-wrapper')?.style.borderColor
    ).not.toBe('transparent');
    expect(
      regressedRow.querySelector<HTMLElement>('.timeline-icon-wrapper')?.style.borderColor
    ).not.toBe('transparent');
    expect(
      noteRow.querySelector<HTMLElement>('.timeline-icon-wrapper')?.style.borderColor
    ).toBe('transparent');
    expect(
      ignoredRow.querySelector<HTMLElement>('.timeline-icon-wrapper')?.style.borderColor
    ).not.toBe('transparent');

    unmount();
    render(<StreamlinedActivitySection group={tintedGroup} />);

    const nonDrawerResolvedRow = screen
      .getByText('Resolved')
      .closest<HTMLElement>('[data-test-id="activity-timeline-row"]')!;
    expect(
      nonDrawerResolvedRow.style.getPropertyValue('--timeline-connector-color')
    ).toBe('');
    expect(
      nonDrawerResolvedRow.querySelector<HTMLElement>('.timeline-icon-wrapper')?.style
        .borderColor
    ).toBe('transparent');
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

    render(<StreamlinedActivitySection group={resolvedGroup} />);
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

    render(<StreamlinedActivitySection group={resolvedGroup} />);
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

    render(<StreamlinedActivitySection group={referencedGroup} />);
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

    const org = OrganizationFixture({features: ['seer-activity-timeline']});

    render(<StreamlinedActivitySection group={seerGroup} />, {organization: org});
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

    render(<StreamlinedActivitySection group={seerGroup} />);
    expect(screen.queryByText('Root Cause Analysis')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Seer completed root cause analysis')
    ).not.toBeInTheDocument();
  });

  it('renders Seer PR created activity with link', async () => {
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

    const org = OrganizationFixture({features: ['seer-activity-timeline']});

    render(<StreamlinedActivitySection group={seerPrGroup} />, {organization: org});
    expect(await screen.findByText('Pull Request Created')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'pull request'})).toHaveAttribute(
      'href',
      'https://github.com/org/repo/pull/42'
    );
    expect(screen.getByText(/org\/repo/)).toBeInTheDocument();
  });
});
