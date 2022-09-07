import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import StreamGroup from 'sentry/components/stream/group';
import GroupStore from 'sentry/stores/groupStore';
import GuideStore from 'sentry/stores/guideStore';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

jest.mock('sentry/utils/analytics/trackAdvancedAnalyticsEvent');

describe('StreamGroup', function () {
  let group1;

  beforeEach(function () {
    group1 = TestStubs.Group({
      id: '1337',
      project: {
        id: '13',
        slug: 'foo-project',
      },
      type: 'error',
      inbox: {
        date_added: '2020-11-24T13:17:42.248751Z',
        reason: 0,
        reason_details: null,
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      query: 'foo',
      body: [TestStubs.Project({slug: 'foo-project'})],
    });
    GroupStore.loadInitialData([group1]);
  });

  afterEach(function () {
    trackAdvancedAnalyticsEvent.mockClear();
    GroupStore.reset();
  });

  it('renders with anchors', function () {
    const {routerContext, organization} = initializeOrg();
    const wrapper = render(<StreamGroup id="1337" hasGuideAnchor {...routerContext} />, {
      context: routerContext,
      organization,
    });

    expect(GuideStore.state.anchors).toEqual(new Set(['dynamic_counts', 'issue_stream']));
    expect(wrapper.container).toSnapshot();
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
    const data = {inbox: false};
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
    const data = {status: 'resolved', statusDetails: {}};
    act(() => GroupStore.onUpdate('1337', undefined, data));
    act(() => GroupStore.onUpdateSuccess('1337', undefined, data));
    expect(screen.getByTestId('resolved-issue')).toBeInTheDocument();
  });

  it('tracks clicks from issues stream', function () {
    const {routerContext, organization} = initializeOrg();
    render(
      <StreamGroup
        id="1337"
        query="is:unresolved is:for_review assigned_or_suggested:[me, none]"
        {...routerContext}
      />,
      {context: routerContext, organization}
    );

    userEvent.click(screen.getByText('RequestError'));
    expect(trackAdvancedAnalyticsEvent).toHaveBeenCalledTimes(2);
  });
});
