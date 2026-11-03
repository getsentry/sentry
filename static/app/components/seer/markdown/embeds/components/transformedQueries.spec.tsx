import {OrganizationFixture} from 'sentry-fixture/organization';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import * as charts from 'sentry/components/charts/baseChart';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import * as timeSeriesWidgets from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {decodeMetricsQueryParams} from 'sentry/views/explore/metrics/metricQuery';
import {parseVisualize} from 'sentry/views/explore/queryParams/visualize';

jest.mock('sentry/components/charts/baseChart', () => ({
  BaseChart: jest.fn(() => null),
}));

const baseChart = jest.spyOn(charts, 'BaseChart');
const liveChart = jest.spyOn(timeSeriesWidgets, 'TimeSeriesWidgetVisualization');

const cases = [
  {
    name: 'spansQuery',
    dataset: 'spans',
    axis: 'p95(span.duration)',
    resolvedAxis: 'p95(span.duration)',
    link: 'View Spans',
    extra: {},
  },
  {
    name: 'logsQuery',
    dataset: 'ourlogs',
    axis: 'count(message)',
    resolvedAxis: 'count(message)',
    link: 'View Logs',
    extra: {},
  },
  {
    name: 'metricsQuery',
    dataset: 'tracemetrics',
    axis: 'p95(value)',
    resolvedAxis: 'p95(value,request.duration,distribution,second)',
    link: 'View Metrics',
    extra: {name: 'request.duration', type: 'distribution', unit: 'second'},
  },
];

