import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';
import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {SizeUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

import {
  combineIngestionMeta,
  transformTimeSeriesResponse,
} from './transformTimeSeriesResponse';

function makeTimeSeries(
  yAxis: string,
  {
    groupBy,
    order,
    isOther,
  }: Partial<TimeSeries['meta']> & Pick<TimeSeries, 'groupBy'> = {}
): TimeSeries {
  return TimeSeriesFixture({
    yAxis,
    groupBy,
    meta: {valueType: 'integer', valueUnit: null, interval: 60_000, order, isOther},
  });
}

const chrome = [{key: 'browser', value: 'Chrome'}];

describe('transformTimeSeriesResponse', () => {
  it('sorts by order and attaches the widget query', () => {
    const widget = WidgetFixture({queries: [WidgetQueryFixture({columns: ['browser']})]});
    const other = makeTimeSeries('count()', {groupBy: null, order: 1, isOther: true});
    const chromeSeries = makeTimeSeries('count()', {groupBy: chrome, order: 0});

    const result = transformTimeSeriesResponse(
      {timeSeries: [other, chromeSeries]},
      widget,
      0
    );

    expect(result.map(({timeSeries}) => timeSeries.groupBy)).toEqual([chrome, null]);
    expect(result.map(({timeSeries}) => timeSeries.meta.isOther)).toEqual([
      undefined,
      true,
    ]);
    expect(result.every(item => item.widgetQuery === widget.queries[0])).toBe(true);
    expect(result.every(item => item.queryIndex === 0)).toBe(true);
  });

  it('uses a custom series name', () => {
    const [result] = transformTimeSeriesResponse(
      {timeSeries: [makeTimeSeries('count()')]},
      WidgetFixture({queries: [WidgetQueryFixture({name: 'Alias'})]}),
      0,
      {
        getSeriesName: (timeSeries, widgetQuery) =>
          `${widgetQuery.name}-${timeSeries.yAxis}`,
      }
    );

    expect(result!.seriesName).toBe('Alias-count()');
  });

  it('returns nothing for a missing query', () => {
    expect(
      transformTimeSeriesResponse(
        {timeSeries: [makeTimeSeries('count()')]},
        WidgetFixture(),
        5
      )
    ).toEqual([]);
  });

  it('overrides the value type and unit', () => {
    const [result] = transformTimeSeriesResponse(
      {timeSeries: [TimeSeriesFixture()]},
      WidgetFixture(),
      0,
      {meta: {valueType: 'size', valueUnit: SizeUnit.BYTE}}
    );

    expect(result!.timeSeries.meta).toEqual(
      expect.objectContaining({valueType: 'size', valueUnit: SizeUnit.BYTE})
    );
  });

  describe('seriesName', () => {
    it.each([
      {
        name: 'single y-axis',
        queries: [WidgetQueryFixture({name: '', columns: []})],
        timeSeries: [makeTimeSeries('count()')],
        expected: ['count()'],
      },
      {
        name: 'multiple y-axes with an alias',
        queries: [WidgetQueryFixture({name: 'Alias', columns: []})],
        timeSeries: [makeTimeSeries('count()'), makeTimeSeries('p50(span.duration)')],
        expected: ['Alias : count()', 'Alias : p50(span.duration)'],
      },
      {
        name: 'groups with a single y-axis',
        queries: [WidgetQueryFixture({name: '', columns: ['browser']})],
        timeSeries: [
          makeTimeSeries('count()', {isOther: true, order: 2}),
          makeTimeSeries('count()', {
            groupBy: [
              {key: 'error.type', value: ['TypeError', null]},
              {key: 'os', value: null},
            ],
            order: 1,
          }),
          makeTimeSeries('count()', {groupBy: chrome, order: 0}),
        ],
        expected: ['Chrome', '[TypeError,(no value)],None', 'Other'],
      },
      {
        name: 'a group by value that collides with the Other bucket',
        queries: [WidgetQueryFixture({name: '', columns: ['browser']})],
        timeSeries: [
          makeTimeSeries('count()', {
            groupBy: [{key: 'browser', value: 'Other'}],
            order: 0,
          }),
          makeTimeSeries('count()', {isOther: true, order: 1}),
        ],
        expected: ['Other (browser)', 'Other'],
      },
      {
        name: 'groups with multiple y-axes and an alias',
        queries: [WidgetQueryFixture({name: 'Alias', columns: ['browser']})],
        timeSeries: [
          makeTimeSeries('count()', {groupBy: chrome}),
          makeTimeSeries('p50(span.duration)', {groupBy: chrome}),
        ],
        expected: ['Alias > Chrome : count()', 'Alias > Chrome : p50(span.duration)'],
      },
      {
        name: 'a grouped query with no groups and a single y-axis',
        queries: [WidgetQueryFixture({name: 'Alias', columns: ['browser']})],
        timeSeries: [makeTimeSeries('count()', {groupBy: null})],
        expected: ['Alias : count()'],
      },
      {
        name: 'a grouped query with no groups and multiple y-axes',
        queries: [WidgetQueryFixture({name: 'Alias', columns: ['browser']})],
        timeSeries: [
          makeTimeSeries('count()', {groupBy: null}),
          makeTimeSeries('p50(span.duration)', {groupBy: null}),
        ],
        expected: ['Alias >  : count()', 'Alias >  : p50(span.duration)'],
      },
      {
        name: 'multiple queries without aliases',
        queries: [
          WidgetQueryFixture({name: '', columns: [], conditions: 'browser:Chrome'}),
          WidgetQueryFixture({name: '', columns: [], conditions: 'browser:Firefox'}),
        ],
        timeSeries: [makeTimeSeries('count()')],
        expected: ['browser:Chrome > count()'],
      },
    ])(
      'matches events-stats series names for $name',
      ({queries, timeSeries, expected}) => {
        const result = transformTimeSeriesResponse(
          {timeSeries},
          WidgetFixture({queries}),
          0
        );

        expect(result.map(({seriesName}) => seriesName)).toEqual(expected);
      }
    );
  });
});

describe('combineIngestionMeta', () => {
  const meta = {dataset: DiscoverDatasets.SPANS, start: 0, end: 0};

  it('keeps the meta with the earliest completeThrough', () => {
    const slow = {status: 'healthy' as const, completeThrough: 1000};
    const fast = {status: 'healthy' as const, completeThrough: 2000};

    expect(
      combineIngestionMeta([
        {timeSeries: [], meta: {...meta, ingestion: fast}},
        undefined,
        {timeSeries: [], meta: {...meta, ingestion: slow}},
      ])
    ).toBe(slow);
  });

  it('returns undefined when no response measured ingestion', () => {
    expect(combineIngestionMeta([{timeSeries: []}, undefined])).toBeUndefined();
  });
});
