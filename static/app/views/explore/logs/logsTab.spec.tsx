import {initializeLogsTest} from 'sentry-fixture/log';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {LogsAnalyticsPageSource} from 'sentry/utils/analytics/logsAnalyticsEvent';
import {mockElementSize} from 'sentry/utils/fixtures/virtualization';
import {localStorageWrapper} from 'sentry/utils/localStorage';
import {LOGS_AUTO_REFRESH_KEY} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {LogsPageDataProvider} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  LOGS_FIELDS_KEY,
  LOGS_QUERY_KEY,
} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  LOGS_AGGREGATE_SORT_BYS_KEY,
  LOGS_SORT_BYS_KEY,
} from 'sentry/views/explore/contexts/logs/sortBys';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {AlwaysPresentLogFields} from 'sentry/views/explore/logs/constants';
import {LOGS_AGGREGATE_FIELD_KEY} from 'sentry/views/explore/logs/logsQueryParams';
import {LogsQueryParamsProvider} from 'sentry/views/explore/logs/logsQueryParamsProvider';
import {LogsTabContent} from 'sentry/views/explore/logs/logsTab';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import * as QueryParamsContext from 'sentry/views/explore/queryParams/context';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';

function LogsTabContentHarness({
  datePageFilterProps,
}: {
  datePageFilterProps: DatePageFilterProps;
}) {
  return <LogsTabContent datePageFilterProps={datePageFilterProps} />;
}

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

