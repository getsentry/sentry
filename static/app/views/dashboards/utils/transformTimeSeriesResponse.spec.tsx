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
    it('keys a series by its y-axis and group by values', () => {
      const result = transformTimeSeriesResponse(
        {
          timeSeries: [
            makeTimeSeries('count()', {groupBy: chrome, order: 0}),
            makeTimeSeries('count()', {
              groupBy: [{key: 'browser', value: 'Firefox'}],
              order: 1,
            }),
            makeTimeSeries('p50(span.duration)', {groupBy: chrome, order: 2}),
            makeTimeSeries('count()', {groupBy: null, isOther: true, order: 3}),
          ],
        },
        WidgetFixture({queries: [WidgetQueryFixture({columns: ['browser']})]}),
        0
      );

      expect(result.map(({seriesName}) => seriesName)).toEqual([
        'count() : browser : Chrome',
        'count() : browser : Firefox',
        'p50(span.duration) : browser : Chrome',
        'count()',
      ]);
    });

    it('prefixes the query index when the widget has multiple queries', () => {
      const widget = WidgetFixture({
        queries: [
          WidgetQueryFixture({conditions: 'browser:Chrome'}),
          WidgetQueryFixture({conditions: 'browser:Firefox'}),
        ],
      });
      const timeSeries = [makeTimeSeries('count()')];

      expect(
        transformTimeSeriesResponse({timeSeries}, widget, 0).map(
          ({seriesName}) => seriesName
        )
      ).toEqual(['0 : count()']);
      expect(
        transformTimeSeriesResponse({timeSeries}, widget, 1).map(
          ({seriesName}) => seriesName
        )
      ).toEqual(['1 : count()']);
    });

    it('prefixes custom series names too', () => {
      const widget = WidgetFixture({
        queries: [WidgetQueryFixture(), WidgetQueryFixture()],
      });

      const [result] = transformTimeSeriesResponse(
        {timeSeries: [makeTimeSeries('count()')]},
        widget,
        1,
        {getSeriesName: () => 'custom'}
      );

      expect(result!.seriesName).toBe('1 : custom');
    });
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
