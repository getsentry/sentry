import React from 'react';
import type {RouterConfig} from '@react-types/shared';
import {LogFixture} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {
  LOGS_AUTO_REFRESH_KEY,
  LOGS_REFRESH_INTERVAL_KEY,
} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  LOGS_FIELDS_KEY,
  LogsPageParamsProvider,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import {AutorefreshToggle} from 'sentry/views/explore/logs/logsAutoRefresh';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

describe('LogsAutoRefresh Integration Tests', () => {
  const organization = OrganizationFixture({
    features: ['ourlogs-enabled', 'ourlogs-live-refresh', 'ourlogs-infinite-scroll'],
  });

  const projects = [ProjectFixture()];

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/explore/logs/`,
      query: {
        // Toggle is disabled if sort is not a timestamp
        [LOGS_SORT_BYS_KEY]: '-timestamp',
        [LOGS_REFRESH_INTERVAL_KEY]: '10', // Fast refresh for testing
      },
    },
    route: '/organizations/:orgId/explore/logs/',
  };

  const enabledRouterConfig = {
    ...initialRouterConfig,
    location: {
      ...initialRouterConfig.location,
      query: {...initialRouterConfig.location.query, [LOGS_AUTO_REFRESH_KEY]: 'enabled'},
    },
  };

  const mockLogsData = [
    LogFixture({
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [OurLogKnownFieldKey.PROJECT_ID]: String(projects[0]!.id),
    }),
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();

    // Init PageFiltersStore to make pageFiltersReady true (otherwise logs query won't fire)
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [parseInt(projects[0]!.id, 10)],
        environments: [],
        datetime: {
          period: '7d',
          start: null,
          end: null,
          utc: null,
        },
      },
      new Set()
    );
  });

  const renderWithProviders = (
    children: React.ReactNode,
    options: Parameters<typeof render>[1] & {initialRouterConfig: RouterConfig}
  ) => {
    const result = render(
      <LogsPageParamsProvider analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}>
        <LogsPageDataProvider>{children}</LogsPageDataProvider>
      </LogsPageParamsProvider>,
      options
    ) as ReturnType<typeof render> & {router: any}; // Can't select the router type without exporting it.
    if (!result.router.location.query) {
      throw new Error('Router location not found');
    }
    return result;
  };

  const mockApiCall = () =>
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: mockLogsData},
    });

  it('renders correctly with time-based sort', async () => {
    const mockApi = mockApiCall();
    const {router} = renderWithProviders(<AutorefreshToggle />, {
      initialRouterConfig,
      organization,
    });

    const toggleLabel = screen.getByText('Auto-refresh');
    expect(toggleLabel).toBeInTheDocument();

    const toggleSwitch = screen.getByRole('checkbox', {name: 'Auto-refresh'});
    expect(toggleSwitch).not.toBeChecked();

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(1);
    });

    expect(router.location.query[LOGS_AUTO_REFRESH_KEY]).toBeUndefined();
  });

  it('enables auto-refresh when toggled and updates URL', async () => {
    const mockApi = mockApiCall();
    const {router} = renderWithProviders(<AutorefreshToggle />, {
      initialRouterConfig,
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

    expect(mockApi).toHaveBeenCalled();
  });

  it('disables auto-refresh when toggled off and removes from URL', async () => {
    mockApiCall();

    const {router} = renderWithProviders(<AutorefreshToggle />, {
      initialRouterConfig: enabledRouterConfig,
      organization,
    });

    const toggleSwitch = screen.getByRole('checkbox', {name: 'Auto-refresh'});

    expect(toggleSwitch).toBeChecked();

    await userEvent.click(toggleSwitch);

    await waitFor(() => {
      expect(router.location.query[LOGS_AUTO_REFRESH_KEY]).toBeUndefined();
    });

    // The toggle should be unchecked after navigation completes
    await waitFor(() => {
      expect(toggleSwitch).not.toBeChecked();
    });
  });

  it('disables toggle when using non-timestamp sort', async () => {
    mockApiCall();

    const nonTimestampRouterConfig = {
      ...initialRouterConfig,
      location: {
        ...initialRouterConfig.location,
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
    mockApiCall();

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
      initialRouterConfig,
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

  it('shows error state in URL when query fails', async () => {
    const mockCall = mockApiCall();

    const {router} = renderWithProviders(<AutorefreshToggle />, {
      initialRouterConfig: enabledRouterConfig,
      organization,
    });

    await screen.findByRole('checkbox', {name: 'Auto-refresh'});
    expect(mockCall).toHaveBeenCalledTimes(1);

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
    const mockApi = mockApiCall();

    renderWithProviders(<AutorefreshToggle />, {
      initialRouterConfig: enabledRouterConfig,
      organization,
    });

    const toggleSwitch = screen.getByRole('checkbox', {name: 'Auto-refresh'});
    expect(toggleSwitch).toBeChecked();

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(5);
    });
  });

  it('disables auto-refresh after 5 consecutive requests with more data', async () => {
    const mockApi = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: mockLogsData},
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

    await waitFor(() => {
      expect(router.location.query[LOGS_AUTO_REFRESH_KEY]).toBe('rate_limit');
    });
  });

  it('continues auto-refresh when there is no more data', async () => {
    const mockApi = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: mockLogsData},
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
    // Mock API response with Link header indicating more data
    const mockCall = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      headers: {
        Link: '<http://localhost/api/0/organizations/test-org/events/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", <http://localhost/api/0/organizations/test-org/events/?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"',
      },
      body: {
        data: mockLogsData,
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

    // Wait a bit to ensure no rate limiting occurs
    await waitFor(() => {
      expect(mockCall).toHaveBeenCalledTimes(5);
    });

    // Eventually rate limited
    expect(router.location.query[LOGS_AUTO_REFRESH_KEY]).toBe('rate_limit');
  });
});
