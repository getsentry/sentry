import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/components/pageFilters/store';
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

    const footer = await screen.findByText(/Estimated for top 2 groups from/i);
    expect(footer).toHaveTextContent('18 matches');
    expect(footer).toHaveTextContent('500 spans');
  });

  it('renders metrics footer with raw counts from API', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'count(value,duration,d,-)': 120}]},
      match: [MockApiClient.matchQuery({sampling: 'NORMAL', dataset: 'tracemetrics'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: [{'count(value,duration,d,-)': 500}]},
      match: [
        MockApiClient.matchQuery({
          sampling: 'HIGHEST_ACCURACY',
          dataset: 'tracemetrics',
        }),
      ],
    });

    render(
      <WidgetCardConfidenceFooter
        loading={false}
        other="Other"
        series={series}
        showConfidenceWarning
        timeseriesResults={timeseriesResults}
        widget={WidgetFixture({
          displayType: DisplayType.LINE,
          widgetType: WidgetType.TRACEMETRICS,
          queries: [
            WidgetQueryFixture({
              aggregates: ['avg(value,duration,d,-)'],
              fields: ['avg(value,duration,d,-)'],
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

  it('does not render footer for unsupported widget types', () => {
    render(
      <WidgetCardConfidenceFooter
        loading={false}
        other="Other"
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
