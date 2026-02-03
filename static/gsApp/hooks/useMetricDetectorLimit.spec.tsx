import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';

import {useMetricDetectorLimit} from './useMetricDetectorLimit';

const mockOrganization = OrganizationFixture({
  features: ['workflow-engine-metric-detector-limit', 'workflow-engine-ui'],
});

const mockOrganizationWithoutFeature = OrganizationFixture({
  features: [],
});

describe('useMetricDetectorLimit', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    SubscriptionStore.init();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/alert-rules/',
      headers: {'X-Hits': '0'},
      body: [],
    });
  });

  it('handles feature flag is disabled', () => {
    const detectorsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      headers: {'X-Hits': '5'},
      body: [],
    });

    const {result} = renderHookWithProviders(() => useMetricDetectorLimit(), {
      organization: mockOrganizationWithoutFeature,
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

  it('handles no subscription data', async () => {
    SubscriptionStore.set(mockOrganization.slug, null as any);
    const detectorsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      headers: {'X-Hits': '2'},
      body: [],
    });

    const {result} = renderHookWithProviders(() => useMetricDetectorLimit(), {
      organization: mockOrganization,
    });

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

    const {result} = renderHookWithProviders(() => useMetricDetectorLimit(), {
      organization: mockOrganization,
    });

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
          query: '!type:issue_stream type:metric',
          per_page: 1,
        }),
      })
    );
  });

  it('handles detectors count equals limit', async () => {
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

    const {result} = renderHookWithProviders(() => useMetricDetectorLimit(), {
      organization: mockOrganization,
    });

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

    const {result} = renderHookWithProviders(() => useMetricDetectorLimit(), {
      organization: mockOrganization,
    });

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

    const {result} = renderHookWithProviders(() => useMetricDetectorLimit(), {
      organization: mockOrganization,
    });

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
