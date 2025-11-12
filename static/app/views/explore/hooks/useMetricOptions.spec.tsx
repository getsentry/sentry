import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';

describe('useMetricOptions', () => {
  const project = ProjectFixture();
  const organization = OrganizationFixture();
  const context = initializeOrg({
    organization,
    projects: [project],
    router: {
      location: {
        pathname: '/organizations/org-slug/explore/',
        query: {project: project.id},
      },
      params: {},
    },
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    act(() => {
      ProjectsStore.loadInitialData([project]);
      PageFiltersStore.init();
      PageFiltersStore.onInitializeUrlState({
        projects: [project].map(p => parseInt(p.id, 10)),
        environments: [],
        datetime: {
          period: '3d',
          start: null,
          end: null,
          utc: null,
        },
      });
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: []},
    });
  });

  it('fetches metric options from tracemetrics dataset', async () => {
    const mockData = {
      data: [
        {['metric.name']: 'metric.c', ['metric.type']: 'counter'},
        {['metric.name']: 'metric.a', ['metric.type']: 'distribution'},
        {['metric.name']: 'metric.b', ['metric.type']: 'distribution'},
      ],
    };

    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: mockData,
      match: [
        MockApiClient.matchQuery({
          dataset: DiscoverDatasets.TRACEMETRICS,
          field: ['metric.name', 'metric.type', 'count(metric.name)'],
          referrer: 'api.explore.metric-options',
        }),
      ],
    });

    const {result} = renderHookWithProviders(useMetricOptions, {
      ...context,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRequest).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(result.current.data?.data).toEqual([
        {['metric.name']: 'metric.a', ['metric.type']: 'distribution'},
        {['metric.name']: 'metric.b', ['metric.type']: 'distribution'},
        {['metric.name']: 'metric.c', ['metric.type']: 'counter'},
      ])
    );
  });

  it('sorts metrics alphabetically by name', async () => {
    const mockData = {
      data: [
        {['metric.name']: 'metric.z', ['metric.type']: 'counter'},
        {['metric.name']: 'metric.a', ['metric.type']: 'distribution'},
        {['metric.name']: 'metric.m', ['metric.type']: 'gauge'},
      ],
    };

    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: mockData,
    });

    const {result} = renderHookWithProviders(useMetricOptions, {
      ...context,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'tracemetrics',
          field: ['metric.name', 'metric.type', 'count(metric.name)'],
          referrer: 'api.explore.metric-options',
          statsPeriod: '3d',
        }),
      })
    );

    await waitFor(() =>
      expect(result.current.data?.data).toEqual([
        {['metric.name']: 'metric.a', ['metric.type']: 'distribution'},
        {['metric.name']: 'metric.m', ['metric.type']: 'gauge'},
        {['metric.name']: 'metric.z', ['metric.type']: 'counter'},
      ])
    );
  });

  it('handles empty response', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: []},
    });

    const {result} = renderHookWithProviders(useMetricOptions, {
      ...context,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual({data: []});
  });

  it('can be disabled', () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: []},
    });

    renderHookWithProviders(useMetricOptions, {
      ...context,
      initialProps: {enabled: false},
    });

    expect(mockRequest).not.toHaveBeenCalled();
  });
});
