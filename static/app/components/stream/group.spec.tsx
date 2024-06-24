import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import StreamGroup from 'sentry/components/stream/group';
import GroupStore from 'sentry/stores/groupStore';
import GuideStore from 'sentry/stores/guideStore';
import {EventOrGroupType} from 'sentry/types/event';
import type {Group, GroupStatusResolution, MarkReviewed} from 'sentry/types/group';
import {GroupStatus, PriorityLevel} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';

jest.mock('sentry/utils/analytics');

describe('StreamGroup', function () {
  let group1!: Group;

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
    jest.mocked(trackAnalytics).mockClear();
    GroupStore.reset();
  });

  it('renders with anchors', async function () {
    const {router, organization} = initializeOrg();
    render(<StreamGroup id="1337" hasGuideAnchor />, {
      router,
      organization,
    });

    expect(await screen.findByTestId('group')).toBeInTheDocument();
    expect(GuideStore.state.anchors).toEqual(new Set(['dynamic_counts', 'issue_stream']));
  });

  it('marks as reviewed', async function () {
    const {router, organization} = initializeOrg();
    render(
      <StreamGroup
        id="1337"
        query="is:unresolved is:for_review assigned_or_suggested:[me, none]"
      />,
      {router, organization}
    );

    expect(await screen.findByTestId('group')).toHaveAttribute(
      'data-test-reviewed',
      'false'
    );
    const data: MarkReviewed = {inbox: false};
    act(() => GroupStore.onUpdate('1337', undefined, data));
    act(() => GroupStore.onUpdateSuccess('1337', undefined, data));

    // Reviewed only applies styles, difficult to select with RTL
    expect(screen.getByTestId('group')).toHaveAttribute('data-test-reviewed', 'true');
  });

  it('marks as resolved', async function () {
    const {router, organization} = initializeOrg();
    render(<StreamGroup id="1337" query="is:unresolved" />, {
      router,
      organization,
    });

    expect(await screen.findByTestId('group')).toBeInTheDocument();
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

    render(<StreamGroup id="1337" query="is:unresolved" />);

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
    const {router, organization} = initializeOrg();
    render(
      <StreamGroup
        id="1337"
        query="is:unresolved is:for_review assigned_or_suggested:[me, none]"
      />,
      {router, organization}
    );

    // skipHover - Prevent stacktrace preview from being rendered
    await userEvent.click(screen.getByText('RequestError'), {skipHover: true});
  });

  it('can select row', async function () {
    const {router, organization} = initializeOrg();
    render(<StreamGroup id="1337" query="is:unresolved" />, {router, organization});

    expect(await screen.findByTestId('group')).toBeInTheDocument();
    const checkbox = screen.getByRole('checkbox', {name: 'Select Issue'});
    expect(checkbox).not.toBeChecked();
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('does not error when group is not in GroupStore', function () {
    const {router, organization} = initializeOrg();
    GroupStore.reset();
    const {container} = render(
      <StreamGroup
        id="1337"
        query="is:unresolved is:for_review assigned_or_suggested:[me, none]"
      />,
      {router, organization}
    );

    expect(container).toBeEmptyDOMElement();
  });
});
