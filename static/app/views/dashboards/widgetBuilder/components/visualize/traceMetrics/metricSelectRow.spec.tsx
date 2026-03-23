import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {
  AggregationKeyWithAlias,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {useNavigate} from 'sentry/utils/useNavigate';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {MetricSelectRow} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceMetrics/metricSelectRow';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {serializeFields} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {FieldValueKind} from 'sentry/views/discover/table/types';

jest.mock('sentry/utils/useNavigate');
const mockedUseNavigate = jest.mocked(useNavigate);

const DASHBOARD_WIDGET_BUILDER_PATHNAME =
  '/organizations/org-slug/dashboards/new/widget/new/';

describe('MetricSelectRow', () => {
  let mockNavigate!: jest.Mock;
  beforeEach(() => {
    mockNavigate = jest.fn();
    mockedUseNavigate.mockReturnValue(mockNavigate);

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
        ],
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the same metric for all rows', async () => {
    render(
      <WidgetBuilderProvider>
        <MetricSelectRow
          field={{
            kind: 'function',
            function: [
              'per_second' as AggregationKeyWithAlias,
              'value',
              undefined,
              undefined,
            ],
          }}
          index={0}
          disabled={false}
        />
        <MetricSelectRow
          field={{
            kind: 'function',
            function: ['sum' as AggregationKeyWithAlias, 'value', undefined, undefined],
          }}
          index={0}
          disabled={false}
        />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
            query: {
              yAxis: [
                'per_second(value,alpha_metric,counter,-)',
                'sum(value,alpha_metric,counter,-)',
              ],
              dataset: WidgetType.TRACEMETRICS,
              displayType: DisplayType.LINE,
            },
          },
        },
      }
    );

    // Both metric selectors show the same metric value (alphabetically first)
    const metricSelectors = await screen.findAllByRole('button', {name: 'alpha_metric'});
    expect(metricSelectors).toHaveLength(2);

    // Change the metric to 'beta_metric'
    await userEvent.click(metricSelectors[0]!);
    await userEvent.click(await screen.findByRole('option', {name: 'beta_metric'}));

    // Both metric selectors show the new metric value
    expect(new Set(metricSelectors.map(selector => selector.textContent))).toEqual(
      new Set(['beta_metric'])
    );
  });

  it('allows selection for multiple metrics', async () => {
    const aggregates: QueryFieldValue[] = [
      {
        kind: 'function',
        function: [
          'per_second' as AggregationKeyWithAlias,
          'value',
          'alpha_metric',
          'counter',
          '-',
        ],
      },
      {
        kind: 'function',
        function: [
          'sum' as AggregationKeyWithAlias,
          'value',
          'alpha_metric',
          'counter',
          '-',
        ],
      },
    ];
    render(
      <WidgetBuilderProvider>
        {aggregates.map((aggregate, index) => (
          <MetricSelectRow key={index} field={aggregate} index={index} disabled={false} />
        ))}
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
            query: {
              yAxis: [
                'per_second(value,alpha_metric,counter,-)',
                'sum(value,alpha_metric,counter,-)',
              ],
              dataset: WidgetType.TRACEMETRICS,
              displayType: DisplayType.LINE,
            },
          },
        },
        organization: {
          features: ['tracemetrics-multi-metric-selection-in-dashboards'],
        },
      }
    );

    // Both metric selectors show the same metric value (alphabetically first)
    const metricSelectors = await screen.findAllByRole('button', {name: 'alpha_metric'});
    expect(metricSelectors).toHaveLength(2);

    // Change the first metric to 'beta_metric'
    await userEvent.click(metricSelectors[0]!);
    await userEvent.click(await screen.findByRole('option', {name: 'beta_metric'}));

    // Both metrics should be selected
    expect(screen.getByRole('button', {name: 'beta_metric'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'alpha_metric'})).toBeInTheDocument();
  });

  it('replaces invalid aggregates when changing to an incompatible metric type', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            ['metric.name']: 'distribution_metric',
            ['metric.type']: 'distribution',
            ['count(metric.name)']: 1,
          },
          {
            ['metric.name']: 'counter_metric',
            ['metric.type']: 'counter',
            ['count(metric.name)']: 1,
          },
        ],
      },
    });

    render(
      <WidgetBuilderProvider>
        <MetricSelectRow
          field={{
            kind: 'function',
            function: [
              'p50' as AggregationKeyWithAlias,
              'value',
              'distribution_metric',
              'distribution',
              '-',
            ],
          }}
          index={0}
          disabled={false}
        />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
            query: {
              yAxis: ['p50(value,distribution_metric,distribution,-)'],
              dataset: WidgetType.TRACEMETRICS,
              displayType: DisplayType.LINE,
            },
          },
        },
      }
    );

    const metricSelector = await screen.findByRole('button', {
      name: 'distribution_metric',
    });

    // Change to counter_metric (p50 is not valid for counter)
    await userEvent.click(metricSelector);
    await userEvent.click(await screen.findByRole('option', {name: 'counter_metric'}));

    // p50 is invalid for counter, so it should be replaced with per_second
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: serializeFields([
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
            ]),
          }),
        }),
        expect.anything()
      );
    });
  });

  it('preserves valid aggregates when changing metric type', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
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
        ],
      },
    });

    render(
      <WidgetBuilderProvider>
        <MetricSelectRow
          field={{
            kind: 'function',
            function: [
              'sum' as AggregationKeyWithAlias,
              'value',
              'counter_metric',
              'counter',
              '-',
            ],
          }}
          index={0}
          disabled={false}
        />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
            query: {
              yAxis: ['sum(value,counter_metric,counter,-)'],
              dataset: WidgetType.TRACEMETRICS,
              displayType: DisplayType.LINE,
            },
          },
        },
      }
    );

    const metricSelector = await screen.findByRole('button', {name: 'counter_metric'});

    // Change to distribution_metric (sum is valid for both types)
    await userEvent.click(metricSelector);
    await userEvent.click(
      await screen.findByRole('option', {name: 'distribution_metric'})
    );

    // sum should remain since it's valid for distribution, but args updated
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: serializeFields([
              {
                kind: FieldValueKind.FUNCTION,
                function: [
                  'sum' as AggregationKeyWithAlias,
                  'value',
                  'distribution_metric',
                  'distribution',
                  '-',
                ],
              },
            ]),
          }),
        }),
        expect.anything()
      );
    });
  });

  it('handles mixed valid and invalid aggregates on metric change', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            ['metric.name']: 'distribution_metric',
            ['metric.type']: 'distribution',
            ['count(metric.name)']: 1,
          },
          {
            ['metric.name']: 'counter_metric',
            ['metric.type']: 'counter',
            ['count(metric.name)']: 1,
          },
        ],
      },
    });

    render(
      <WidgetBuilderProvider>
        <MetricSelectRow
          field={{
            kind: 'function',
            function: [
              'sum' as AggregationKeyWithAlias,
              'value',
              'distribution_metric',
              'distribution',
              '-',
            ],
          }}
          index={0}
          disabled={false}
        />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
            query: {
              yAxis: [
                'sum(value,distribution_metric,distribution,-)',
                'p99(value,distribution_metric,distribution,-)',
                'count(value,distribution_metric,distribution,-)',
              ],
              dataset: WidgetType.TRACEMETRICS,
              displayType: DisplayType.LINE,
            },
          },
        },
      }
    );

    const metricSelector = await screen.findByRole('button', {
      name: 'distribution_metric',
    });

    // Change to counter (sum and count valid, p99 is not)
    await userEvent.click(metricSelector);
    await userEvent.click(await screen.findByRole('option', {name: 'counter_metric'}));

    // sum stays, p99 replaced with per_second, count replaced with per_second
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            yAxis: serializeFields([
              {
                kind: FieldValueKind.FUNCTION,
                function: [
                  'sum' as AggregationKeyWithAlias,
                  'value',
                  'counter_metric',
                  'counter',
                  '-',
                ],
              },
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
                function: [
                  'per_second' as AggregationKeyWithAlias,
                  'value',
                  'counter_metric',
                  'counter',
                  '-',
                ],
              },
            ]),
          }),
        }),
        expect.anything()
      );
    });
  });

  it('replaces invalid aggregates for big number display', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            ['metric.name']: 'gauge_metric',
            ['metric.type']: 'gauge',
            ['count(metric.name)']: 1,
          },
          {
            ['metric.name']: 'counter_metric',
            ['metric.type']: 'counter',
            ['count(metric.name)']: 1,
          },
        ],
      },
    });

    render(
      <WidgetBuilderProvider>
        <MetricSelectRow
          field={{
            kind: 'function',
            function: [
              'avg' as AggregationKeyWithAlias,
              'value',
              'gauge_metric',
              'gauge',
              '-',
            ],
          }}
          index={0}
          disabled={false}
        />
      </WidgetBuilderProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: DASHBOARD_WIDGET_BUILDER_PATHNAME,
            query: {
              field: ['avg(value,gauge_metric,gauge,-)'],
              dataset: WidgetType.TRACEMETRICS,
              displayType: DisplayType.BIG_NUMBER,
            },
          },
        },
      }
    );

    const metricSelector = await screen.findByRole('button', {name: 'gauge_metric'});

    // Change to counter which doesn't support avg
    await userEvent.click(metricSelector);
    await userEvent.click(await screen.findByRole('option', {name: 'counter_metric'}));

    // avg is invalid for counter, replaced with per_second
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            field: serializeFields([
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
            ]),
          }),
        }),
        expect.anything()
      );
    });
  });
});
