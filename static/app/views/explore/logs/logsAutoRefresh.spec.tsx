import React from 'react';
import {createLogFixtures, initializeLogsTest} from 'sentry-fixture/log';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {LOGS_AUTO_REFRESH_KEY} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {LOGS_FIELDS_KEY} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import {AutorefreshToggle} from 'sentry/views/explore/logs/logsAutoRefresh';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';

describe('LogsAutoRefresh Integration Tests', () => {
  const {organization, project, routerConfig, setupPageFilters, setupEventsMock} =
    initializeLogsTest();

  const testDate = new Date('2024-01-15T10:00:00.000Z');
  const {baseFixtures} = createLogFixtures(organization, project, testDate);

  const enabledRouterConfig = {
    ...routerConfig,
    location: {
      ...routerConfig.location,
      query: {...routerConfig.location.query, [LOGS_AUTO_REFRESH_KEY]: 'enabled'},
    },
  };

  setupPageFilters();

  let mockApiCall: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();

    // Default API mock
    mockApiCall = setupEventsMock(baseFixtures.slice(0, 1));
  });

  const renderWithProviders = (
    children: React.ReactNode,
    options: Parameters<typeof render>[1]
  ) => {
    const result = render(
      <LogsQueryParamsProvider
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        source="location"
      >
        <LogsPageDataProvider allowHighFidelity>{children}</LogsPageDataProvider>
      </LogsQueryParamsProvider>,
      options
    ) as ReturnType<typeof render> & {router: any}; // Can't select the router type without exporting it.
    if (!result.router.location.query) {
      throw new Error('Router location not found');
    }
    return result;
  };

  it('renders correctly with time-based sort', async () => {
    const {router} = renderWithProviders(<AutorefreshToggle />, {
      initialRouterConfig: routerConfig,
      organization,
    });

    const toggleLabel = screen.getByText('Auto-refresh');
    expect(toggleLabel).toBeInTheDocument();

    const toggleSwitch = screen.getByRole('checkbox', {name: 'Auto-refresh'});
    expect(toggleSwitch).not.toBeChecked();

    await waitFor(() => {
      expect(mockApiCall).toHaveBeenCalledTimes(1);
    });

    expect(router.location.query[LOGS_AUTO_REFRESH_KEY]).toBeUndefined();
  });

  it('enables auto-refresh when toggled and updates URL', async () => {
    const {router} = renderWithProviders(<AutorefreshToggle />, {
      initialRouterConfig: routerConfig,
      organization,
    });

    const toggleSwitch = screen.getByRole('checkbox', {name: 'Auto-refresh'});

    await userEvent.click(toggleSwitch);

    await waitFor(() => {
      expect(router.location.query[LOGS_AUTO_REFRESH_KEY]).toBe('enabled');
    });

    await waitFor(() => {
      expect(toggleSwitch).toBeChecked();
    });

    expect(mockApiCall).toHaveBeenCalled();
  });

  it('disables auto-refresh when toggled off and sets paused state', async () => {
    const {router} = renderWithProviders(<AutorefreshToggle />, {
      initialRouterConfig: enabledRouterConfig,
      organization,
    });

    const toggleSwitch = screen.getByRole('checkbox', {name: 'Auto-refresh'});

    expect(toggleSwitch).toBeChecked();

    await userEvent.click(toggleSwitch);

    await waitFor(() => {
      expect(router.location.query[LOGS_AUTO_REFRESH_KEY]).toBe('paused');
    });

    // The toggle should be unchecked after navigation completes
    await waitFor(() => {
      expect(toggleSwitch).not.toBeChecked();
    });
  });

  it('disables toggle when using non-timestamp sort', async () => {
    const nonTimestampRouterConfig = {
      ...routerConfig,
      location: {
        ...routerConfig.location,
        query: {
          [LOGS_SORT_BYS_KEY]: 'level', // Non-timestamp sort
          [LOGS_FIELDS_KEY]: ['level', 'timestamp'], // Fields have to be set for sort bys to be applied
        },
      },
    };

    renderWithProviders(<AutorefreshToggle />, {
      initialRouterConfig: nonTimestampRouterConfig,
      organization,
    });

    const toggleSwitch = screen.getByRole('checkbox', {name: 'Auto-refresh'});
    expect(toggleSwitch).toBeDisabled();

    await userEvent.hover(toggleSwitch);

    await waitFor(() => {
      expect(
        screen.getByText(/Auto-refresh is only supported when sorting by time/i)
      ).toBeInTheDocument();
    });
  });

  it('disables toggle when using absolute date range', async () => {
    // Update PageFiltersStore with absolute dates
    act(() => {
      PageFiltersStore.updateDateTime({
        period: null,
        start: new Date('2024-01-01'),
        end: new Date('2024-01-02'),
        utc: null,
      });
    });

    renderWithProviders(<AutorefreshToggle />, {
      initialRouterConfig: routerConfig,
      organization,
    });

    const toggleSwitch = screen.getByRole('checkbox', {name: 'Auto-refresh'});
    expect(toggleSwitch).toBeDisabled();

    await userEvent.hover(toggleSwitch);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Auto-refresh is only supported when using a relative time period/i
        )
      ).toBeInTheDocument();
    });
  });

  it('disables auto-refresh when on aggregates mode', async () => {
    renderWithProviders(<AutorefreshToggle />, {
      initialRouterConfig: {
        ...routerConfig,
        location: {
          ...routerConfig.location,
          query: {
            ...routerConfig.location.query,
            mode: 'aggregate',
          },
        },
      },
      organization,
    });

    const toggleSwitch = screen.getByRole('checkbox', {name: 'Auto-refresh'});
    expect(toggleSwitch).toBeDisabled();

    await userEvent.hover(toggleSwitch);

    await waitFor(() => {
      expect(
        screen.getByText(/Auto-refresh is not available in the aggregates view./i)
      ).toBeInTheDocument();
    });
  });

  it('disables auto-refresh when using not count(message)', async () => {
    renderWithProviders(<AutorefreshToggle />, {
      initialRouterConfig: {
        ...routerConfig,
        location: {
          ...routerConfig.location,
          query: {
            ...routerConfig.location.query,
            logsAggregate: 'avg',
            logsAggregateParam: 'payload_size',
          },
        },
      },
      organization,
    });

    const toggleSwitch = screen.getByRole('checkbox', {name: 'Auto-refresh'});
    expect(toggleSwitch).toBeDisabled();

    await userEvent.hover(toggleSwitch);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Auto-refresh is only available when visualizing `count\(logs\)`./i
        )
      ).toBeInTheDocument();
    });
  });

  it('shows error state in URL when query fails', async () => {
    const {router} = renderWithProviders(<AutorefreshToggle />, {
      initialRouterConfig: enabledRouterConfig,
      organization,
    });

    await screen.findByRole('checkbox', {name: 'Auto-refresh'});
    expect(mockApiCall).toHaveBeenCalledTimes(1);

    // Clear default mocks and add custom error mock
    MockApiClient.clearMockResponses();
    const mockErrorCall = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      statusCode: 500,
      body: {detail: 'Internal Server Error'},
    });

    await waitFor(() => {
      expect(mockErrorCall).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(router.location.query[LOGS_AUTO_REFRESH_KEY]).toBe('error');
    });
  });

  it('shows as checked and calls api repeatedly when auto-refresh is enabled', async () => {
    renderWithProviders(<AutorefreshToggle />, {
      initialRouterConfig: enabledRouterConfig,
      organization,
    });

    const toggleSwitch = screen.getByRole('checkbox', {name: 'Auto-refresh'});
    expect(toggleSwitch).toBeChecked();

    await waitFor(() => {
      expect(mockApiCall).toHaveBeenCalledTimes(5);
    });
  });

  it('disables auto-refresh after 5 consecutive requests with more data', async () => {
    jest.useFakeTimers();

    // Clear default mocks and add custom mock
    MockApiClient.clearMockResponses();
    const mockApi = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: baseFixtures.slice(0, 1)},
      headers: {
        Link: '<http://localhost/api/0/organizations/org-slug/events/?cursor=0:1000:0>; rel="next"; results="true"',
      },
    });

    const {router} = renderWithProviders(<AutorefreshToggle />, {
      initialRouterConfig: enabledRouterConfig,
      organization,
    });

    const toggleSwitch = screen.getByRole('checkbox', {name: 'Auto-refresh'});
    expect(toggleSwitch).toBeChecked();

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(5);
    });

    expect(router.location.query[LOGS_AUTO_REFRESH_KEY]).toBe('rate_limit');
  });

  it('continues auto-refresh when there is no more data', async () => {
    // Clear default mocks and add custom mock
    MockApiClient.clearMockResponses();
    const mockApi = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: baseFixtures.slice(0, 1)},
      headers: {
        Link: '', // No Link header means no more data
      },
    });

    const {router} = renderWithProviders(<AutorefreshToggle />, {
      initialRouterConfig: enabledRouterConfig,
      organization,
    });

    const toggleSwitch = screen.getByRole('checkbox', {name: 'Auto-refresh'});
    expect(toggleSwitch).toBeChecked();

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(5);
    });

    // Auto-refresh should still be enabled
    expect(router.location.query[LOGS_AUTO_REFRESH_KEY]).toBe('enabled');
  });

  it('does not rate limit on initial load even with more data', async () => {
    // Clear default mocks and add custom mock with Link header indicating more data
    MockApiClient.clearMockResponses();
    const mockCall = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      headers: {
        Link: '<http://localhost/api/0/organizations/test-org/events/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", <http://localhost/api/0/organizations/test-org/events/?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"',
      },
      body: {
        data: baseFixtures.slice(0, 1),
        meta: {fields: {}},
      },
    });

    const {router} = renderWithProviders(<AutorefreshToggle />, {
      initialRouterConfig: enabledRouterConfig,
      organization,
    });

    // Wait for initial load
    await waitFor(() => {
      expect(mockCall).toHaveBeenCalledTimes(1);
    });

    // Verify auto-refresh is still enabled (not rate limited)
    expect(router.location.query[LOGS_AUTO_REFRESH_KEY]).toBe('enabled');

    await waitFor(() => {
      expect(mockCall).toHaveBeenCalledTimes(5);
    });

    // Eventually rate limited
    expect(router.location.query[LOGS_AUTO_REFRESH_KEY]).toBe('rate_limit');
  });
});
