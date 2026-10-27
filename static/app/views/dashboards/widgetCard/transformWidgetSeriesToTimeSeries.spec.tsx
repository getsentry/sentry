import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import type {Series} from 'sentry/types/echarts';

import {transformMultipleWidgetSeriesToTimeSeries} from './transformWidgetSeriesToTimeSeries';

function makeSeries(seriesName: string, data: number[] = [1, 2, 3]): Series {
  return {
    seriesName,
    data: data.map((value, i) => ({name: `2024-01-0${i + 1}`, value})),
  };
}

describe('transformMultipleWidgetSeriesToTimeSeries', () => {
  it('returns nothing when the query index does not exist', () => {
    const widget = WidgetFixture({queries: []});
    expect(
      transformMultipleWidgetSeriesToTimeSeries([makeSeries('count()')], widget, 0)
    ).toEqual([]);
  });

  it('attaches the widget query and parses the aggregate', () => {
    const query = WidgetQueryFixture({
      name: '',
      aggregates: ['count()'],
      columns: [],
      fields: ['count()'],
    });
    const widget = WidgetFixture({queries: [query]});

    const [result] = transformMultipleWidgetSeriesToTimeSeries(
      [makeSeries('count()')],
      widget,
      0
    );
    expect(result?.queryIndex).toBe(0);
    expect(result?.widgetQuery).toBe(query);
    expect(result?.seriesName).toBe('count()');
    expect(result?.timeSeries.yAxis).toBe('count()');
    expect(result?.timeSeries.groupBy).toBeNull();
  });

  it('prefixes the series name with the query conditions when there are multiple queries and no alias', () => {
    const widget = WidgetFixture({
      queries: [
        WidgetQueryFixture({
          name: '',
          conditions: 'browser:Chrome',
          aggregates: ['count()'],
          columns: ['environment'],
          fields: ['environment', 'count()'],
        }),
        WidgetQueryFixture({
          name: '',
          conditions: 'browser:Firefox',
          aggregates: ['count()'],
          columns: ['environment'],
          fields: ['environment', 'count()'],
        }),
      ],
    });

    const [result] = transformMultipleWidgetSeriesToTimeSeries(
      [makeSeries('prod : count()')],
      widget,
      1
    );
    expect(result?.seriesName).toBe('browser:Firefox > prod : count()');
    expect(result?.widgetQuery).toBe(widget.queries[1]);
    expect(result?.timeSeries.yAxis).toBe('count()');
    expect(result?.timeSeries.groupBy).toEqual([{key: 'environment', value: 'prod'}]);
  });

  it('strips a legend alias joined with > and picks the matching aggregate', () => {
    const httpQuery = WidgetQueryFixture({
      name: 'http',
      conditions: 'span.op:http.client',
      aggregates: ['count(span.duration)', 'avg(span.duration)'],
      columns: ['project_id'],
      fields: ['project_id', 'count(span.duration)', 'avg(span.duration)'],
    });
    const widget = WidgetFixture({
      queries: [WidgetQueryFixture({name: 'db'}), httpQuery],
    });

    const [count, avg] = transformMultipleWidgetSeriesToTimeSeries(
      [
        makeSeries('http > (no value) : count(span.duration)'),
        makeSeries('http > (no value) : avg(span.duration)'),
      ],
      widget,
      1
    );
    expect(count?.seriesName).toBe('http > (no value) : count(span.duration)');
    expect(count?.timeSeries.yAxis).toBe('count(span.duration)');
    expect(avg?.timeSeries.yAxis).toBe('avg(span.duration)');
    expect(avg?.timeSeries.groupBy).toEqual([{key: 'project_id', value: '(no value)'}]);
  });

  it('strips a legend alias joined with : when there is no group by', () => {
    const widget = WidgetFixture({
      queries: [
        WidgetQueryFixture({
          name: 'Chrome',
          conditions: 'browser:Chrome',
          aggregates: ['count()'],
          columns: [],
          fields: ['count()'],
        }),
      ],
    });

    const [result] = transformMultipleWidgetSeriesToTimeSeries(
      [makeSeries('Chrome : count()')],
      widget,
      0
    );
    expect(result?.seriesName).toBe('Chrome : count()');
    expect(result?.timeSeries.yAxis).toBe('count()');
    expect(result?.timeSeries.groupBy).toBeNull();
  });

  it('keeps a group by value that equals the alias', () => {
    const widget = WidgetFixture({
      queries: [
        WidgetQueryFixture({
          name: 'prod',
          aggregates: ['count()'],
          columns: ['environment'],
          fields: ['environment', 'count()'],
        }),
      ],
    });

    const [result] = transformMultipleWidgetSeriesToTimeSeries(
      [makeSeries('prod > prod : count()')],
      widget,
      0
    );
    expect(result?.timeSeries.groupBy).toEqual([{key: 'environment', value: 'prod'}]);
  });

  it('falls back to the first aggregate when none appears in the series name', () => {
    const widget = WidgetFixture({
      queries: [
        WidgetQueryFixture({
          name: '',
          aggregates: ['count()', 'avg(duration)'],
          columns: [],
          fields: ['count()', 'avg(duration)'],
        }),
      ],
    });

    const [result] = transformMultipleWidgetSeriesToTimeSeries(
      [makeSeries('(no results)')],
      widget,
      0
    );
    expect(result?.timeSeries.yAxis).toBe('count()');
  });
});
