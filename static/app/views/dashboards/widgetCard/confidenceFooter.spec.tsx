import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {Series, SeriesDataUnit} from 'sentry/types/echarts';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import type {RawCounts} from 'sentry/views/explore/useRawCounts';

import {WidgetCardConfidenceFooter} from './confidenceFooter';
import type {GenericWidgetQueriesResult} from './genericWidgetQueries';

describe('WidgetCardConfidenceFooter', () => {
  const rawCounts: RawCounts = {
    normal: {count: 120, isLoading: false},
    highAccuracy: {count: 500, isLoading: false},
  };

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

  it('does not render when confidence warning is disabled', () => {
    render(
      <WidgetCardConfidenceFooter
        loading={false}
        other="Other"
        rawCounts={null}
        series={series}
        showConfidenceWarning={false}
        timeseriesResults={timeseriesResults}
        widget={WidgetFixture({
          displayType: DisplayType.LINE,
          widgetType: WidgetType.SPANS,
          queries: [WidgetQueryFixture()],
        })}
        yAxis="count()"
      />
    );

    expect(
      screen.queryByText(/Estimated for top 2 groups from/i)
    ).not.toBeInTheDocument();
  });

  it('renders spans footer with user query and top event metadata', () => {
    render(
      <WidgetCardConfidenceFooter
        loading={false}
        rawCounts={null}
        series={series}
        showConfidenceWarning
        shouldColorOther={false}
        other="Other"
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

    const footer = screen.getByText(/Estimated for top 2 groups from/i);
    expect(footer).toHaveTextContent('18 spans');
  });

  it('does not render logs footer when raw counts are missing', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      widgetType: WidgetType.LOGS,
      queries: [WidgetQueryFixture()],
    });

    render(
      <WidgetCardConfidenceFooter
        loading={false}
        rawCounts={null}
        other="Other"
        series={series}
        showConfidenceWarning
        timeseriesResults={timeseriesResults}
        widget={widget}
        yAxis="count()"
      />
    );

    expect(screen.queryByText(/Estimated from/i)).not.toBeInTheDocument();
  });

  it('renders logs footer when raw counts are present', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      widgetType: WidgetType.LOGS,
      queries: [WidgetQueryFixture()],
    });

    render(
      <WidgetCardConfidenceFooter
        loading={false}
        other="Other"
        rawCounts={rawCounts}
        series={series}
        showConfidenceWarning
        timeseriesResults={timeseriesResults}
        widget={widget}
        yAxis="count()"
      />
    );

    const footer = screen.getByText(/Estimated from/i);
    expect(footer).toHaveTextContent('10 matches');
    expect(footer).toHaveTextContent('500 logs');
  });

  it('does not render metrics footer when raw counts are missing', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      widgetType: WidgetType.TRACEMETRICS,
      queries: [WidgetQueryFixture()],
    });

    render(
      <WidgetCardConfidenceFooter
        loading={false}
        rawCounts={null}
        other="Other"
        series={series}
        showConfidenceWarning
        timeseriesResults={timeseriesResults}
        widget={widget}
        yAxis="count()"
      />
    );

    expect(screen.queryByText(/Estimated from/i)).not.toBeInTheDocument();
  });

  it('renders metrics footer when raw counts are present', () => {
    const widget = WidgetFixture({
      displayType: DisplayType.LINE,
      widgetType: WidgetType.TRACEMETRICS,
      queries: [WidgetQueryFixture()],
    });

    render(
      <WidgetCardConfidenceFooter
        loading={false}
        rawCounts={rawCounts}
        other="Other"
        series={series}
        showConfidenceWarning
        timeseriesResults={timeseriesResults}
        widget={widget}
        yAxis="count()"
      />
    );

    const footer = screen.getByText(/Estimated from/i);
    expect(footer).toHaveTextContent('10 matches');
    expect(footer).toHaveTextContent('500 data points');
  });
});
