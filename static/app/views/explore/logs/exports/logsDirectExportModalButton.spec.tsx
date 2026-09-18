import {LogFixture} from 'sentry-fixture/log';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {LOGS_AUTO_REFRESH_KEY} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {
  LOGS_FIELDS_KEY,
  LOGS_QUERY_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LogsDirectExportModalButton} from 'sentry/views/explore/logs/exports/logsDirectExportModalButton';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';

const mockDownloadFromHref = jest.fn();

jest.mock('sentry/utils/downloadFromHref', () => ({
  downloadFromHref: (...args: unknown[]) => mockDownloadFromHref(...args),
}));

describe('LogsDirectExportModalButton', () => {
  let timeseriesRequest: jest.Mock;
  const {organization, project} = initializeOrg({
    organization: {features: ['ourlogs-enabled']},
  });

  const tableData = [
    LogFixture({
      id: 'log-1',
      [OurLogKnownFieldKey.PROJECT_ID]: project.id,
      [OurLogKnownFieldKey.ORGANIZATION_ID]: Number(organization.id),
      [OurLogKnownFieldKey.MESSAGE]: `${'x'.repeat(256)}...`,
    }),
  ];

  ProjectsStore.loadInitialData([project]);
  PageFiltersStore.init();
  PageFiltersStore.onInitializeUrlState({
    projects: [parseInt(project.id, 10)],
    environments: [],
    datetime: {period: '14d', start: null, end: null, utc: null},
  });

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/explore/logs/`,
      query: {
        project: project.id,
        [LOGS_QUERY_KEY]: '',
        [LOGS_FIELDS_KEY]: ['timestamp', 'message'],
      },
    },
    route: '/organizations/:orgId/explore/logs/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    // A sample count well above the loaded rows, so the modal offers row counts
    // the browser can't serve and the export goes to the server.
    timeseriesRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      body: {
        timeSeries: [
          {
            yAxis: 'count(message)',
            values: [{timestamp: 1508208080000, value: 5000, sampleCount: 5000}],
            meta: {valueType: 'integer', valueUnit: null, interval: 3600000},
          },
        ],
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the estimate request stable during auto-refresh until the chart cutoff changes', async () => {
    jest.useFakeTimers();
    const cutoff = 1_700_000_000_000_000_000n;
    const renderButton = (timeseriesIngestDelay: bigint) => (
      <LogsQueryParamsProvider
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        source="location"
      >
        <LogsDirectExportModalButton
          isLoading={false}
          tableData={tableData}
          timeseriesIngestDelay={timeseriesIngestDelay}
        />
      </LogsQueryParamsProvider>
    );
    const {rerender, unmount} = render(renderButton(cutoff), {
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {
          ...initialRouterConfig.location,
          query: {
            ...initialRouterConfig.location.query,
            [LOGS_AUTO_REFRESH_KEY]: 'enabled',
          },
        },
      },
    });

    for (let i = 0; i < 10; i++) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(20);
      });
      rerender(renderButton(cutoff));
    }

    expect(timeseriesRequest).toHaveBeenCalledTimes(1);

    const nextCutoff = cutoff + 1_000_000_000n;
    rerender(renderButton(nextCutoff));
    expect(timeseriesRequest).toHaveBeenCalledTimes(2);
    expect(timeseriesRequest).toHaveBeenLastCalledWith(
      `/organizations/${organization.slug}/events-timeseries/`,
      expect.objectContaining({
        query: expect.objectContaining({query: `timestamp_precise:<=${nextCutoff}`}),
      })
    );
    unmount();
  });

  it('asks the server export for the highest accuracy without flex-time windows', async () => {
    const exportRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      body: {},
    });

    render(
      <LogsQueryParamsProvider
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        source="location"
      >
        <LogsDirectExportModalButton
          error={null}
          isLoading={false}
          tableData={tableData}
          timeseriesIngestDelay={0n}
        />
      </LogsQueryParamsProvider>,
      {initialRouterConfig}
    );
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Export'}));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {name: 'Export'})
    );

    await waitFor(() => {
      expect(exportRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/data-export/`,
        expect.objectContaining({
          data: expect.objectContaining({
            query_info: expect.objectContaining({sampling: 'HIGHEST_ACCURACY'}),
          }),
        })
      );
    });
  });

  it('exports through the server rather than the rows the table truncated for display', async () => {
    const exportRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      body: {},
    });

    render(
      <LogsQueryParamsProvider
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        source="location"
      >
        <LogsDirectExportModalButton
          error={null}
          isLoading={false}
          tableData={tableData}
          timeseriesIngestDelay={0n}
        />
      </LogsQueryParamsProvider>,
      {initialRouterConfig}
    );
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Export'}));
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {name: 'Export'})
    );

    await waitFor(() => {
      expect(exportRequest).toHaveBeenCalled();
    });
    expect(mockDownloadFromHref).not.toHaveBeenCalled();
  });
});
