import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, renderHook, screen, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import type {Organization} from 'sentry/types/organization';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';

import {useDashboardsLimit} from './dashboardsLimit';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

function createWrapper(organization: Organization) {
  return function Wrapper({children}: {children?: React.ReactNode}) {
    return (
      <QueryClientProvider client={queryClient}>
        <OrganizationContext value={organization}>{children}</OrganizationContext>
      </QueryClientProvider>
    );
  };
}

const mockOrganization = OrganizationFixture({
  features: ['dashboards-plan-limits'],
});

const mockOrganizationWithoutFeature = OrganizationFixture({
  features: [],
});

describe('useDashboardsLimit', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    queryClient.clear();
    SubscriptionStore.init();
  });

  it('returns no limits when feature flag is disabled', () => {
    const wrapper = createWrapper(mockOrganizationWithoutFeature);

    const {result} = renderHook(() => useDashboardsLimit(), {wrapper});

    expect(result.current).toEqual({
      hasReachedDashboardLimit: false,
      dashboardsLimit: 0,
      isLoading: false,
      limitMessage: null,
    });
  });

  it('handles unlimited dashboards plan without making dashboards request', async () => {
    const wrapper = createWrapper(mockOrganization);

    const subscription = SubscriptionFixture({
      organization: mockOrganization,
      planDetails: {
        ...SubscriptionFixture({
          organization: mockOrganization,
        }).planDetails,
        dashboardLimit: -1, // Unlimited
      },
    });

    SubscriptionStore.set(mockOrganization.slug, subscription);

    const dashboardsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
    });

    const {result} = renderHook(() => useDashboardsLimit(), {wrapper});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current).toEqual({
      hasReachedDashboardLimit: false,
      dashboardsLimit: -1,
      isLoading: false,
      limitMessage: null,
    });

    // Should not make the dashboards request for unlimited plans
    expect(dashboardsRequest).not.toHaveBeenCalled();
  });

  it('handles no subscription data (defaults to 0)', () => {
    const wrapper = createWrapper(mockOrganization);

    SubscriptionStore.set(mockOrganization.slug, null as any);

    const dashboardsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
    });

    const {result} = renderHook(() => useDashboardsLimit(), {wrapper});

    expect(result.current.hasReachedDashboardLimit).toBe(true);
    expect(result.current.dashboardsLimit).toBe(0);
    expect(result.current.isLoading).toBe(false);

    render(<div>{result.current.limitMessage}</div>);
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'You have reached the maximum number of Dashboards available on your plan. To add more, upgrade your plan'
        )
      )
    ).toBeInTheDocument();

    // Should not make the dashboards request when no subscription
    expect(dashboardsRequest).not.toHaveBeenCalled();
  });

  it('returns under limit when dashboards count is below limit', async () => {
    const wrapper = createWrapper(mockOrganization);

    const subscription = SubscriptionFixture({
      organization: mockOrganization,
      planDetails: {
        ...SubscriptionFixture({
          organization: mockOrganization,
        }).planDetails,
        dashboardLimit: 10,
      },
    });

    SubscriptionStore.set(mockOrganization.slug, subscription);

    const dashboardsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [
        {id: '1', title: 'Dashboard 1'},
        {id: '2', title: 'Dashboard 2'},
        {id: '3', title: 'Dashboard 3'},
      ],
      match: [MockApiClient.matchQuery({per_page: 11})],
    });

    const {result} = renderHook(() => useDashboardsLimit(), {wrapper});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current).toEqual({
      hasReachedDashboardLimit: false,
      dashboardsLimit: 10,
      isLoading: false,
      limitMessage: null,
    });

    expect(dashboardsRequest).toHaveBeenCalledTimes(1);
  });

  it('returns at limit when dashboards count equals limit', async () => {
    const wrapper = createWrapper(mockOrganization);

    const subscription = SubscriptionFixture({
      organization: mockOrganization,
      planDetails: {
        ...SubscriptionFixture({
          organization: mockOrganization,
        }).planDetails,
        dashboardLimit: 3,
      },
    });

    SubscriptionStore.set(mockOrganization.slug, subscription);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [
        {id: 'general', title: 'General'},
        {id: '1', title: 'Dashboard 1'},
        {id: '2', title: 'Dashboard 2'},
        {id: '3', title: 'Dashboard 3'},
      ],
      match: [MockApiClient.matchQuery({per_page: 4})],
    });

    const {result} = renderHook(() => useDashboardsLimit(), {wrapper});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasReachedDashboardLimit).toBe(true);
    expect(result.current.dashboardsLimit).toBe(3);
    expect(result.current.isLoading).toBe(false);

    // Test the React component returned by tct
    render(<div>{result.current.limitMessage}</div>);
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'You have reached the maximum number of Dashboards available on your plan. To add more, upgrade your plan'
        )
      )
    ).toBeInTheDocument();
  });

  it('returns over limit when dashboards count exceeds limit', async () => {
    const wrapper = createWrapper(mockOrganization);

    const subscription = SubscriptionFixture({
      organization: mockOrganization,
      planDetails: {
        ...SubscriptionFixture({
          organization: mockOrganization,
        }).planDetails,
        dashboardLimit: 2,
      },
    });

    SubscriptionStore.set(mockOrganization.slug, subscription);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [
        {id: '1', title: 'Dashboard 1'},
        {id: '2', title: 'Dashboard 2'},
        {id: '3', title: 'Dashboard 3'},
      ],
      match: [MockApiClient.matchQuery({per_page: 3})],
    });

    const {result} = renderHook(() => useDashboardsLimit(), {wrapper});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasReachedDashboardLimit).toBe(true);
    expect(result.current.dashboardsLimit).toBe(2);
    expect(result.current.isLoading).toBe(false);

    // Test the React component returned by tct
    render(<div>{result.current.limitMessage}</div>);
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'You have reached the maximum number of Dashboards available on your plan. To add more, upgrade your plan'
        )
      )
    ).toBeInTheDocument();
  });

  it('returns loading state when dashboards request is in progress', async () => {
    const wrapper = createWrapper(mockOrganization);

    const subscription = SubscriptionFixture({
      organization: mockOrganization,
      planDetails: {
        ...SubscriptionFixture({
          organization: mockOrganization,
        }).planDetails,
        dashboardLimit: 10,
      },
    });

    SubscriptionStore.set(mockOrganization.slug, subscription);

    const dashboardsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
      match: [MockApiClient.matchQuery({per_page: 11})],
    });

    const {result} = renderHook(() => useDashboardsLimit(), {wrapper});

    // Should still be loading while dashboards request is pending
    expect(result.current.isLoading).toBe(true);

    // Wait for request to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(dashboardsRequest).toHaveBeenCalledTimes(1);
  });

  it('handles dashboards API error gracefully', async () => {
    const wrapper = createWrapper(mockOrganization);

    const subscription = SubscriptionFixture({
      organization: mockOrganization,
      planDetails: {
        ...SubscriptionFixture({
          organization: mockOrganization,
        }).planDetails,
        dashboardLimit: 10,
      },
    });

    SubscriptionStore.set(mockOrganization.slug, subscription);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      statusCode: 500,
      match: [MockApiClient.matchQuery({per_page: 11})],
    });

    const {result} = renderHook(() => useDashboardsLimit(), {wrapper});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should default to no limit when dashboards request fails
    // The backend has validation that would reject the request if the limit
    // is reached
    expect(result.current).toEqual({
      hasReachedDashboardLimit: false,
      dashboardsLimit: 10,
      isLoading: false,
      limitMessage: null,
    });
  });

  it('handles missing subscription planDetails gracefully (defaults to 0)', () => {
    const wrapper = createWrapper(mockOrganization);

    const subscription = SubscriptionFixture({
      organization: mockOrganization,
      planDetails: undefined as any,
    });

    SubscriptionStore.set(mockOrganization.slug, subscription);

    const dashboardsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
    });

    const {result} = renderHook(() => useDashboardsLimit(), {wrapper});

    // Should default to 0 when planDetails is missing
    expect(result.current.hasReachedDashboardLimit).toBe(true);
    expect(result.current.dashboardsLimit).toBe(0);
    expect(result.current.isLoading).toBe(false);

    render(<div>{result.current.limitMessage}</div>);
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'You have reached the maximum number of Dashboards available on your plan. To add more, upgrade your plan'
        )
      )
    ).toBeInTheDocument();

    // Should not make dashboards request for unlimited plans
    expect(dashboardsRequest).not.toHaveBeenCalled();
  });
});
