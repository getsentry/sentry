import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {AggregationKeyWithAlias} from 'sentry/utils/discover/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {MetricSelectRow} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceMetrics/metricSelectRow';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

const DASHBOARD_WIDGET_BUILDER_PATHNAME =
  '/organizations/org-slug/dashboards/new/widget/new/';

describe('MetricSelectRow', () => {
  beforeEach(() => {
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
});
