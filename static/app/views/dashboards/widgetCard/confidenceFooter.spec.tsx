import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {WidgetTimeSeries} from 'sentry/views/dashboards/utils/transformTimeSeriesResponse';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

import {WidgetCardConfidenceFooter} from './confidenceFooter';

describe('WidgetCardConfidenceFooter', () => {
  const selection = PageFiltersFixture();

  const meta = {interval: 60_000, valueType: 'number', valueUnit: null} as const;
  const series: TimeSeries[] = [
    {
      yAxis: 'series-a',
      values: [
        {
          timestamp: 1710000000000,
          value: 10,
          sampleCount: 10,
          sampleRate: 0.5,
          confidence: 'low',
        },
      ],
      meta,
    },
    {
      yAxis: 'series-b',
      values: [
        {
          timestamp: 1710000060000,
          value: 15,
          sampleCount: 8,
          sampleRate: 0.5,
          confidence: 'high',
        },
      ],
      meta,
    },
  ];
  const otherSeries: TimeSeries = {
    yAxis: 'series-a',
    values: [
      {
        timestamp: 1710000120000,
        value: 5,
        sampleCount: 4,
        sampleRate: 0.5,
        confidence: 'high',
      },
    ],
    meta: {...meta, isOther: true},
  };
  const seriesWithOther: TimeSeries[] = [...series, otherSeries];

  const toResults = (items: TimeSeries[]) =>
    items.map((timeSeries, queryIndex) => ({
      queryIndex,
      widgetQuery: WidgetQueryFixture(),
      seriesName: timeSeries.yAxis,
      timeSeries,
    })) satisfies WidgetTimeSeries[];
  const timeseriesResults = toResults(series);
  const timeseriesResultsWithOther = toResults(seriesWithOther);
  const singleTimeseriesResults = toResults(series.slice(0, 1));

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
    await waitFor(() => expect(footer).toHaveTextContent('500 spans'));
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
    await waitFor(() => expect(footer).toHaveTextContent('500 data points'));
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
    await waitFor(() => expect(footer).toHaveTextContent('500 logs'));
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
