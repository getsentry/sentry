import type {ReactNode} from 'react';
import {PageFiltersFixture, PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {initializeTraceMetricsTest} from 'sentry-fixture/tracemetrics';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {MetricsAggregateExportModalButton} from 'sentry/views/explore/metrics/exports/metricsAggregateExportModalButton';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import type {GroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

const mockDownloadFromHref = jest.fn();
jest.mock('sentry/utils/downloadFromHref', () => ({
  downloadFromHref: (...args: unknown[]) => mockDownloadFromHref(...args),
}));

jest.mock('sentry/components/pageFilters/usePageFilters');

const TRACE_METRIC: TraceMetric = {name: 'llm.token_usage', type: 'distribution'};
const SUM_AGGREGATE = 'sum(value,llm.token_usage,distribution,-)';
const COUNT_AGGREGATE = 'count(metric.name,llm.token_usage,distribution,none)';

const nextPageLink =
  '<https://sentry.io/api/0/?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"';

const groupBy: GroupBy = {groupBy: 'model'};

const tableData = [
  {model: 'gpt-5', [SUM_AGGREGATE]: 17, [COUNT_AGGREGATE]: 4},
  {model: 'claude-opus-5', [SUM_AGGREGATE]: 13, [COUNT_AGGREGATE]: 2},
];

describe('MetricsAggregateExportModalButton', () => {
  const {organization} = initializeTraceMetricsTest();

  function renderButton({
    isError = false,
    isLoading = false,
    pageLinks,
    rows = tableData,
  }: {
    isError?: boolean;
    isLoading?: boolean;
    pageLinks?: string;
    rows?: Array<Record<string, unknown>>;
  } = {}) {
    const queryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.AGGREGATE,
      query: 'model:gpt-5',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [groupBy, new VisualizeFunction(SUM_AGGREGATE)],
      aggregateSortBys: [{field: SUM_AGGREGATE, kind: 'desc'}],
    });

    function Wrapper({children}: {children: ReactNode}) {
      return (
        <MultiMetricsQueryParamsProvider>
          <MetricsQueryParamsProvider
            traceMetric={TRACE_METRIC}
            queryParams={queryParams}
            setQueryParams={() => {}}
            setTraceMetric={() => {}}
            removeMetric={() => {}}
          >
            {children}
          </MetricsQueryParamsProvider>
        </MultiMetricsQueryParamsProvider>
      );
    }

    render(
      <Wrapper>
        <MetricsAggregateExportModalButton
          isError={isError}
          isLoading={isLoading}
          pageLinks={pageLinks}
          tableData={rows}
          traceMetric={TRACE_METRIC}
        />
      </Wrapper>,
      {organization}
    );
    renderGlobalModal();
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
    jest.mocked(usePageFilters).mockReturnValue(
      PageFilterStateFixture({
        selection: PageFiltersFixture({
          datetime: {start: null, end: null, period: '24h', utc: null},
        }),
      })
    );
  });

  it('downloads locally without a server export when all rows are loaded', async () => {
    const exportRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      body: {},
    });

    renderButton();
    await userEvent.click(screen.getByRole('button', {name: 'Export Data'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(mockDownloadFromHref).toHaveBeenCalled();
    });
    expect(exportRequest).not.toHaveBeenCalled();
  });

  it('sends the group by and aggregate fields to the server export when more rows remain', async () => {
    const exportRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      body: {},
    });

    renderButton({pageLinks: nextPageLink});
    await userEvent.click(screen.getByRole('button', {name: 'Export Data'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(exportRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/data-export/`,
        expect.objectContaining({
          data: expect.objectContaining({
            query_type: 'Explore',
            query_info: expect.objectContaining({
              dataset: 'tracemetrics',
              field: ['model', SUM_AGGREGATE, COUNT_AGGREGATE],
              query: 'model:gpt-5',
              sort: [`-${SUM_AGGREGATE}`],
              // The aggregates table doesn't delay its window, so neither does its export
              statsPeriod: '24h',
            }),
          }),
        })
      );
    });
  });

  it('disables the button when the table has no rows', () => {
    renderButton({rows: []});

    expect(screen.getByRole('button', {name: 'Export Data'})).toBeDisabled();
  });

  it('disables the button when the table errored', () => {
    renderButton({isError: true});

    expect(screen.getByRole('button', {name: 'Export Data'})).toBeDisabled();
  });
});
