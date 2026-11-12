import {useState, type ReactNode} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {MetricsQueryParamsProvider} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MultiMetricsQueryParamsProvider} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {
  OPPORTUNITY_SCORE_FIELD,
  PERFORMANCE_SCORE_FIELD,
  SCORE_FORMULA_METRIC,
} from 'sentry/views/explore/metrics/scoreFormulas';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

import {AggregateDropdown} from './aggregateDropdown';

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
    aggregateFields: [new VisualizeFunction('sum(value,test_metric,distribution,none)')],
    aggregateSortBys: [{field: 'sum(value,test_metric,distribution,none)', kind: 'desc'}],
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
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders multi-select dropdown with grouped options', async () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-enabled'],
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
        new VisualizeFunction('p50(value,test_metric,distribution,none)'),
        new VisualizeFunction('p75(value,test_metric,distribution,none)'),
      ],
      aggregateSortBys: [
        {field: 'p50(value,test_metric,distribution,none)', kind: 'desc'},
      ],
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

  describe('web vital scores metric', () => {
    const organization = OrganizationFixture({features: ['tracemetrics-enabled']});

    function scoresQueryParams(yAxis: string) {
      return new ReadableQueryParams({
        extrapolate: true,
        mode: Mode.AGGREGATE,
        query: '',
        cursor: '',
        fields: ['id', 'timestamp'],
        sortBys: [{field: 'timestamp', kind: 'desc'}],
        aggregateCursor: '',
        aggregateFields: [new VisualizeFunction(yAxis)],
        aggregateSortBys: [{field: yAxis, kind: 'desc'}],
      });
    }

    it('offers only the score formulas on the stand-in metric', async () => {
      render(<AggregateDropdown traceMetric={SCORE_FORMULA_METRIC} />, {
        organization,
        additionalWrapper: createWrapper({
          queryParams: scoresQueryParams(PERFORMANCE_SCORE_FIELD),
          traceMetric: SCORE_FORMULA_METRIC,
        }),
      });

      const trigger = screen.getByRole('button', {name: /Agg/});
      expect(within(trigger).getByText('performance_score')).toBeInTheDocument();

      await userEvent.click(trigger);

      expect(await screen.findByText('Scores')).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'performance_score'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByRole('option', {name: 'opportunity_score'})).toHaveAttribute(
        'aria-selected',
        'false'
      );
      expect(screen.queryByText('Percentiles')).not.toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'p75'})).not.toBeInTheDocument();
    });

    it('selects a formula as a fixed y-axis', async () => {
      const setQueryParams = jest.fn();
      render(<AggregateDropdown traceMetric={SCORE_FORMULA_METRIC} />, {
        organization,
        additionalWrapper: createWrapper({
          queryParams: scoresQueryParams(PERFORMANCE_SCORE_FIELD),
          traceMetric: SCORE_FORMULA_METRIC,
          setQueryParams,
        }),
      });

      await userEvent.click(screen.getByRole('button', {name: /Agg/}));
      await userEvent.click(
        await screen.findByRole('option', {name: 'opportunity_score'})
      );

      await waitFor(() => expect(setQueryParams).toHaveBeenCalled());
      expect(setQueryParams.mock.lastCall![0].aggregateFields).toEqual([
        new VisualizeFunction(OPPORTUNITY_SCORE_FIELD),
      ]);
    });

    it('treats performance_score as the default and offers Clear otherwise', async () => {
      const setQueryParams = jest.fn();
      render(<AggregateDropdown traceMetric={SCORE_FORMULA_METRIC} />, {
        organization,
        additionalWrapper: createWrapper({
          queryParams: scoresQueryParams(OPPORTUNITY_SCORE_FIELD),
          traceMetric: SCORE_FORMULA_METRIC,
          setQueryParams,
        }),
      });

      await userEvent.click(screen.getByRole('button', {name: /Agg/}));
      await userEvent.click(await screen.findByRole('button', {name: 'Clear'}));

      await waitFor(() => expect(setQueryParams).toHaveBeenCalled());
      expect(setQueryParams.mock.lastCall![0].aggregateFields).toEqual([
        new VisualizeFunction(PERFORMANCE_SCORE_FIELD),
      ]);
    });

    it('keeps the regular aggregates for stored metrics', async () => {
      render(
        <AggregateDropdown traceMetric={{name: 'test_metric', type: 'distribution'}} />,
        {organization, additionalWrapper: createWrapper()}
      );

      await userEvent.click(screen.getByRole('button', {name: /Agg/}));

      expect(await screen.findByText('Percentiles')).toBeInTheDocument();
      expect(screen.queryByText('Scores')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('option', {name: 'performance_score'})
      ).not.toBeInTheDocument();
    });
  });

  it('only shows the Clear button when the selection differs from the default', async () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-enabled'],
    });

    const {unmount} = render(
      <AggregateDropdown traceMetric={{name: 'test_metric', type: 'distribution'}} />,
      {
        organization,
        additionalWrapper: createWrapper(),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: /Agg/}));
    expect(await screen.findByText('Percentiles')).toBeInTheDocument();
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
    unmount();

    const queryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.SAMPLES,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [
        new VisualizeFunction('p50(value,test_metric,distribution,none)'),
      ],
      aggregateSortBys: [
        {field: 'p50(value,test_metric,distribution,none)', kind: 'desc'},
      ],
    });

    render(
      <AggregateDropdown traceMetric={{name: 'test_metric', type: 'distribution'}} />,
      {
        organization,
        additionalWrapper: createWrapper({queryParams}),
      }
    );

    await userEvent.click(screen.getByRole('button', {name: /Agg/}));
    expect(await screen.findByRole('button', {name: 'Clear'})).toBeInTheDocument();
  });

  it('updates multiple visualizes on selection change', async () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-enabled'],
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
        new VisualizeFunction('p50(value,test_metric,distribution,none)'),
      ],
      aggregateSortBys: [
        {field: 'p50(value,test_metric,distribution,none)', kind: 'desc'},
      ],
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
      features: ['tracemetrics-enabled'],
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
        new VisualizeFunction('p50(value,test_metric,distribution,none)'),
        new VisualizeFunction('p90(value,test_metric,distribution,none)'),
      ],
      aggregateSortBys: [
        {field: 'p50(value,test_metric,distribution,none)', kind: 'desc'},
      ],
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
    expect(callArgs.aggregateFields[0].parsedFunction?.name).toBe('sum');
  });

  it('shows correct options for counter metric type', async () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-enabled'],
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
        new VisualizeFunction('per_second(value,test_metric,counter,none)'),
      ],
      aggregateSortBys: [
        {field: 'per_second(value,test_metric,counter,none)', kind: 'desc'},
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
      features: ['tracemetrics-enabled'],
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
        new VisualizeFunction('p50(value,test_metric,distribution,none)'),
        new VisualizeFunction('p90(value,test_metric,distribution,none)'),
      ],
      aggregateSortBys: [
        {field: 'p50(value,test_metric,distribution,none)', kind: 'desc'},
      ],
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
      features: ['tracemetrics-enabled'],
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
        new VisualizeFunction('p50(value,test_metric,distribution,none)'),
      ],
      aggregateSortBys: [
        {field: 'p50(value,test_metric,distribution,none)', kind: 'desc'},
      ],
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
      features: ['tracemetrics-enabled'],
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
        new VisualizeFunction('sum(value,test_metric,distribution,none)'),
      ],
      aggregateSortBys: [
        {field: 'sum(value,test_metric,distribution,none)', kind: 'desc'},
      ],
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

    await userEvent.click(screen.getByRole('option', {name: 'per_second'}));

    await waitFor(() => {
      expect(setQueryParams).toHaveBeenCalled();
    });

    const callArgs = setQueryParams.mock.calls[setQueryParams.mock.calls.length - 1]![0];
    expect(callArgs.aggregateFields).toHaveLength(1);
    expect(callArgs.aggregateFields[0].parsedFunction?.name).toBe('per_second');
  });

  it('shows selected name in trigger for a single selection', () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-enabled'],
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
        new VisualizeFunction('p50(value,test_metric,distribution,none)'),
      ],
      aggregateSortBys: [
        {field: 'p50(value,test_metric,distribution,none)', kind: 'desc'},
      ],
    });

    render(
      <AggregateDropdown traceMetric={{name: 'test_metric', type: 'distribution'}} />,
      {organization, additionalWrapper: createWrapper({queryParams})}
    );

    const trigger = screen.getByRole('button', {name: /Agg/});
    expect(within(trigger).getByText('p50')).toBeInTheDocument();
    expect(within(trigger).queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it('shows first name and +N badge in trigger for multiple selections', () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-enabled'],
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
        new VisualizeFunction('p50(value,test_metric,distribution,none)'),
        new VisualizeFunction('p75(value,test_metric,distribution,none)'),
        new VisualizeFunction('p90(value,test_metric,distribution,none)'),
      ],
      aggregateSortBys: [
        {field: 'p50(value,test_metric,distribution,none)', kind: 'desc'},
      ],
    });

    render(
      <AggregateDropdown traceMetric={{name: 'test_metric', type: 'distribution'}} />,
      {organization, additionalWrapper: createWrapper({queryParams})}
    );

    const trigger = screen.getByRole('button', {name: /Agg/});
    expect(within(trigger).getByText('p50')).toBeInTheDocument();
    expect(within(trigger).getByText('+2')).toBeInTheDocument();
  });

  it('updates trigger label after selecting an additional option', async () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-enabled'],
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
        new VisualizeFunction('p50(value,test_metric,distribution,none)'),
      ],
      aggregateSortBys: [
        {field: 'p50(value,test_metric,distribution,none)', kind: 'desc'},
      ],
    });

    render(
      <AggregateDropdown traceMetric={{name: 'test_metric', type: 'distribution'}} />,
      {
        organization,
        additionalWrapper: createWrapper({queryParams, stateful: true}),
      }
    );

    const trigger = screen.getByRole('button', {name: /Agg/});
    expect(within(trigger).getByText('p50')).toBeInTheDocument();
    expect(within(trigger).queryByText(/^\+/)).not.toBeInTheDocument();

    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('option', {name: 'p75'}));

    await waitFor(() => {
      expect(within(trigger).getByText('+1')).toBeInTheDocument();
    });
  });

  it('disables aggregate options specified in disabledAggregates with tooltips', async () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-enabled'],
    });

    const queryParams = new ReadableQueryParams({
      extrapolate: true,
      mode: Mode.SAMPLES,
      query: '',
      cursor: '',
      fields: ['id', 'timestamp'],
      sortBys: [{field: 'timestamp', kind: 'desc'}],
      aggregateCursor: '',
      aggregateFields: [new VisualizeFunction('sum(value,test_metric,counter,none)')],
      aggregateSortBys: [{field: 'sum(value,test_metric,counter,none)', kind: 'desc'}],
    });

    render(
      <AggregateDropdown
        traceMetric={{name: 'test_metric', type: 'counter'}}
        disabledAggregates={{
          per_second: 'Rate aggregates are not supported in equations',
          per_minute: 'Rate aggregates are not supported in equations',
        }}
      />,
      {
        organization,
        additionalWrapper: createWrapper({
          queryParams,
          traceMetric: {name: 'test_metric', type: 'counter'},
        }),
      }
    );

    const trigger = screen.getByRole('button', {name: /Agg/});
    await userEvent.click(trigger);

    const perSecondOption = await screen.findByRole('option', {name: 'per_second'});
    const perMinuteOption = screen.getByRole('option', {name: 'per_minute'});
    const sumOption = screen.getByRole('option', {name: 'sum'});

    expect(perSecondOption).toHaveAttribute('aria-disabled', 'true');
    expect(perMinuteOption).toHaveAttribute('aria-disabled', 'true');
    expect(sumOption).not.toHaveAttribute('aria-disabled');
  });

  it('renders all groups as single-select and keeps only the last selection when singleSelect is passed', async () => {
    const organization = OrganizationFixture({
      features: ['tracemetrics-enabled'],
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
        new VisualizeFunction('p50(value,test_metric,distribution,none)'),
      ],
      aggregateSortBys: [
        {field: 'p50(value,test_metric,distribution,none)', kind: 'desc'},
      ],
    });

    render(
      <AggregateDropdown
        traceMetric={{name: 'test_metric', type: 'distribution'}}
        singleSelect
      />,
      {
        organization,
        additionalWrapper: createWrapper({queryParams, stateful: true}),
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

    await userEvent.click(screen.getByRole('option', {name: 'p75'}));

    expect(await within(trigger).findByText('p75')).toBeInTheDocument();
    expect(within(trigger).queryByText(/^\+\d/)).not.toBeInTheDocument();
  });
});
