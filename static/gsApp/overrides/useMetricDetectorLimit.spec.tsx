import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useMetricDetectorLimit} from './useMetricDetectorLimit';

const mockOrganization = OrganizationFixture({
  features: ['workflow-engine-metric-detector-limit'],
});

const mockOrganizationWithoutFeature = OrganizationFixture({features: []});

const QUOTA_URL = '/organizations/org-slug/detectors/metric-detector-quota/';

describe('useMetricDetectorLimit', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('does not request the quota when the feature flag is disabled', () => {
    const quotaRequest = MockApiClient.addMockResponse({
      url: QUOTA_URL,
      body: {count: 5, limit: 5, hasReachedLimit: true},
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
    expect(quotaRequest).not.toHaveBeenCalled();
  });

  it('returns the quota below the limit', async () => {
    MockApiClient.addMockResponse({
      url: QUOTA_URL,
      body: {count: 3, limit: 4, hasReachedLimit: false},
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
  });

  it('returns the quota at the limit', async () => {
    MockApiClient.addMockResponse({
      url: QUOTA_URL,
      body: {count: 3, limit: 3, hasReachedLimit: true},
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

  it('returns unlimited when the plan has no limit', async () => {
    MockApiClient.addMockResponse({
      url: QUOTA_URL,
      body: {count: -1, limit: -1, hasReachedLimit: false},
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
  });

  it('handles a quota API error gracefully', async () => {
    MockApiClient.addMockResponse({url: QUOTA_URL, statusCode: 500});

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
      isError: true,
    });
  });
});
