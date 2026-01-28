import {useState, type ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {AggregateDropdown} from 'sentry/views/explore/metrics/metricToolbar/aggregateDropdown';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

function Wrapper({
  children,
  queryParams,
}: {
  children: ReactNode;
  queryParams?: ReadableQueryParams;
}) {
  const defaultQueryParams =
    queryParams ??
    new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.SAMPLES,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [
        new VisualizeFunction('per_second(value,test_metric,distribution,-)'),
      ],
      aggregateSortBys: [
        {field: 'per_second(value,test_metric,distribution,-)', kind: 'desc'},
      ],
    });

  return (
    <MultiMetricsQueryParamsProvider>
      <MetricsQueryParamsProvider
        traceMetric={{name: 'test_metric', type: 'distribution'}}
        queryParams={defaultQueryParams}
        setQueryParams={() => {}}
        setTraceMetric={() => {}}
        removeMetric={() => {}}
      >
        {children}
      </MetricsQueryParamsProvider>
    </MultiMetricsQueryParamsProvider>
  );
}

describe('AggregateDropdown', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders single-select dropdown without feature flag', async () => {
    const organization = OrganizationFixture({
      features: [],
    });

    render(
      <Wrapper>
        <AggregateDropdown traceMetric={{name: 'test_metric', type: 'distribution'}} />
      </Wrapper>,
      {organization}
    );

    const trigger = screen.getByRole('button', {name: /Agg/});
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger);

    expect(await screen.findByRole('option', {name: 'p50'})).toBeInTheDocument();
    expect(await screen.findByRole('option', {name: 'p75'})).toBeInTheDocument();
    expect(await screen.findByRole('option', {name: 'p99'})).toBeInTheDocument();
  });

  it('renders multi-select dropdown with grouped options when feature enabled', async () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-overlay-charts-ui'],
    });

    const queryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.SAMPLES,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [
        new VisualizeFunction('p50(value,test_metric,distribution,-)'),
        new VisualizeFunction('p75(value,test_metric,distribution,-)'),
      ],
      aggregateSortBys: [{field: 'p50(value,test_metric,distribution,-)', kind: 'desc'}],
    });

    render(
      <Wrapper queryParams={queryParams}>
        <AggregateDropdown traceMetric={{name: 'test_metric', type: 'distribution'}} />
      </Wrapper>,
      {organization}
    );

    const trigger = screen.getByRole('button', {name: /Agg/});
    expect(trigger).toBeInTheDocument();

    await userEvent.click(trigger);

    expect(await screen.findByText('Percentiles')).toBeInTheDocument();
    expect(await screen.findByText('Math')).toBeInTheDocument();
    expect(await screen.findByText('Rate')).toBeInTheDocument();

    expect(screen.getByRole('option', {name: 'p50'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('option', {name: 'p75'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('updates multiple visualizes on selection change', async () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-overlay-charts-ui'],
    });

    const setQueryParams = jest.fn();
    const queryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.SAMPLES,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [new VisualizeFunction('p50(value,test_metric,distribution,-)')],
      aggregateSortBys: [{field: 'p50(value,test_metric,distribution,-)', kind: 'desc'}],
    });

    function WrapperWithMock({children}: {children: ReactNode}) {
      return (
        <MultiMetricsQueryParamsProvider>
          <MetricsQueryParamsProvider
            traceMetric={{name: 'test_metric', type: 'distribution'}}
            queryParams={queryParams}
            setQueryParams={setQueryParams}
            setTraceMetric={() => {}}
            removeMetric={() => {}}
          >
            {children}
          </MetricsQueryParamsProvider>
        </MultiMetricsQueryParamsProvider>
      );
    }

    render(
      <WrapperWithMock>
        <AggregateDropdown traceMetric={{name: 'test_metric', type: 'distribution'}} />
      </WrapperWithMock>,
      {organization}
    );

    const trigger = screen.getByRole('button', {name: /Agg/});
    await userEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', {name: 'p75'})).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('option', {name: 'p75'}));

    await waitFor(() => {
      expect(setQueryParams).toHaveBeenCalled();
    });

    const callArgs = setQueryParams.mock.calls[0]![0];
    expect(callArgs.aggregateFields).toHaveLength(2);
    expect(callArgs.aggregateFields[0]).toBeInstanceOf(VisualizeFunction);
    expect(callArgs.aggregateFields[1]).toBeInstanceOf(VisualizeFunction);
  });

  it('defaults to the type yAxis when all selections are cleared', async () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-overlay-charts-ui'],
    });

    const setQueryParams = jest.fn();
    const initialQueryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.SAMPLES,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [
        new VisualizeFunction('p50(value,test_metric,distribution,-)'),
        new VisualizeFunction('p90(value,test_metric,distribution,-)'),
      ],
      aggregateSortBys: [{field: 'p50(value,test_metric,distribution,-)', kind: 'desc'}],
    });

    function WrapperWithState({children}: {children: ReactNode}) {
      const [queryParams, setParams] = useState(initialQueryParams);

      const handleSetQueryParams = (nextQueryParams: ReadableQueryParams) => {
        setQueryParams(nextQueryParams);
        setParams(nextQueryParams);
      };

      return (
        <MultiMetricsQueryParamsProvider>
          <MetricsQueryParamsProvider
            traceMetric={{name: 'test_metric', type: 'distribution'}}
            queryParams={queryParams}
            setQueryParams={handleSetQueryParams}
            setTraceMetric={() => {}}
            removeMetric={() => {}}
          >
            {children}
          </MetricsQueryParamsProvider>
        </MultiMetricsQueryParamsProvider>
      );
    }

    render(
      <WrapperWithState>
        <AggregateDropdown traceMetric={{name: 'test_metric', type: 'distribution'}} />
      </WrapperWithState>,
      {organization}
    );

    const trigger = screen.getByRole('button', {name: /Agg/});
    await userEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', {name: 'p50'})).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('option', {name: 'p50'}));

    await waitFor(() => {
      expect(screen.getByRole('option', {name: 'p50'})).toHaveAttribute(
        'aria-selected',
        'false'
      );
    });

    await userEvent.click(screen.getByRole('option', {name: 'p90'}));

    const callArgs = setQueryParams.mock.calls[setQueryParams.mock.calls.length - 1]![0];
    expect(callArgs.aggregateFields).toHaveLength(1);
    expect(callArgs.aggregateFields[0]).toBeInstanceOf(VisualizeFunction);
    expect(callArgs.aggregateFields[0].parsedFunction?.name).toBe('p75');
  });

  it('shows correct options for counter metric type', async () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-overlay-charts-ui'],
    });

    const queryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.SAMPLES,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [new VisualizeFunction('per_second(value,test_metric,counter,-)')],
      aggregateSortBys: [
        {field: 'per_second(value,test_metric,counter,-)', kind: 'desc'},
      ],
    });

    function WrapperForCounter({children}: {children: ReactNode}) {
      return (
        <MultiMetricsQueryParamsProvider>
          <MetricsQueryParamsProvider
            traceMetric={{name: 'test_metric', type: 'counter'}}
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
      <WrapperForCounter>
        <AggregateDropdown traceMetric={{name: 'test_metric', type: 'counter'}} />
      </WrapperForCounter>,
      {organization}
    );

    const trigger = screen.getByRole('button', {name: /Agg/});
    await userEvent.click(trigger);

    expect(await screen.findByText('Rate')).toBeInTheDocument();
    expect(await screen.findByText('Math')).toBeInTheDocument();
    expect(await screen.findByRole('option', {name: 'per_second'})).toBeInTheDocument();
    expect(await screen.findByRole('option', {name: 'sum'})).toBeInTheDocument();
  });
});
