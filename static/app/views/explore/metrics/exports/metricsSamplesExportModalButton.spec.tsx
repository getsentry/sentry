import type {ReactNode} from 'react';
import {PageFilterStateFixture} from 'sentry-fixture/pageFilters';
import {initializeTraceMetricsTest} from 'sentry-fixture/tracemetrics';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {MetricsSamplesExportModalButton} from 'sentry/views/explore/metrics/exports/metricsSamplesExportModalButton';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
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

const fields = ['timestamp', 'value'];

const tableData = [
  {id: '1', timestamp: '2026-08-07T00:00:00Z', value: 17},
  {id: '2', timestamp: '2026-08-07T00:01:00Z', value: 13},
];

describe('MetricsSamplesExportModalButton', () => {
  const {organization} = initializeTraceMetricsTest();

  function renderButton({
    isError = false,
    isLoading = false,
    rows = tableData,
  }: {
    isError?: boolean;
    isLoading?: boolean;
    rows?: Array<Record<string, unknown>>;
  } = {}) {
    const queryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.SAMPLES,
      query: 'model:gpt-5',
      cursor: '',
      fields,
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [new VisualizeFunction(SUM_AGGREGATE)],
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
        <MetricsSamplesExportModalButton
          fields={fields}
          isError={isError}
          isLoading={isLoading}
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
    jest.mocked(usePageFilters).mockReturnValue(PageFilterStateFixture());
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      method: 'GET',
      body: {data: []},
    });
  });

  it('narrows the server export to the panel metric when exporting more rows than are loaded', async () => {
    const exportRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      body: {},
    });

    renderButton();
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
              query: 'model:gpt-5 metric.name:llm.token_usage metric.type:distribution',
              sort: ['-timestamp'],
            }),
          }),
        })
      );
    });
  });

  it('exports the fields the samples table always queries when only some are selected', async () => {
    const exportRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/data-export/`,
      method: 'POST',
      body: {},
    });

    renderButton();
    await userEvent.click(screen.getByRole('button', {name: 'Export Data'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Export'}));

    await waitFor(() => {
      expect(exportRequest).toHaveBeenCalled();
    });
    const exportedFields = exportRequest.mock.calls[0][1].data.query_info.field;
    expect(exportedFields).toEqual(expect.arrayContaining(fields));
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
