import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import StreamGroup from 'sentry/components/stream/group';
import GroupStore from 'sentry/stores/groupStore';
import GuideStore from 'sentry/stores/guideStore';
import type {GroupStatusResolution, MarkReviewed} from 'sentry/types';
import {EventOrGroupType, GroupStatus, PriorityLevel} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';

jest.mock('sentry/utils/analytics');

describe('StreamGroup', function () {
  let group1;

  beforeEach(function () {
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
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [ProjectFixture({slug: 'foo-project'})],
    });
    GroupStore.loadInitialData([group1]);
  });

  afterEach(function () {
    (trackAnalytics as jest.Mock).mockClear();
    GroupStore.reset();
  });

  it('renders with anchors', function () {
    const {routerContext, organization} = initializeOrg();
    render(<StreamGroup id="1337" hasGuideAnchor {...routerContext} />, {
      context: routerContext,
      organization,
    });

    expect(GuideStore.state.anchors).toEqual(new Set(['dynamic_counts', 'issue_stream']));
  });

  it('marks as reviewed', function () {
    const {routerContext, organization} = initializeOrg();
    render(
      <StreamGroup
        id="1337"
        query="is:unresolved is:for_review assigned_or_suggested:[me, none]"
        {...routerContext}
      />,
      {context: routerContext, organization}
    );

    expect(screen.getByTestId('group')).toHaveAttribute('data-test-reviewed', 'false');
    const data: MarkReviewed = {inbox: false};
    act(() => GroupStore.onUpdate('1337', undefined, data));
    act(() => GroupStore.onUpdateSuccess('1337', undefined, data));

    // Reviewed only applies styles, difficult to select with RTL
    expect(screen.getByTestId('group')).toHaveAttribute('data-test-reviewed', 'true');
  });

  it('marks as resolved', function () {
    const {routerContext, organization} = initializeOrg();
    render(<StreamGroup id="1337" query="is:unresolved" />, {
      context: routerContext,
      organization,
    });

    expect(screen.queryByTestId('resolved-issue')).not.toBeInTheDocument();
    const data: GroupStatusResolution = {
      status: GroupStatus.RESOLVED,
      statusDetails: {},
    };
    act(() => GroupStore.onUpdate('1337', undefined, data));
    act(() => GroupStore.onUpdateSuccess('1337', undefined, data));
    expect(screen.getByTestId('resolved-issue')).toBeInTheDocument();
  });

  it('can change priority', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {data: {dismissed_ts: null}},
    });
    const mockModifyGroup = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      method: 'PUT',
      body: {priority: PriorityLevel.HIGH},
    });

    render(<StreamGroup id="1337" query="is:unresolved" />, {
      organization: OrganizationFixture({features: ['issue-priority-ui']}),
    });

    const priorityDropdown = screen.getByRole('button', {name: 'Modify issue priority'});
    expect(within(priorityDropdown).getByText('Med')).toBeInTheDocument();
    await userEvent.click(priorityDropdown);
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'High'}));
    expect(within(priorityDropdown).getByText('High')).toBeInTheDocument();
    expect(mockModifyGroup).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/',
      expect.objectContaining({
        data: expect.objectContaining({
          priority: 'high',
        }),
      })
    );
  });

  it('tracks clicks from issues stream', async function () {
    const {routerContext, organization} = initializeOrg();
    render(
      <StreamGroup
        id="1337"
        query="is:unresolved is:for_review assigned_or_suggested:[me, none]"
        {...routerContext}
      />,
      {context: routerContext, organization}
    );

    // skipHover - Prevent stacktrace preview from being rendered
    await userEvent.click(screen.getByText('RequestError'), {skipHover: true});
  });
});
