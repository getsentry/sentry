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
});
