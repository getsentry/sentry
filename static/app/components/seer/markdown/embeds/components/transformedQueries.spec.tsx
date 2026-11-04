import {OrganizationFixture} from 'sentry-fixture/organization';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import * as charts from 'sentry/components/charts/baseChart';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {seriesFromTimeSeries} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedChart';

import {getEmbedLinkHref} from './resourceEmbedTestUtils';

jest.mock('sentry/components/charts/baseChart', () => ({
  BaseChart: jest.fn(() => null),
}));

const baseChart = jest.spyOn(charts, 'BaseChart');

describe('query embed transformation plumbing', () => {
  it('uses readable pipeline labels for duplicate axes', () => {
    const series = TimeSeriesFixture({
      yAxis: 'count(span.duration)',
      groupBy: [{key: 'span.op', value: 'http.client'}],
    });
    expect(
      seriesFromTimeSeries([series, series], {
        yAxes: ['count(span.duration)', 'count(span.duration)'],
        transformations: [[], ['fill(locf)', 'smooth(sma,3)']],
      }).map(item => ('label' in item ? item.label : item.name))
    ).toEqual([
      'count(span.duration) : span.op : http.client',
      'count(span.duration) : span.op : http.client · fill(locf) · smooth(sma,3)',
    ]);
  });

  it.each([
    {name: 'spansQuery', axis: 'count(span.duration)', extra: {}},
    {name: 'logsQuery', axis: 'count(message)', extra: {}},
    {
      name: 'metricsQuery',
      axis: 'sum(value)',
      extra: {name: 'request.count', type: 'counter'},
    },
  ])(
    'warns without executing unsupported pipelines for $name',
    async ({name, axis, extra}) => {
      const timeseries = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-timeseries/',
        body: {timeSeries: []},
      });
      const legacy = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {data: []},
      });
      const data = {
        ...extra,
        mode: 'aggregate',
        yAxes: [axis],
        transformations: [['smooth(sma,3)']],
      };
      render(
        <SeerMarkdown raw={`{% ${name} %}${JSON.stringify(data)}{% /${name} %}`} />,
        {
          organization: OrganizationFixture({features: []}),
        }
      );
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Chart transformations are not available for this organization'
      );
      expect(timeseries).not.toHaveBeenCalled();
      expect(legacy).not.toHaveBeenCalled();
    }
  );

  it('keeps untransformed axes grouped in the existing Explore link', () => {
    const href = getEmbedLinkHref('spansQuery', 'Aggregated span search', {
      mode: 'aggregate',
      yAxes: ['count(span.duration)', 'avg(span.duration)'],
    });
    const params = new URL(href, 'https://sentry.io').searchParams;
    expect(params.getAll('aggregateField').map(value => JSON.parse(value))).toEqual([
      {yAxes: ['count(span.duration)', 'avg(span.duration)']},
    ]);
  });

  it.each([
    {
      name: 'spansQuery',
      label: 'Span search',
      axis: 'count(span.duration)',
      yAxes: undefined,
    },
    {name: 'spansQuery', label: 'Span search', axis: 'count(span.duration)', yAxes: []},
    {name: 'logsQuery', label: 'Log search', axis: 'count(message)', yAxes: undefined},
    {name: 'logsQuery', label: 'Log search', axis: 'count(message)', yAxes: []},
  ])(
    'retains the default-axis pipeline in $name with axes $yAxes',
    ({name, label, axis, yAxes}) => {
      const href = getEmbedLinkHref(name, label, {
        mode: 'samples',
        yAxes,
        transformations: [['smooth(sma,3)']],
      });
      const params = new URL(href, 'https://sentry.io').searchParams;
      expect(params.getAll('aggregateField').map(value => JSON.parse(value))).toEqual([
        {yAxes: [axis], transformations: ['smooth(sma,3)']},
      ]);
    }
  );

  it('keeps Other groups out of the existing transformed spans chart', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-timeseries/',
      body: {
        timeSeries: [false, true].map(isOther =>
          TimeSeriesFixture({
            yAxis: 'count(span.duration)',
            groupBy: isOther ? null : [{key: 'span.op', value: 'http.client'}],
            meta: {interval: 300_000, valueType: 'integer', valueUnit: null, isOther},
            values: [{timestamp: 1_700_000_000_000, value: isOther ? 12 : 4}],
          })
        ),
      },
    });
    render(
      <SeerMarkdown raw='{% spansQuery %}{"mode":"aggregate","groupBy":["span.op"],"transformations":[["smooth(sma,3)"]]}{% /spansQuery %}' />,
      {
        organization: OrganizationFixture({
          features: ['explore-interpolation-and-smoothing'],
        }),
      }
    );

    expect(await screen.findByTestId('seer-chart-content')).toBeInTheDocument();
    expect(baseChart.mock.calls.at(-1)![0].series).toEqual([
      expect.objectContaining({data: [[1_700_000_000_000, 4]]}),
    ]);
  });

  it.each([
    {name: 'spansQuery', dataset: 'spans', axis: 'count(span.duration)', extra: {}},
    {name: 'logsQuery', dataset: 'ourlogs', axis: 'count(message)', extra: {}},
    {
      name: 'metricsQuery',
      dataset: 'tracemetrics',
      axis: 'sum(value,request.count,counter,none)',
      extra: {
        name: 'request.count',
        type: 'counter',
        yAxes: ['sum(value)', 'sum(value)'],
      },
    },
  ])(
    'passes pipelines through $name execution and handoff',
    async ({name, dataset, axis, extra}) => {
      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-timeseries/',
        body: {
          timeSeries: [4, 6].map(value =>
            TimeSeriesFixture({
              yAxis: axis,
              meta: {interval: 300_000, valueType: 'integer', valueUnit: null},
              values: [{timestamp: 1_700_000_000_000, value}],
            })
          ),
        },
      });
      const legacy = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {data: []},
      });
      const data = {
        mode: 'aggregate',
        yAxes: [axis, axis],
        ...extra,
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
              yAxis: [axis, axis],
              'transformations[1]': ['fill(locf)', 'smooth(sma,3)'],
              interval: '5m',
            }),
          })
        );
      });
      expect(await screen.findByTestId('seer-chart-content')).toBeInTheDocument();
      expect(baseChart.mock.calls.at(-1)![0].series).toMatchObject([
        {data: [[1_700_000_000_000, 4]]},
        {data: [[1_700_000_000_000, 6]]},
      ]);
      expect(legacy).not.toHaveBeenCalled();

      const href = screen.getByRole('link').getAttribute('href')!;
      const params = new URL(href, 'https://sentry.io').searchParams;
      const fields =
        dataset === 'tracemetrics'
          ? JSON.parse(params.get('metric')!).aggregateFields
          : params.getAll('aggregateField').map(value => JSON.parse(value));
      expect(fields).toEqual([
        {yAxes: [axis]},
        {yAxes: [axis], transformations: ['fill(locf)', 'smooth(sma,3)']},
      ]);
      expect(params.get('interval')).toBe('5m');
    }
  );
});
