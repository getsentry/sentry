import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import StreamGroup from 'sentry/components/stream/group';
import GuideStore from 'sentry/stores/guideStore';
import {EventOrGroupType} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {GroupStatus, PriorityLevel} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {IssueSelectionProvider} from 'sentry/views/issueList/issueSelectionContext';

jest.mock('sentry/utils/analytics');

describe('StreamGroup', () => {
  let group1!: Group;

  beforeEach(() => {
    group1 = GroupFixture({
      id: '1337',
      project: ProjectFixture({
        id: '13',
        slug: 'foo-project',
      }),
      type: EventOrGroupType.ERROR,
      inbox: {
        date_added: '2020-11-24T13:17:42.248751Z',
        reason: 0,
        reason_details: null,
      },
      lifetime: {
        firstSeen: '2017-10-10T02:41:20.000Z',
        lastSeen: '2017-10-16T02:41:20.000Z',
        count: '2',
        userCount: 1,
        stats: {},
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [ProjectFixture({slug: 'foo-project'})],
    });
  });

  afterEach(() => {
    jest.mocked(trackAnalytics).mockClear();
  });

  it('renders with anchors', async () => {
    render(<StreamGroup group={group1} hasGuideAnchor />);

    expect(await screen.findByTestId('group')).toBeInTheDocument();
    expect(GuideStore.state.anchors).toEqual(new Set(['dynamic_counts', 'issue_stream']));
  });

  it('shows not reviewed when group has inbox reason', async () => {
    render(
      <StreamGroup
        group={group1}
        query="is:unresolved is:for_review assigned_or_suggested:[me, none]"
      />
    );

    expect(await screen.findByTestId('group')).toHaveAttribute(
      'data-test-reviewed',
      'false'
    );
  });

  it('can change priority', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {data: {dismissed_ts: null}},
    });
    const mockModifyGroup = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      method: 'PUT',
      body: {priority: PriorityLevel.HIGH},
    });

    render(<StreamGroup group={group1} query="is:unresolved" />);

    const priorityDropdown = screen.getByRole('button', {name: 'Modify issue priority'});
    expect(within(priorityDropdown).getByText('Med')).toBeInTheDocument();
    await userEvent.click(priorityDropdown);
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'High'}));
    expect(mockModifyGroup).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/',
      expect.objectContaining({
        data: expect.objectContaining({
          priority: 'high',
        }),
      })
    );
  });

  it('tracks clicks from issues stream', async () => {
    render(
      <StreamGroup
        group={group1}
        query="is:unresolved is:for_review assigned_or_suggested:[me, none]"
      />
    );

    // skipHover - Prevent stacktrace preview from being rendered
    await userEvent.click(screen.getByText('RequestError'), {skipHover: true});
  });

  it('can select row', async () => {
    render(
      <IssueSelectionProvider visibleGroupIds={['1337']}>
        <StreamGroup group={group1} query="is:unresolved" />
      </IssueSelectionProvider>
    );

    expect(await screen.findByTestId('group')).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox', {name: 'Select Issue'});
    expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('shows first/last seen column', () => {
    render(
      <StreamGroup
        group={group1}
        query="is:unresolved is:for_review assigned_or_suggested:[me, none]"
        withColumns={['firstSeen', 'lastSeen']}
      />
    );

    expect(screen.getByRole('time', {name: 'First Seen'})).toHaveTextContent('1w');
    expect(screen.getByRole('time', {name: 'Last Seen'})).toHaveTextContent('1d');
  });

  it('navigates to issue with correct params when clicked', async () => {
    const {router} = render(
      <StreamGroup
        group={group1}
        query="is:unresolved is:for_review assigned_or_suggested:[me, none]"
      />
    );

    await userEvent.click(screen.getByTestId('group'));

    expect(router.location.pathname).toBe('/organizations/org-slug/issues/1337/');
    expect(router.location.query).toEqual({
      _allp: '1',
      project: '13',
      query: 'is:unresolved is:for_review assigned_or_suggested:[me, none]',
      referrer: 'issue-stream',
    });
  });

  it('displays unread indicator when issue is unread', async () => {
    const unreadGroup = GroupFixture({id: '1337', hasSeen: false});

    render(
      <IssueSelectionProvider visibleGroupIds={['1337']}>
        <StreamGroup group={unreadGroup} query="is:unresolved" />
      </IssueSelectionProvider>
    );

    expect(await screen.findByTestId('unread-issue-indicator')).toBeInTheDocument();
  });

  it('displays resolved status', async () => {
    const resolvedGroup = GroupFixture({
      id: '1337',
      status: GroupStatus.RESOLVED,
      statusDetails: {},
    });

    render(<StreamGroup group={resolvedGroup} query="is:unresolved" />);

    expect(await screen.findByTestId('resolved-issue')).toBeInTheDocument();
  });
});
