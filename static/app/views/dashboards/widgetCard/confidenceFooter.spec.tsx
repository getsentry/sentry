import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import type {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';

import {WidgetCardConfidenceFooter} from './confidenceFooter';
import type {GenericWidgetQueriesResult} from './genericWidgetQueries';

describe('WidgetCardConfidenceFooter', () => {
  const selection = PageFiltersFixture();

  const series: Array<Series & {fieldName?: string}> = [
    {
      seriesName: 'series-a',
      data: [
        {
          name: 1710000000000,
          value: 10,
          sampleCount: 10,
          sampleRate: 0.5,
          confidence: 'low',
        } as SeriesDataUnit,
      ],
    },
    {
      seriesName: 'series-b',
      data: [
        {
          name: 1710000060000,
          value: 15,
          sampleCount: 8,
          sampleRate: 0.5,
          confidence: 'high',
        } as SeriesDataUnit,
      ],
    },
  ];

  const timeseriesResults = [
    {seriesName: 'series-a'},
    {seriesName: 'series-b'},
  ] as unknown as GenericWidgetQueriesResult['timeseriesResults'];
  const seriesWithOther: Array<Series & {fieldName?: string}> = [
    ...series,
    {
      seriesName: 'Other',
      data: [
        {
          name: 1710000120000,
          value: 5,
          sampleCount: 4,
          sampleRate: 0.5,
          confidence: 'high',
        } as SeriesDataUnit,
      ],
    },
  ];
  const timeseriesResultsWithOther = [
    {seriesName: 'series-a'},
    {seriesName: 'series-b'},
    {seriesName: 'Other'},
  ] as unknown as GenericWidgetQueriesResult['timeseriesResults'];
  const singleTimeseriesResults = [
    {seriesName: 'series-a'},
  ] as unknown as GenericWidgetQueriesResult['timeseriesResults'];

  beforeEach(() => {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(selection);
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders spans footer with user query and top event metadata', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'count(span.duration)': 120}]},
      match: [MockApiClient.matchQuery({sampling: 'NORMAL', dataset: 'spans'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'count(span.duration)': 500}]},
      match: [MockApiClient.matchQuery({sampling: 'HIGHEST_ACCURACY', dataset: 'spans'})],
    });

    render(
      <WidgetCardConfidenceFooter
        loading={false}
        series={series}
        timeseriesResults={timeseriesResults}
        widget={WidgetFixture({
          displayType: DisplayType.LINE,
          widgetType: WidgetType.SPANS,
          queries: [
            WidgetQueryFixture({
              conditions: 'transaction:checkout',
              columns: ['transaction'],
              aggregates: ['count()'],
            }),
          ],
        })}
        yAxis="count()"
      />
    );

    const footer = await screen.findByText(/Estimated for top 2 groups from/i);
    expect(footer).toHaveTextContent('18 matches');
    expect(footer).toHaveTextContent('500 spans');
  });

  it('excludes Other from spans top event metadata', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'count(span.duration)': 120}]},
      match: [MockApiClient.matchQuery({sampling: 'NORMAL', dataset: 'spans'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'count(span.duration)': 500}]},
      match: [MockApiClient.matchQuery({sampling: 'HIGHEST_ACCURACY', dataset: 'spans'})],
    });

    render(
      <WidgetCardConfidenceFooter
        loading={false}
        series={seriesWithOther}
        timeseriesResults={timeseriesResultsWithOther}
        widget={WidgetFixture({
          displayType: DisplayType.LINE,
          widgetType: WidgetType.SPANS,
          queries: [
            WidgetQueryFixture({
              conditions: 'transaction:checkout',
              columns: ['transaction'],
              aggregates: ['count()'],
            }),
          ],
        })}
        yAxis="count()"
      />
    );

    const footer = await screen.findByText(/Estimated for top 2 groups from/i);
    expect(footer).toHaveTextContent('18 matches');
    expect(footer).not.toHaveTextContent('top 3 groups');
  });

  it('renders metrics footer with raw counts from API', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'count(value)': 120}]},
      match: [MockApiClient.matchQuery({sampling: 'NORMAL', dataset: 'tracemetrics'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'count(value)': 500}]},
      match: [
        MockApiClient.matchQuery({
          sampling: 'NORMAL',
          dataset: 'tracemetrics',
          referrer: 'api.explore.tracemetrics.raw-count.normal-extrapolated-total',
        }),
      ],
    });

    render(
      <WidgetCardConfidenceFooter
        loading={false}
        series={[series[0]!]}
        timeseriesResults={singleTimeseriesResults}
        widget={WidgetFixture({
          displayType: DisplayType.LINE,
          widgetType: WidgetType.TRACEMETRICS,
          queries: [
            WidgetQueryFixture({
              conditions: 'transaction:checkout',
              aggregates: ['avg(value,metric_name,distribution,millisecond)'],
              fields: ['avg(value,metric_name,distribution,millisecond)'],
              columns: [],
            }),
          ],
        })}
        yAxis="count()"
      />
    );

    const footer = await screen.findByText(/Estimated from/i);
    expect(footer).toHaveTextContent('10 matches');
    expect(footer).toHaveTextContent('500 data points');
  });

  it('renders logs footer with raw counts from API', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'count(message)': 120}]},
      match: [MockApiClient.matchQuery({sampling: 'NORMAL', dataset: 'ourlogs'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'count(message)': 500}]},
      match: [
        MockApiClient.matchQuery({sampling: 'HIGHEST_ACCURACY', dataset: 'ourlogs'}),
      ],
    });

    render(
      <WidgetCardConfidenceFooter
        loading={false}
        series={[series[0]!]}
        timeseriesResults={singleTimeseriesResults}
        widget={WidgetFixture({
          displayType: DisplayType.LINE,
          widgetType: WidgetType.LOGS,
          queries: [
            WidgetQueryFixture({
              conditions: 'level:error',
              aggregates: ['count(message)'],
              fields: ['count(message)'],
              columns: [],
            }),
          ],
        })}
        yAxis="count(message)"
      />
    );

    const footer = await screen.findByText(/Estimated from/i);
    expect(footer).toHaveTextContent('10 matches');
    expect(footer).toHaveTextContent('500 logs');
  });

  it('does not render footer for unsupported widget types', () => {
    render(
      <WidgetCardConfidenceFooter
        loading={false}
        series={series}
        timeseriesResults={timeseriesResults}
        widget={WidgetFixture({
          displayType: DisplayType.LINE,
          widgetType: WidgetType.ERRORS,
          queries: [WidgetQueryFixture()],
        })}
        yAxis="count()"
      />
    );

    expect(screen.queryByText(/Estimated from/i)).not.toBeInTheDocument();
  });
});
