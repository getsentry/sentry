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
  features: ['workflow-engine-metric-detector-limit'],
});

const mockOrganizationWithoutFeature = OrganizationFixture({
  features: [],
});

describe('useMetricDetectorLimit', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    queryClient.clear();
    SubscriptionStore.init();
  });

  it('returns no limits when feature flag is disabled', () => {
    const wrapper = createWrapper(mockOrganizationWithoutFeature);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
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
  });

  it('handles no subscription data (defaults to 0)', () => {
    const wrapper = createWrapper(mockOrganization);

    SubscriptionStore.set(mockOrganization.slug, null as any);
    const detectorsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [],
    });

    const {result} = renderHook(() => useMetricDetectorLimit(), {wrapper});

    expect(result.current.detectorLimit).toBe(0);
    expect(result.current.isLoading).toBe(true);

    expect(detectorsRequest).toHaveBeenCalled();
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
      body: [
        {id: '1', name: 'Detector 1'},
        {id: '2', name: 'Detector 2'},
        {id: '3', name: 'Detector 3'},
      ],
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

    expect(detectorsRequest).toHaveBeenCalledTimes(1);
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
      body: [
        {id: '1', name: 'Detector 1'},
        {id: '2', name: 'Detector 2'},
        {id: '3', name: 'Detector 3'},
      ],
    });

    const {result} = renderHook(() => useMetricDetectorLimit(), {wrapper});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasReachedLimit).toBe(true);
    expect(result.current.detectorLimit).toBe(3);
    expect(result.current.detectorCount).toBe(3);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
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

    expect(result.current.isError).toBe(true);
    expect(result.current.detectorLimit).toBe(20);
    expect(result.current.detectorCount).toBe(0);
    expect(result.current.hasReachedLimit).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });
});
