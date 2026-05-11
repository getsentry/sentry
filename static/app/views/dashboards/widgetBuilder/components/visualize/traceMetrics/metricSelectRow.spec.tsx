import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {AggregationKeyWithAlias, Column} from 'sentry/utils/discover/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {MetricSelectRow} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceMetrics/metricSelectRow';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {FieldValueKind} from 'sentry/views/discover/table/types';

jest.mock('sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext');
const mockedUseWidgetBuilderContext = jest.mocked(useWidgetBuilderContext);

describe('MetricSelectRow', () => {
  let mockDispatch!: jest.Mock;

  beforeEach(() => {
    mockDispatch = jest.fn();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      method: 'GET',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            ['metric.name']: 'alpha_metric',
            ['metric.type']: 'counter',
            ['count(metric.name)']: 1,
          },
          {
            ['metric.name']: 'beta_metric',
            ['metric.type']: 'counter',
            ['count(metric.name)']: 1,
          },
          {
            ['metric.name']: 'counter_metric',
            ['metric.type']: 'counter',
            ['count(metric.name)']: 1,
          },
          {
            ['metric.name']: 'distribution_metric',
            ['metric.type']: 'distribution',
            ['count(metric.name)']: 1,
          },
          {
            ['metric.name']: 'gauge_metric',
            ['metric.type']: 'gauge',
            ['count(metric.name)']: 1,
          },
        ],
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('renders the same metric for all rows', async () => {
    const yAxis: Column[] = [
      {
        kind: FieldValueKind.FUNCTION,
        function: [
          'per_second' as AggregationKeyWithAlias,
          'value',
          'alpha_metric',
          'counter',
          '-',
        ],
      },
      {
        kind: FieldValueKind.FUNCTION,
        function: ['sum', 'value', 'alpha_metric', 'counter', '-'],
      },
    ];

    mockedUseWidgetBuilderContext.mockReturnValue({
      state: {
        dataset: WidgetType.TRACEMETRICS,
        displayType: DisplayType.LINE,
        yAxis,
      },
      dispatch: mockDispatch,
    });

    render(
      <div>
        <MetricSelectRow
          field={{
            kind: 'function',
            function: [
              'per_second' as AggregationKeyWithAlias,
              'value',
              'alpha_metric',
              'counter',
              '-',
            ],
          }}
          index={0}
          disabled={false}
        />
        <MetricSelectRow
          field={{
            kind: 'function',
            function: ['sum', 'value', 'alpha_metric', 'counter', '-'],
          }}
          index={1}
          disabled={false}
        />
      </div>
    );

    // Both metric selectors show the same metric value
    const metricSelectors = await screen.findAllByRole('button', {name: 'alpha_metric'});
    expect(metricSelectors).toHaveLength(2);

    // Change the metric to 'beta_metric'
    await userEvent.click(metricSelectors[0]!);
    await userEvent.click(await screen.findByRole('option', {name: 'beta_metric'}));

    // Verify dispatch was called with updated aggregates
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: BuilderStateAction.SET_Y_AXIS,
        payload: expect.arrayContaining([
          expect.objectContaining({
            kind: FieldValueKind.FUNCTION,
            function: expect.arrayContaining([
              'per_second',
              'value',
              'beta_metric',
              'counter',
            ]),
          }),
        ]),
      });
    });
  });

  it('allows selection for multiple metrics', async () => {
    const yAxis: Column[] = [
      {
        kind: FieldValueKind.FUNCTION,
        function: [
          'per_second' as AggregationKeyWithAlias,
          'value',
          'alpha_metric',
          'counter',
          '-',
        ],
      },
      {
        kind: FieldValueKind.FUNCTION,
        function: ['sum', 'value', 'alpha_metric', 'counter', '-'],
      },
    ];

    mockedUseWidgetBuilderContext.mockReturnValue({
      state: {
        dataset: WidgetType.TRACEMETRICS,
        displayType: DisplayType.LINE,
        yAxis,
      },
      dispatch: mockDispatch,
    });

    render(
      <div>
        {yAxis.map((aggregate, index) => (
          <MetricSelectRow key={index} field={aggregate} index={index} disabled={false} />
        ))}
      </div>,
      {
        organization: {
          features: ['tracemetrics-multi-metric-selection-in-dashboards'],
        },
      }
    );

    // Both metric selectors show the same metric value
    const metricSelectors = await screen.findAllByRole('button', {name: 'alpha_metric'});
    expect(metricSelectors).toHaveLength(2);

    // Change the first metric to 'beta_metric'
    await userEvent.click(metricSelectors[0]!);
    await userEvent.click(await screen.findByRole('option', {name: 'beta_metric'}));

    // In multi-metric mode, only the selected index is updated
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: BuilderStateAction.SET_Y_AXIS,
        payload: expect.arrayContaining([
          expect.objectContaining({
            kind: FieldValueKind.FUNCTION,
            function: expect.arrayContaining([
              'per_second',
              'value',
              'beta_metric',
              'counter',
            ]),
          }),
        ]),
      });
    });
  });

  it('replaces invalid aggregates when changing to an incompatible metric type', async () => {
    const yAxis: Column[] = [
      {
        kind: FieldValueKind.FUNCTION,
        function: ['p50', 'value', 'distribution_metric', 'distribution', '-'],
      },
    ];

    mockedUseWidgetBuilderContext.mockReturnValue({
      state: {
        dataset: WidgetType.TRACEMETRICS,
        displayType: DisplayType.LINE,
        yAxis,
      },
      dispatch: mockDispatch,
    });

    render(
      <MetricSelectRow
        field={{
          kind: 'function',
          function: ['p50', 'value', 'distribution_metric', 'distribution', '-'],
        }}
        index={0}
        disabled={false}
      />
    );

    const metricSelector = await screen.findByRole('button', {
      name: 'distribution_metric',
    });

    // Change to counter_metric (p50 is not valid for counter)
    await userEvent.click(metricSelector);
    await userEvent.click(await screen.findByRole('option', {name: 'counter_metric'}));

    // p50 is invalid for counter, so it should be replaced with sum
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: BuilderStateAction.SET_Y_AXIS,
        payload: [
          {
            kind: FieldValueKind.FUNCTION,
            function: ['sum', 'value', 'counter_metric', 'counter', '-'],
          },
        ],
      });
    });
  });

  it('preserves valid aggregates when changing metric type', async () => {
    const yAxis: Column[] = [
      {
        kind: FieldValueKind.FUNCTION,
        function: ['sum', 'value', 'counter_metric', 'counter', '-'],
      },
    ];

    mockedUseWidgetBuilderContext.mockReturnValue({
      state: {
        dataset: WidgetType.TRACEMETRICS,
        displayType: DisplayType.LINE,
        yAxis,
      },
      dispatch: mockDispatch,
    });

    render(
      <MetricSelectRow
        field={{
          kind: 'function',
          function: ['sum', 'value', 'counter_metric', 'counter', '-'],
        }}
        index={0}
        disabled={false}
      />
    );

    const metricSelector = await screen.findByRole('button', {name: 'counter_metric'});

    // Change to distribution_metric (sum is valid for both types)
    await userEvent.click(metricSelector);
    await userEvent.click(
      await screen.findByRole('option', {name: 'distribution_metric'})
    );

    // sum should remain since it's valid for distribution, but args updated
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: BuilderStateAction.SET_Y_AXIS,
        payload: [
          {
            kind: FieldValueKind.FUNCTION,
            function: ['sum', 'value', 'distribution_metric', 'distribution', '-'],
          },
        ],
      });
    });
  });

  it('handles mixed valid and invalid aggregates on metric change', async () => {
    const yAxis: Column[] = [
      {
        kind: FieldValueKind.FUNCTION,
        function: [
          'per_second' as AggregationKeyWithAlias,
          'value',
          'distribution_metric',
          'distribution',
          '-',
        ],
      },
      {
        kind: FieldValueKind.FUNCTION,
        function: ['p99', 'value', 'distribution_metric', 'distribution', '-'],
      },
      {
        kind: FieldValueKind.FUNCTION,
        function: ['count', 'value', 'distribution_metric', 'distribution', '-'],
      },
    ];

    mockedUseWidgetBuilderContext.mockReturnValue({
      state: {
        dataset: WidgetType.TRACEMETRICS,
        displayType: DisplayType.LINE,
        yAxis,
      },
      dispatch: mockDispatch,
    });

    render(
      <MetricSelectRow
        field={{
          kind: 'function',
          function: ['sum', 'value', 'distribution_metric', 'distribution', '-'],
        }}
        index={0}
        disabled={false}
      />
    );

    const metricSelector = await screen.findByRole('button', {
      name: 'distribution_metric',
    });

    // Change to counter (p99 and count are not valid)
    await userEvent.click(metricSelector);
    await userEvent.click(await screen.findByRole('option', {name: 'counter_metric'}));

    // per_second stays, p99 replaced with sum, count replaced with sum
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: BuilderStateAction.SET_Y_AXIS,
        payload: [
          {
            kind: FieldValueKind.FUNCTION,
            function: [
              'per_second' as AggregationKeyWithAlias,
              'value',
              'counter_metric',
              'counter',
              '-',
            ],
          },
          {
            kind: FieldValueKind.FUNCTION,
            function: ['sum', 'value', 'counter_metric', 'counter', '-'],
          },
          {
            kind: FieldValueKind.FUNCTION,
            function: ['sum', 'value', 'counter_metric', 'counter', '-'],
          },
        ],
      });
    });
  });

  it('replaces invalid aggregates for big number display', async () => {
    const fields: Column[] = [
      {
        kind: FieldValueKind.FUNCTION,
        function: ['avg', 'value', 'gauge_metric', 'gauge', '-'],
      },
    ];

    mockedUseWidgetBuilderContext.mockReturnValue({
      state: {
        dataset: WidgetType.TRACEMETRICS,
        displayType: DisplayType.BIG_NUMBER,
        fields,
      },
      dispatch: mockDispatch,
    });

    render(
      <MetricSelectRow
        field={{
          kind: 'function',
          function: ['avg', 'value', 'gauge_metric', 'gauge', '-'],
        }}
        index={0}
        disabled={false}
      />
    );

    const metricSelector = await screen.findByRole('button', {name: 'gauge_metric'});

    // Change to counter which doesn't support avg
    await userEvent.click(metricSelector);
    await userEvent.click(await screen.findByRole('option', {name: 'counter_metric'}));

    // avg is invalid for counter, replaced with sum
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: BuilderStateAction.SET_FIELDS,
        payload: [
          {
            kind: FieldValueKind.FUNCTION,
            function: ['sum', 'value', 'counter_metric', 'counter', '-'],
          },
        ],
      });
    });
  });

  it('uses avg for gauge metrics', async () => {
    const yAxis: Column[] = [
      {
        kind: FieldValueKind.FUNCTION,
        function: ['p50', 'value', 'distribution_metric', 'distribution', '-'],
      },
    ];

    mockedUseWidgetBuilderContext.mockReturnValue({
      state: {
        dataset: WidgetType.TRACEMETRICS,
        displayType: DisplayType.LINE,
        yAxis,
      },
      dispatch: mockDispatch,
    });

    render(
      <MetricSelectRow
        field={{
          kind: 'function',
          function: ['p50', 'value', 'distribution_metric', 'distribution', '-'],
        }}
        index={0}
        disabled={false}
      />
    );

    const metricSelector = await screen.findByRole('button', {
      name: 'distribution_metric',
    });

    // Change to gauge which doesn't support p50
    await userEvent.click(metricSelector);
    await userEvent.click(await screen.findByRole('option', {name: 'gauge_metric'}));

    // p50 is invalid for gauge, replaced with avg
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith({
        type: BuilderStateAction.SET_Y_AXIS,
        payload: [
          {
            kind: FieldValueKind.FUNCTION,
            function: ['avg', 'value', 'gauge_metric', 'gauge', '-'],
          },
        ],
      });
    });
  });
});
