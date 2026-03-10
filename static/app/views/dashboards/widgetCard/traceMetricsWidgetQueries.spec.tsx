import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/components/pageFilters/store';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';

import TraceMetricsWidgetQueries from './traceMetricsWidgetQueries';

describe('traceMetricsWidgetQueries', () => {
  const selection = PageFiltersFixture();

  beforeEach(() => {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(selection);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('calculates confidence and sampling metadata from timeseries', async () => {
    const widget = WidgetFixture({
      widgetType: WidgetType.TRACEMETRICS,
      displayType: DisplayType.LINE,
      queries: [
        {
          name: '',
          aggregates: ['avg(value,duration,d,-)'],
          fields: ['avg(value,duration,d,-)'],
          columns: [],
          conditions: '',
          orderby: '',
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [
          {
            yAxis: 'avg(value,duration,d,-)',
            meta: {
              interval: 3600000,
              valueType: 'duration',
              valueUnit: 'millisecond',
              dataScanned: 'partial',
            },
            values: [
              {
                timestamp: 1,
                value: 10,
                confidence: 'low',
                sampleCount: 10,
                sampleRate: 0.5,
              },
              {
                timestamp: 2,
                value: 20,
                confidence: 'low',
                sampleCount: 20,
                sampleRate: 0.5,
              },
            ],
          },
        ],
      },
    });

    render(
      <TraceMetricsWidgetQueries widget={widget} dashboardFilters={{}}>
        {({confidence, sampleCount, isSampled, dataScanned}) => (
          <div>
            {confidence}:{sampleCount}:{String(isSampled)}:{dataScanned}
          </div>
        )}
      </TraceMetricsWidgetQueries>
    );

    expect(await screen.findByText('low:30:true:partial')).toBeInTheDocument();
  });
});
