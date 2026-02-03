import {useState, type ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {AggregateDropdown} from 'sentry/views/explore/metrics/metricToolbar/aggregateDropdown';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

interface WrapperOptions {
  queryParams?: ReadableQueryParams;
  setQueryParams?: jest.Mock | ((params: ReadableQueryParams) => void);
  /** For stateful tests that need queryParams to update on change */
  stateful?: boolean;
  traceMetric?: TraceMetric;
}

function createWrapper(options: WrapperOptions = {}) {
  const defaultQueryParams = new ReadableQueryParams({
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

  return function Wrapper({children}: {children: ReactNode}) {
    const [stateQueryParams, setStateQueryParams] = useState(
      options.queryParams ?? defaultQueryParams
    );

    const handleSetQueryParams = (nextParams: ReadableQueryParams) => {
      options.setQueryParams?.(nextParams);
      if (options.stateful) {
        setStateQueryParams(nextParams);
      }
    };

    const queryParams = options.stateful
      ? stateQueryParams
      : (options.queryParams ?? defaultQueryParams);

    return (
      <MultiMetricsQueryParamsProvider>
        <MetricsQueryParamsProvider
          traceMetric={options.traceMetric ?? {name: 'test_metric', type: 'distribution'}}
          queryParams={queryParams}
          setQueryParams={handleSetQueryParams}
          setTraceMetric={() => {}}
          removeMetric={() => {}}
        >
          {children}
        </MetricsQueryParamsProvider>
      </MultiMetricsQueryParamsProvider>
    );
  };
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
      <AggregateDropdown traceMetric={{name: 'test_metric', type: 'distribution'}} />,
      {
        organization,
        additionalWrapper: createWrapper(),
      }
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
      <AggregateDropdown traceMetric={{name: 'test_metric', type: 'distribution'}} />,
      {
        organization,
        additionalWrapper: createWrapper({queryParams}),
      }
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

    render(
      <AggregateDropdown traceMetric={{name: 'test_metric', type: 'distribution'}} />,
      {
        organization,
        additionalWrapper: createWrapper({queryParams, setQueryParams}),
      }
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
        new VisualizeFunction('p90(value,test_metric,distribution,-)'),
      ],
      aggregateSortBys: [{field: 'p50(value,test_metric,distribution,-)', kind: 'desc'}],
    });

    render(
      <AggregateDropdown traceMetric={{name: 'test_metric', type: 'distribution'}} />,
      {
        organization,
        additionalWrapper: createWrapper({queryParams, setQueryParams, stateful: true}),
      }
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

    render(<AggregateDropdown traceMetric={{name: 'test_metric', type: 'counter'}} />, {
      organization,
      additionalWrapper: createWrapper({
        queryParams,
        traceMetric: {name: 'test_metric', type: 'counter'},
      }),
    });

    const trigger = screen.getByRole('button', {name: /Agg/});
    await userEvent.click(trigger);

    expect(await screen.findByText('Rate')).toBeInTheDocument();
    expect(await screen.findByText('Math')).toBeInTheDocument();
    expect(await screen.findByRole('option', {name: 'per_second'})).toBeInTheDocument();
    expect(await screen.findByRole('option', {name: 'sum'})).toBeInTheDocument();
  });

  it('deselects incompatible aggregates when selecting from a different group', async () => {
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
      aggregateFields: [
        new VisualizeFunction('p50(value,test_metric,distribution,-)'),
        new VisualizeFunction('p90(value,test_metric,distribution,-)'),
      ],
      aggregateSortBys: [{field: 'p50(value,test_metric,distribution,-)', kind: 'desc'}],
    });

    render(
      <AggregateDropdown traceMetric={{name: 'test_metric', type: 'distribution'}} />,
      {
        organization,
        additionalWrapper: createWrapper({queryParams, setQueryParams, stateful: true}),
      }
    );

    const trigger = screen.getByRole('button', {name: /Agg/});
    await userEvent.click(trigger);

    await waitFor(() =>
      expect(screen.getByRole('option', {name: 'p50'})).toHaveAttribute(
        'aria-selected',
        'true'
      )
    );
    await waitFor(() =>
      expect(screen.getByRole('option', {name: 'p90'})).toHaveAttribute(
        'aria-selected',
        'true'
      )
    );

    await userEvent.click(screen.getByRole('option', {name: 'sum'}));

    await waitFor(() => {
      expect(setQueryParams).toHaveBeenCalled();
    });

    const callArgs = setQueryParams.mock.calls[setQueryParams.mock.calls.length - 1]![0];
    expect(callArgs.aggregateFields).toHaveLength(1);
    expect(callArgs.aggregateFields[0].parsedFunction?.name).toBe('sum');
  });

  it('allows multiple selections within the same group', async () => {
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

    render(
      <AggregateDropdown traceMetric={{name: 'test_metric', type: 'distribution'}} />,
      {
        organization,
        additionalWrapper: createWrapper({queryParams, setQueryParams, stateful: true}),
      }
    );

    const trigger = screen.getByRole('button', {name: /Agg/});
    await userEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', {name: 'p50'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    await userEvent.click(screen.getByRole('option', {name: 'p90'}));

    await waitFor(() => {
      expect(setQueryParams).toHaveBeenCalled();
    });

    const callArgs = setQueryParams.mock.calls[setQueryParams.mock.calls.length - 1]![0];
    expect(callArgs.aggregateFields).toHaveLength(2);
    expect(callArgs.aggregateFields[0].parsedFunction?.name).toBe('p50');
    expect(callArgs.aggregateFields[1].parsedFunction?.name).toBe('p90');
  });

  it('switches groups correctly when going from math to rate', async () => {
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
      aggregateFields: [
        new VisualizeFunction('sum(value,test_metric,distribution,-)'),
        new VisualizeFunction('count(value,test_metric,distribution,-)'),
      ],
      aggregateSortBys: [{field: 'sum(value,test_metric,distribution,-)', kind: 'desc'}],
    });

    render(
      <AggregateDropdown traceMetric={{name: 'test_metric', type: 'distribution'}} />,
      {
        organization,
        additionalWrapper: createWrapper({queryParams, setQueryParams, stateful: true}),
      }
    );

    const trigger = screen.getByRole('button', {name: /Agg/});
    await userEvent.click(trigger);

    await waitFor(() =>
      expect(screen.getByRole('option', {name: 'sum'})).toHaveAttribute(
        'aria-selected',
        'true'
      )
    );
    await waitFor(() =>
      expect(screen.getByRole('option', {name: 'count'})).toHaveAttribute(
        'aria-selected',
        'true'
      )
    );

    await userEvent.click(screen.getByRole('option', {name: 'per_second'}));

    await waitFor(() => {
      expect(setQueryParams).toHaveBeenCalled();
    });

    const callArgs = setQueryParams.mock.calls[setQueryParams.mock.calls.length - 1]![0];
    expect(callArgs.aggregateFields).toHaveLength(1);
    expect(callArgs.aggregateFields[0].parsedFunction?.name).toBe('per_second');
  });
});
