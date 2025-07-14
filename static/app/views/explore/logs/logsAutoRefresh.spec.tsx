import React from 'react';
import {LogFixture} from 'sentry-fixture/log';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import * as logsPageParams from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LogsPageParamsProvider} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {AutorefreshToggle} from 'sentry/views/explore/logs/logsAutoRefresh';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

describe('LogsAutoRefresh', () => {
  const setAutoRefresh = jest.fn();
  const organization = OrganizationFixture({
    features: ['ourlogs-enabled', 'ourlogs-live-refresh'],
  });

  const projects = [ProjectFixture()];

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/explore/logs/`,
      query: {
        // Toggle is disabled if sort is not a timestamp.
        'logs.sort_bys': '-timestamp',
      },
    },
    route: '/organizations/:orgId/explore/logs/',
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
    cleanup();

    // Init PageFiltersStore to make pageFiltersReady true (otherwise logs query won't fire)
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [parseInt(projects[0]!.id, 10)],
        environments: [],
        datetime: {
          period: '14d',
          start: null,
          end: null,
          utc: null,
        },
      },
      new Set()
    );

    jest.spyOn(logsPageParams, 'useLogsAutoRefresh').mockReturnValue(false);
    jest.spyOn(logsPageParams, 'useSetLogsAutoRefresh').mockReturnValue(setAutoRefresh);
    jest
      .spyOn(logsPageParams, 'useLogsSortBys')
      .mockReturnValue([{field: 'timestamp', kind: 'desc'}]);
    jest.spyOn(logsPageParams, 'useLogsRefreshInterval').mockReturnValue(10);
  });

  afterEach(() => {
    cleanup();
  });

  const renderWithProviders = (
    children: React.ReactNode,
    options: Parameters<typeof render>[1]
  ) => {
    return render(
      <LogsPageParamsProvider analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}>
        <LogsPageDataProvider>{children}</LogsPageDataProvider>
      </LogsPageParamsProvider>,
      options
    );
  };

  const mockApiCall = () =>
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: mockLogsData},
    });

  it('renders correctly with time-based sort', () => {
    const mockApi = mockApiCall();
    renderWithProviders(<AutorefreshToggle />, {initialRouterConfig, organization});

    const toggleLabel = screen.getByText('Auto-refresh');
    expect(toggleLabel).toBeInTheDocument();

    const toggleSwitch = screen.getByRole('checkbox', {name: 'Auto-refresh'});
    expect(toggleSwitch).not.toBeChecked();

    expect(mockApi).toHaveBeenCalledTimes(1);
  });

  it('calls setAutoRefresh when toggled', async () => {
    const mockApi = mockApiCall();
    renderWithProviders(<AutorefreshToggle />, {initialRouterConfig, organization});

    const toggleSwitch = screen.getByRole('checkbox', {name: 'Auto-refresh'});

    await userEvent.click(toggleSwitch);

    expect(setAutoRefresh).toHaveBeenCalledWith(true);
    expect(mockApi).toHaveBeenCalledTimes(1);
  });

  it('shows as checked and calls api repeatedly when auto-refresh is enabled', async () => {
    const mockApi = mockApiCall();
    jest.spyOn(logsPageParams, 'useLogsAutoRefresh').mockReturnValue(true);

    renderWithProviders(<AutorefreshToggle />, {initialRouterConfig, organization});

    const toggleSwitch = screen.getByRole('checkbox', {name: 'Auto-refresh'});
    expect(toggleSwitch).toBeChecked();

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(5);
    });
  });

  it('disables auto-refresh after 3 consecutive requests with more data', async () => {
    const mockApi = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: mockLogsData},
      headers: {
        Link: '<http://localhost/api/0/organizations/org-slug/events/?cursor=0:5000:0>; rel="next"; results="true"',
      },
    });

    jest.spyOn(logsPageParams, 'useLogsAutoRefresh').mockReturnValue(true);
    jest.spyOn(logsPageParams, 'useLogsRefreshInterval').mockReturnValue(1); // Faster interval for testing

    renderWithProviders(<AutorefreshToggle />);

    const toggleSwitch = screen.getByRole('checkbox', {name: 'Auto-refresh'});
    expect(toggleSwitch).toBeChecked();

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(3);
    });

    // After 3 consecutive requests with more data, auto-refresh should be disabled
    await waitFor(() => {
      expect(setAutoRefresh).toHaveBeenCalledWith(false);
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

    jest.spyOn(logsPageParams, 'useLogsAutoRefresh').mockReturnValue(true);
    jest.spyOn(logsPageParams, 'useLogsRefreshInterval').mockReturnValue(1); // Faster interval for testing

    renderWithProviders(<AutorefreshToggle />);

    const toggleSwitch = screen.getByRole('checkbox', {name: 'Auto-refresh'});
    expect(toggleSwitch).toBeChecked();

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledTimes(5);
    });

    // Auto-refresh should NOT be disabled
    expect(setAutoRefresh).not.toHaveBeenCalledWith(false);
  });

  it('disables auto-refresh when API request fails', async () => {
    const initialMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: mockLogsData},
    });

    jest.spyOn(logsPageParams, 'useLogsAutoRefresh').mockReturnValue(true);
    jest.spyOn(logsPageParams, 'useLogsRefreshInterval').mockReturnValue(1); // Faster interval for testing

    renderWithProviders(<AutorefreshToggle />);

    const toggleSwitch = screen.getByRole('checkbox', {name: 'Auto-refresh'});
    expect(toggleSwitch).toBeChecked();

    await waitFor(() => {
      expect(initialMock).toHaveBeenCalled();
    });

    expect(setAutoRefresh).not.toHaveBeenCalled();

    initialMock.mockClear();
    const errorMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      statusCode: 500,
      body: {
        detail: 'Internal Server Error',
      },
    });

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(setAutoRefresh).toHaveBeenCalledWith(false);
    });

    await userEvent.hover(toggleSwitch);

    expect(
      await screen.findByText(
        'Auto-refresh was disabled due to an error fetching logs. If the issue persists, please contact support.'
      )
    ).toBeInTheDocument();
  });
});