beforeEach(() => {
  mockElementSize();
});

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
        <LogsPageDataProvider>{children}</LogsPageDataProvider>
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
      url: `/customers/${organization.slug}/`,
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/validate/`,
      method: 'GET',
      body: {
        dataset: [],
        environment: [],
        field: [],
        orderby: [],
        projects: [],
        query: {error: null, fields: [], valid: true},
        valid: true,
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/stats_v2/`,
      method: 'GET',
      body: {},
    });
  });

  it('should call APIs as expected', async () => {
    render(<LogsTabContentHarness datePageFilterProps={datePageFilterProps} />, {
      initialRouterConfig,
      organization,
      additionalWrapper: ProviderWrapper,
    });

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
          yAxis: ['count(message)'],
        }),
      })
    );

    const table = screen.getByTestId('logs-table');
    await screen.findByText('some log message1');
    expect(table).toHaveTextContent(/some log message1/);
    expect(table).toHaveTextContent(/some log message2/);
  });

  it('removes invalid selected columns after validation', async () => {
    const validationBody: EventValidationData = {
      dataset: [],
      environment: [],
      field: [
        {attrType: 'number', error: null, name: 'custom.duration', valid: true},
        {attrType: 'boolean', error: null, name: 'custom.enabled', valid: true},
        {
          attrType: null,
          error: 'unknown attribute',
          name: 'invalid.attribute',
          valid: false,
        },
      ],
      orderby: [],
      projects: [],
      query: {error: null, fields: [], valid: true},
      valid: false,
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/validate/`,
      method: 'GET',
      body: validationBody,
    });

    const customColumnsRouterConfig = structuredClone(initialRouterConfig);
    customColumnsRouterConfig.location.query[LOGS_FIELDS_KEY] = [
      'custom.duration',
      'custom.enabled',
      'invalid.attribute',
    ];
    customColumnsRouterConfig.location.query[LOGS_SORT_BYS_KEY] = ['invalid.attribute'];
    localStorageWrapper.setItem(
      'logs-params-v2',
      JSON.stringify({
        fields: customColumnsRouterConfig.location.query[LOGS_FIELDS_KEY],
        sortBys: [{field: 'invalid.attribute', kind: 'asc'}],
      })
    );

    const {router} = render(
      <LogsTabContentHarness datePageFilterProps={datePageFilterProps} />,
      {
        initialRouterConfig: customColumnsRouterConfig,
        organization,
        additionalWrapper: ProviderWrapper,
      }
    );

    await waitFor(() => {
      expect(router.location.query[LOGS_FIELDS_KEY]).toEqual([
        'custom.duration',
        'custom.enabled',
      ]);
      expect(router.location.query[LOGS_SORT_BYS_KEY]).toBeUndefined();
    });
    expect(JSON.parse(localStorageWrapper.getItem('logs-params-v2')!)).toMatchObject({
      fields: ['custom.duration', 'custom.enabled'],
      sortBys: [],
    });

    await waitFor(() => {
      expect(eventTableMock).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/events/`,
        expect.objectContaining({
          query: expect.objectContaining({
            field: expect.not.arrayContaining(['invalid.attribute']),
            sort: expect.not.stringContaining('invalid.attribute'),
          }),
        })
      );
    });
  });

  it('retries invalid column cleanup when fields remain stale after refetch', async () => {
    const setQueryParams = jest.fn();
    const setQueryParamsSpy = jest
      .spyOn(QueryParamsContext, 'useSetQueryParams')
      .mockReturnValue(setQueryParams);
    const validationBody: EventValidationData = {
      dataset: [],
      environment: [],
      field: [
        {attrType: 'number', error: null, name: 'custom.duration', valid: true},
        {
          attrType: null,
          error: 'unknown attribute',
          name: 'invalid.attribute',
          valid: false,
        },
        {
          attrType: null,
          error: 'unknown attribute',
          name: 'other.invalid.attribute',
          valid: false,
        },
      ],
      orderby: [],
      projects: [],
      query: {error: null, fields: [], valid: true},
      valid: false,
    };
    const validationMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/validate/`,
      method: 'GET',
      body: validationBody,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      method: 'POST',
      body: {},
    });
    const customColumnsRouterConfig = structuredClone(initialRouterConfig);
    customColumnsRouterConfig.location.query[LOGS_FIELDS_KEY] = [
      'custom.duration',
      'invalid.attribute',
    ];

    try {
      const {router} = render(
        <LogsTabContentHarness datePageFilterProps={datePageFilterProps} />,
        {
          initialRouterConfig: customColumnsRouterConfig,
          organization,
          additionalWrapper: ProviderWrapper,
        }
      );

      await waitFor(() => {
        expect(setQueryParams).toHaveBeenCalledTimes(1);
      });

      const nextSearch = new URLSearchParams();
      nextSearch.append(LOGS_FIELDS_KEY, 'custom.duration');
      nextSearch.append(LOGS_FIELDS_KEY, 'other.invalid.attribute');
      nextSearch.set(LOGS_QUERY_KEY, 'severity:warning');
      router.navigate(
        `/organizations/${organization.slug}/explore/logs/?${nextSearch.toString()}`
      );

      await waitFor(() => {
        expect(validationMock).toHaveBeenCalledTimes(2);
      });
      await waitFor(() => {
        expect(setQueryParams).toHaveBeenCalledTimes(2);
      });
    } finally {
      setQueryParamsSpy.mockRestore();
    }
  });

  it('removes invalid sample and aggregate columns together after validation', async () => {
    const validationBody: EventValidationData = {
      dataset: [],
      environment: [],
      field: [
        {attrType: 'number', error: null, name: 'custom.duration', valid: true},
        {
          attrType: null,
          error: 'unknown attribute',
          name: 'invalid.attribute',
          valid: false,
        },
      ],
      orderby: [],
      projects: [],
      query: {error: null, fields: [], valid: true},
      valid: false,
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/validate/`,
      method: 'GET',
      body: validationBody,
    });
    const aggregateRouterConfig = {
      ...initialRouterConfig,
      location: {
        ...initialRouterConfig.location,
        query: {
          ...initialRouterConfig.location.query,
          mode: Mode.AGGREGATE,
          [LOGS_FIELDS_KEY]: ['custom.duration', 'invalid.attribute'],
          [LOGS_SORT_BYS_KEY]: ['invalid.attribute'],
          [LOGS_AGGREGATE_FIELD_KEY]: [
            JSON.stringify({groupBy: 'invalid.attribute'}),
            JSON.stringify({groupBy: 'severity'}),
            JSON.stringify({yAxes: ['count(message)']}),
          ],
          [LOGS_AGGREGATE_SORT_BYS_KEY]: ['invalid.attribute'],
        },
      },
    };

    const {router} = render(
      <LogsTabContentHarness datePageFilterProps={datePageFilterProps} />,
      {
        initialRouterConfig: aggregateRouterConfig,
        organization,
        additionalWrapper: ProviderWrapper,
      }
    );

    await waitFor(() => {
      expect(router.location.query[LOGS_FIELDS_KEY]).toBe('custom.duration');
      expect(router.location.query[LOGS_SORT_BYS_KEY]).toBeUndefined();
      expect(router.location.query[LOGS_AGGREGATE_FIELD_KEY]).toEqual([
        JSON.stringify({groupBy: 'severity'}),
        JSON.stringify({yAxes: ['count(message)']}),
      ]);
      expect(router.location.query[LOGS_AGGREGATE_SORT_BYS_KEY]).toBeUndefined();
    });
  });

  it('should switch between modes', async () => {
    render(<LogsTabContentHarness datePageFilterProps={datePageFilterProps} />, {
      initialRouterConfig,
      organization,
      additionalWrapper: ProviderWrapper,
    });

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
    render(<LogsTabContentHarness datePageFilterProps={datePageFilterProps} />, {
      initialRouterConfig,
      organization,
      additionalWrapper: ProviderWrapper,
    });

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
          yAxis: ['count(message)'],
        }),
      })
    );
  });

  it('should add a timestamp_precise filter when autorefresh is enabled', async () => {
    const autorefreshEnabledRouterConfig = structuredClone(initialRouterConfig);
    autorefreshEnabledRouterConfig.location.query[LOGS_AUTO_REFRESH_KEY] = 'enabled';
    render(<LogsTabContentHarness datePageFilterProps={datePageFilterProps} />, {
      initialRouterConfig: autorefreshEnabledRouterConfig,
      organization,
      additionalWrapper: ProviderWrapper,
    });

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

  it('should disable manual refresh button when autorefresh is enabled', async () => {
    const autorefreshEnabledRouterConfig = structuredClone(initialRouterConfig);
    autorefreshEnabledRouterConfig.location.query[LOGS_AUTO_REFRESH_KEY] = 'enabled';
    render(<LogsTabContentHarness datePageFilterProps={datePageFilterProps} />, {
      initialRouterConfig: autorefreshEnabledRouterConfig,
      organization,
      additionalWrapper: ProviderWrapper,
    });
    const refreshButton = await screen.findByRole('button', {name: 'Refresh'});
    expect(refreshButton).toBeDisabled();
  });
});