describe('transformed live query embeds', () => {
  beforeEach(() => {
    baseChart.mockClear();
    liveChart.mockClear();
  });

  it.each(cases)(
    'executes and hands off duplicate transformed axes for $name',
    async ({name, dataset, axis, resolvedAxis, link, extra}) => {
      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-timeseries/',
        body: {
          timeSeries: [
            {
              yAxis: resolvedAxis,
              meta: {interval: 300_000, valueType: 'duration', valueUnit: 'second'},
              values: [
                {timestamp: 1_700_000_000_000, value: 1},
                {timestamp: 1_700_000_300_000, value: null},
                {timestamp: 1_700_000_600_000, value: 3},
              ],
            },
            {
              yAxis: resolvedAxis,
              meta: {interval: 300_000, valueType: 'duration', valueUnit: 'second'},
              values: [
                {timestamp: 1_700_000_000_000, value: 1, smoothed: true},
                {timestamp: 1_700_000_300_000, value: 2, filled: true, smoothed: true},
                {timestamp: 1_700_000_600_000, value: 3, smoothed: true},
              ],
            },
          ],
        },
      });
      const data = {
        ...extra,
        mode: 'aggregate',
        query: 'release:1.0',
        yAxes: [axis, axis],
        transformations: [[], ['fill(locf)', 'smooth(sma,3)']],
        interval: '5m',
        statsPeriod: '24h',
      };

      render(
        <SeerMarkdown raw={`{% ${name} %}${JSON.stringify(data)}{% /${name} %}`} />,
        {
          organization: OrganizationFixture({
            features: ['explore-interpolation-and-smoothing'],
          }),
        }
      );

      await waitFor(() => {
        expect(request).toHaveBeenCalledWith(
          '/organizations/org-slug/events-timeseries/',
          expect.objectContaining({
            query: expect.objectContaining({
              dataset,
              yAxis: [resolvedAxis, resolvedAxis],
              'transformations[1]': ['fill(locf)', 'smooth(sma,3)'],
              interval: '5m',
              query: 'release:1.0',
            }),
          })
        );
      });
      expect(await screen.findByTestId('seer-chart-content')).toBeInTheDocument();
      const plotted = baseChart.mock.calls.at(-1)![0];
      expect(plotted.series).toEqual([
        expect.objectContaining({
          data: [
            [1_700_000_000_000, 1],
            [1_700_000_300_000, '-'],
            [1_700_000_600_000, 3],
          ],
        }),
        expect.objectContaining({
          data: [
            [1_700_000_000_000, 1],
            [1_700_000_300_000, 2],
            [1_700_000_600_000, 3],
          ],
        }),
      ]);
      expect(plotted.series?.[0]?.name).not.toBe(plotted.series?.[1]?.name);
      expect(liveChart.mock.calls.at(-1)![0].plottables).toMatchObject([
        {
          timeSeries: {
            requestedTransformations: [],
            meta: {interval: 300_000, valueUnit: 'second'},
          },
        },
        {
          timeSeries: {
            requestedTransformations: ['fill(locf)', 'smooth(sma,3)'],
            values: [
              {timestamp: 1_700_000_000_000, value: 1, smoothed: true},
              {timestamp: 1_700_000_300_000, value: 2, filled: true, smoothed: true},
              {timestamp: 1_700_000_600_000, value: 3, smoothed: true},
            ],
          },
        },
      ]);
      expect(liveChart.mock.calls.at(-1)![0].plottables[1]?.label).toContain(
        'smooth(sma,3)'
      );
      expect(liveChart.mock.calls.at(-1)![0].plottables[0]?.dataUnit).toBe('second');

      const href = screen.getByRole('link', {name: link}).getAttribute('href')!;
      const params = new URL(href, 'https://sentry.io').searchParams;
      const fields =
        dataset === 'tracemetrics'
          ? JSON.parse(params.get('metric')!).aggregateFields
          : params.getAll('aggregateField').map(value => JSON.parse(value));
      expect(fields).toEqual([
        {yAxes: [resolvedAxis]},
        {yAxes: [resolvedAxis], transformations: ['fill(locf)', 'smooth(sma,3)']},
      ]);
      expect(params.get('interval')).toBe('5m');
      const restored =
        dataset === 'tracemetrics'
          ? decodeMetricsQueryParams(params.get('metric')!)?.queryParams.aggregateFields
          : fields.flatMap((field: unknown) => parseVisualize(field));
      expect(restored).toMatchObject([
        {yAxis: resolvedAxis, transformations: []},
        {yAxis: resolvedAxis, transformations: ['fill(locf)', 'smooth(sma,3)']},
      ]);
    }
  );

  it('keeps pipelines aligned across grouped duplicate axes', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: ['http.client', 'http.client', 'db.query', 'db.query'].map(value =>
          TimeSeriesFixture({
            yAxis: 'count(span.duration)',
            groupBy: [{key: 'span.op', value}],
          })
        ),
      },
    });
    render(
      <SeerMarkdown
        raw={`{% spansQuery %}${JSON.stringify({
          mode: 'aggregate',
          groupBy: ['span.op'],
          yAxes: ['count(span.duration)', 'count(span.duration)'],
          transformations: [[], ['smooth(sma,3)']],
        })}{% /spansQuery %}`}
      />,
      {
        organization: OrganizationFixture({
          features: ['explore-interpolation-and-smoothing'],
        }),
      }
    );

    expect(await screen.findByTestId('seer-chart-content')).toBeInTheDocument();
    expect(liveChart.mock.calls.at(-1)![0].plottables).toMatchObject([
      {timeSeries: {requestedTransformations: [], groupBy: [{value: 'http.client'}]}},
      {
        timeSeries: {
          requestedTransformations: ['smooth(sma,3)'],
          groupBy: [{value: 'http.client'}],
        },
      },
      {timeSeries: {requestedTransformations: [], groupBy: [{value: 'db.query'}]}},
      {
        timeSeries: {
          requestedTransformations: ['smooth(sma,3)'],
          groupBy: [{value: 'db.query'}],
        },
      },
    ]);
  });

  it('shows an empty state for an all-null response', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [
          TimeSeriesFixture({values: [{timestamp: 1_700_000_000_000, value: null}]}),
        ],
      },
    });
    render(<SeerMarkdown raw='{% logsQuery %}{"mode":"aggregate"}{% /logsQuery %}' />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No matching logs');
  });

  it('identifies Other groups and their pipelines in the legend', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [
          TimeSeriesFixture({
            yAxis: 'count(span.duration)',
            groupBy: null,
            meta: {
              interval: 300_000,
              valueType: 'integer',
              valueUnit: null,
              isOther: true,
            },
          }),
          TimeSeriesFixture({
            yAxis: 'count(span.duration)',
            groupBy: null,
            meta: {
              interval: 300_000,
              valueType: 'integer',
              valueUnit: null,
              isOther: true,
            },
          }),
        ],
      },
    });
    render(
      <SeerMarkdown
        raw={`{% spansQuery %}${JSON.stringify({
          mode: 'aggregate',
          groupBy: ['span.op'],
          yAxes: ['count(span.duration)', 'count(span.duration)'],
          transformations: [[], ['smooth(sma,3)']],
        })}{% /spansQuery %}`}
      />,
      {
        organization: OrganizationFixture({
          features: ['explore-interpolation-and-smoothing'],
        }),
      }
    );

    expect(await screen.findByTestId('seer-chart-content')).toBeInTheDocument();
    expect(liveChart.mock.calls.at(-1)![0].plottables.map(item => item.label)).toEqual([
      'Other',
      'Other · smooth(sma,3)',
    ]);
  });

  it.each(cases)(
    'shows unavailable transformations instead of raw data for $name',
    async ({name, axis, extra}) => {
      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-timeseries/',
        body: {timeSeries: []},
      });
      const data = {
        ...extra,
        mode: 'aggregate',
        yAxes: [axis],
        transformations: [['smooth(sma,3)']],
      };
      render(<SeerMarkdown raw={`{% ${name} %}${JSON.stringify(data)}{% /${name} %}`} />);

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Chart transformations are not available for this organization'
      );
      expect(request).not.toHaveBeenCalled();
    }
  );
});
