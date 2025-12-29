import {initializeLogsTest} from 'sentry-fixture/log';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {DatePageFilterProps} from 'sentry/components/organizations/datePageFilter';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {LOGS_AUTO_REFRESH_KEY} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  LOGS_FIELDS_KEY,
  LOGS_QUERY_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {LOGS_SORT_BYS_KEY} from 'sentry/views/explore/contexts/logs/sortBys';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {AlwaysPresentLogFields} from 'sentry/views/explore/logs/constants';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {LogsTabContent} from 'sentry/views/explore/logs/logsTab';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {TraceItemDataset} from 'sentry/views/explore/types';

const datePageFilterProps: DatePageFilterProps = {
  defaultPeriod: '7d' as const,
  maxPickableDays: 7,
  relativeOptions: ({arbitraryOptions}) => ({
    ...arbitraryOptions,
    '1h': 'Last hour',
    '24h': 'Last 24 hours',
    '7d': 'Last 7 days',
  }),
};

describe('LogsTabContent', () => {
  const {organization, project, setupPageFilters} = initializeLogsTest();

  let eventTableMock: jest.Mock;
  let eventsTimeSeriesMock: jest.Mock;

  function ProviderWrapper({children}: {children: React.ReactNode}) {
    return (
      <LogsQueryParamsProvider
        analyticsPageSource={LogsAnalyticsPageSource.EXPLORE_LOGS}
        source="location"
      >
        <TraceItemAttributeProvider traceItemType={TraceItemDataset.LOGS} enabled>
          <LogsPageDataProvider>{children}</LogsPageDataProvider>
        </TraceItemAttributeProvider>
      </LogsQueryParamsProvider>
    );
  }

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/explore/logs/`,
      query: {
        start: '2025-04-10T14%3A37%3A55',
        end: '2025-04-10T20%3A04%3A51',
        project: project.id,
        [LOGS_FIELDS_KEY]: ['message', 'sentry.message.parameters.0'],
        [LOGS_SORT_BYS_KEY]: ['sentry.message.parameters.0'],
        [LOGS_QUERY_KEY]: 'severity:error',
        [LOGS_AUTO_REFRESH_KEY]: '',
      },
    },
    route: '/organizations/:orgId/explore/logs/',
  };

  setupPageFilters();

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    // Default API mocks
    eventTableMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {
        data: [
          {
            [OurLogKnownFieldKey.ID]: '019621262d117e03bce898cb8f4f6ff7',
            [OurLogKnownFieldKey.PROJECT_ID]: 1,
            [OurLogKnownFieldKey.TRACE_ID]: '17cc0bae407042eaa4bf6d798c37d026',
            [OurLogKnownFieldKey.SEVERITY_NUMBER]: 9,
            [OurLogKnownFieldKey.SEVERITY]: 'info',
            [OurLogKnownFieldKey.TIMESTAMP]: '2025-04-10T19:21:12+00:00',
            [OurLogKnownFieldKey.MESSAGE]: 'some log message1',
            [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: 1.7443128722090732e18,
          },
          {
            [OurLogKnownFieldKey.ID]: '0196212624a17144aa392d01420256a2',
            [OurLogKnownFieldKey.PROJECT_ID]: 1,
            [OurLogKnownFieldKey.TRACE_ID]: 'c331c2df93d846f5a2134203416d40bb',
            [OurLogKnownFieldKey.SEVERITY_NUMBER]: 9,
            [OurLogKnownFieldKey.SEVERITY]: 'info',
            [OurLogKnownFieldKey.TIMESTAMP]: '2025-04-10T19:21:10+00:00',
            [OurLogKnownFieldKey.MESSAGE]: 'some log message2',
            [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: 1.744312870049196e18,
          },
        ],
        meta: {
          fields: {
            [OurLogKnownFieldKey.ID]: 'string',
            [OurLogKnownFieldKey.PROJECT_ID]: 'string',
            [OurLogKnownFieldKey.TRACE_ID]: 'string',
            [OurLogKnownFieldKey.SEVERITY_NUMBER]: 'integer',
            [OurLogKnownFieldKey.SEVERITY]: 'string',
            [OurLogKnownFieldKey.TIMESTAMP]: 'string',
            [OurLogKnownFieldKey.MESSAGE]: 'string',
            [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: 'number',
          },
          units: {
            [OurLogKnownFieldKey.ID]: null,
            [OurLogKnownFieldKey.PROJECT_ID]: null,
            [OurLogKnownFieldKey.TRACE_ID]: null,
            [OurLogKnownFieldKey.SEVERITY_NUMBER]: null,
            [OurLogKnownFieldKey.SEVERITY]: null,
            [OurLogKnownFieldKey.TIMESTAMP]: null,
            [OurLogKnownFieldKey.MESSAGE]: null,
            [OurLogKnownFieldKey.TIMESTAMP_PRECISE]: null,
          },
          isMetricsData: false,
          isMetricsExtractedData: false,
          tips: {},
          datasetReason: 'unchanged',
          dataset: 'ourlogs',
          dataScanned: 'full',
          accuracy: {
            confidence: [{}, {}],
          },
        },
        confidence: [{}, {}],
      },
    });

    eventsTimeSeriesMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-timeseries/`,
      method: 'GET',
      body: {
        timeSeries: [TimeSeriesFixture()],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/stats/`,
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/stats_v2/`,
      method: 'GET',
      body: {},
    });
  });

  it('should call APIs as expected', async () => {
    render(
      <ProviderWrapper>
        <LogsTabContent datePageFilterProps={datePageFilterProps} />
      </ProviderWrapper>,
      {initialRouterConfig, organization}
    );

    expect(eventTableMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          statsPeriod: '14d',
          dataset: 'ourlogs',
          field: [...AlwaysPresentLogFields, 'message', 'sentry.message.parameters.0'],
          sort: 'sentry.message.parameters.0',
          query: 'severity:error',
        }),
      })
    );

    expect(eventsTimeSeriesMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events-timeseries/`,
      expect.objectContaining({
        query: expect.objectContaining({
          caseInsensitive: undefined,
          dataset: 'ourlogs',
          disableAggregateExtrapolation: '0',
          environment: [],
          excludeOther: 0,
          groupBy: [],
          interval: '1h',
          partial: 1,
          project: [2],
          query: 'severity:error',
          referrer: 'api.explore.ourlogs-timeseries',
          sampling: 'NORMAL',
          sort: '-count_message',
          statsPeriod: '14d',
          topEvents: undefined,
          yAxis: ['count(message)'],
        }),
      })
    );

    const table = screen.getByTestId('logs-table');
    await screen.findByText('some log message1');
    expect(table).toHaveTextContent(/some log message1/);
    expect(table).toHaveTextContent(/some log message2/);
  });

  it('should switch between modes', async () => {
    render(
      <ProviderWrapper>
        <LogsTabContent datePageFilterProps={datePageFilterProps} />
      </ProviderWrapper>,
      {initialRouterConfig, organization}
    );

    expect(screen.getByRole('tab', {name: 'Logs'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', {name: 'Aggregates'})).toHaveAttribute(
      'aria-selected',
      'false'
    );

    expect(screen.queryByTestId('logs-toolbar')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', {name: 'Aggregates'}));

    expect(screen.getByRole('tab', {name: 'Logs'})).toHaveAttribute(
      'aria-selected',
      'false'
    );
    expect(screen.getByRole('tab', {name: 'Aggregates'})).toHaveAttribute(
      'aria-selected',
      'true'
    );

    expect(screen.getByTestId('logs-toolbar')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', {name: 'Logs'}));

    expect(screen.getByRole('tab', {name: 'Logs'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', {name: 'Aggregates'})).toHaveAttribute(
      'aria-selected',
      'false'
    );
  });

  it('should pass caseInsensitive to the query', async () => {
    render(
      <ProviderWrapper>
        <LogsTabContent datePageFilterProps={datePageFilterProps} />
      </ProviderWrapper>,
      {initialRouterConfig, organization}
    );

    expect(eventTableMock).toHaveBeenCalled();

    const caseInsensitiveBtn = await screen.findByRole('button', {
      name: 'Ignore case',
    });
    await userEvent.click(caseInsensitiveBtn);

    expect(eventTableMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events/`,
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          statsPeriod: '14d',
          dataset: 'ourlogs',
          field: [...AlwaysPresentLogFields, 'message', 'sentry.message.parameters.0'],
          sort: 'sentry.message.parameters.0',
          query: 'severity:error',
          caseInsensitive: '1',
        }),
      })
    );

    expect(eventsTimeSeriesMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/events-timeseries/`,
      expect.objectContaining({
        query: expect.objectContaining({
          caseInsensitive: 1,
          dataset: 'ourlogs',
          disableAggregateExtrapolation: '0',
          environment: [],
          excludeOther: 0,
          groupBy: [],
          interval: '1h',
          partial: 1,
          project: [2],
          query: 'severity:error',
          referrer: 'api.explore.ourlogs-timeseries',
          sampling: 'NORMAL',
          sort: '-count_message',
          statsPeriod: '14d',
          topEvents: undefined,
          yAxis: ['count(message)'],
        }),
      })
    );
  });

  it('should add a timestamp_precise filter when autorefresh is enabled', async () => {
    const autorefreshEnabledRouterConfig = structuredClone(initialRouterConfig);
    autorefreshEnabledRouterConfig.location.query[LOGS_AUTO_REFRESH_KEY] = 'enabled';
    render(
      <ProviderWrapper>
        <LogsTabContent datePageFilterProps={datePageFilterProps} />
      </ProviderWrapper>,
      {
        initialRouterConfig: autorefreshEnabledRouterConfig,
        organization,
      }
    );

    await waitFor(() => {
      expect(eventsTimeSeriesMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/events-timeseries/`,
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'severity:error timestamp_precise:<=1508208040000000000',
          }),
        })
      );
    });
  });
});
