import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';

import {useMetricDetectorLimit} from './useMetricDetectorLimit';

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
  features: ['workflow-engine-metric-detector-limit', 'workflow-engine-ui'],
});

const mockOrganizationWithoutFeature = OrganizationFixture({
  features: [],
});

describe('useMetricDetectorLimit', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    queryClient.clear();
    SubscriptionStore.init();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/alert-rules/',
      headers: {'X-Hits': '0'},
      body: [],
    });
  });

  it('handles feature flag is disabled', () => {
    const wrapper = createWrapper(mockOrganizationWithoutFeature);
    const detectorsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      headers: {'X-Hits': '5'},
      body: [],
    });

    const {result} = renderHook(() => useMetricDetectorLimit(), {wrapper});

    expect(result.current).toEqual({
      hasReachedLimit: false,
      detectorLimit: -1,
      detectorCount: -1,
      isLoading: false,
      isError: false,
    });

    expect(detectorsRequest).not.toHaveBeenCalled();
  });

  it('handles no subscription data', async () => {
    const wrapper = createWrapper(mockOrganization);

    SubscriptionStore.set(mockOrganization.slug, null as any);
    const detectorsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      headers: {'X-Hits': '2'},
      body: [],
    });

    const {result} = renderHook(() => useMetricDetectorLimit(), {wrapper});

    await waitFor(() => {
      expect(result.current?.isLoading).toBe(false);
    });

    expect(result.current).toEqual({
      hasReachedLimit: false,
      detectorLimit: -1,
      detectorCount: -1,
      isLoading: false,
      isError: false,
    });

    expect(detectorsRequest).not.toHaveBeenCalled();
  });

  it('handles detectors count is below limit', async () => {
    const wrapper = createWrapper(mockOrganization);

    const subscription = SubscriptionFixture({
      organization: mockOrganization,
      planDetails: {
        ...SubscriptionFixture({
          organization: mockOrganization,
        }).planDetails,
        metricDetectorLimit: 4,
      },
    });

    SubscriptionStore.set(mockOrganization.slug, subscription);

    const detectorsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      headers: {'X-Hits': '3'},
      body: [],
    });

    const {result} = renderHook(() => useMetricDetectorLimit(), {wrapper});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current).toEqual({
      hasReachedLimit: false,
      detectorLimit: 4,
      detectorCount: 3,
      isLoading: false,
      isError: false,
    });

    expect(detectorsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/detectors/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'type:metric',
          per_page: 1,
        }),
      })
    );
  });

  it('handles detectors count equals limit', async () => {
    const wrapper = createWrapper(mockOrganization);

    const subscription = SubscriptionFixture({
      organization: mockOrganization,
      planDetails: {
        ...SubscriptionFixture({
          organization: mockOrganization,
        }).planDetails,
        metricDetectorLimit: 3,
      },
    });

    SubscriptionStore.set(mockOrganization.slug, subscription);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      headers: {'X-Hits': '3'},
      body: [],
    });

    const {result} = renderHook(() => useMetricDetectorLimit(), {wrapper});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current).toEqual({
      hasReachedLimit: true,
      detectorLimit: 3,
      detectorCount: 3,
      isLoading: false,
      isError: false,
    });
  });

  it('handles detector limit is -1', async () => {
    const wrapper = createWrapper(mockOrganization);

    const subscription = SubscriptionFixture({
      organization: mockOrganization,
      planDetails: {
        ...SubscriptionFixture({
          organization: mockOrganization,
        }).planDetails,
        metricDetectorLimit: -1,
      },
    });

    SubscriptionStore.set(mockOrganization.slug, subscription);

    const detectorsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      headers: {'X-Hits': '10'},
      body: [],
    });

    const {result} = renderHook(() => useMetricDetectorLimit(), {wrapper});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current).toEqual({
      hasReachedLimit: false,
      detectorLimit: -1,
      detectorCount: -1,
      isLoading: false,
      isError: false,
    });

    expect(detectorsRequest).not.toHaveBeenCalled();
  });

  it('handles detectors API error gracefully', async () => {
    const wrapper = createWrapper(mockOrganization);

    const subscription = SubscriptionFixture({
      organization: mockOrganization,
      planDetails: {
        ...SubscriptionFixture({
          organization: mockOrganization,
        }).planDetails,
        metricDetectorLimit: 20,
      },
    });

    SubscriptionStore.set(mockOrganization.slug, subscription);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      statusCode: 500,
    });

    const {result} = renderHook(() => useMetricDetectorLimit(), {wrapper});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current).toEqual({
      hasReachedLimit: false,
      detectorLimit: 20,
      detectorCount: -1,
      isLoading: false,
      isError: true,
    });
  });
});
