import {ChartType} from 'sentry/views/insights/common/components/chart';

import {getAggregateFields, serializeAggregateFields} from './aggregateField';
import {VisualizeEquation, VisualizeFunction} from './visualize';

describe('getAggregateFields', () => {
  it('returns null when there are no aggregate fields', () => {
    expect(getAggregateFields([])).toBeNull();
  });

  it('round trips group bys and visualizes when every entry is valid', () => {
    const raw = [
      {groupBy: 'span.op'},
      {yAxes: ['count(span.duration)'], chartType: ChartType.BAR},
      {groupBy: ''},
      {
        yAxes: ['equation|count(span.duration) * 2'],
        visible: false,
        transformations: ['fill(locf)'],
        internalExpression: 'equation|count(span.duration) * 2',
      },
    ].map(value => JSON.stringify(value));

    const aggregateFields = getAggregateFields(raw);

    expect(aggregateFields).toEqual([
      {groupBy: 'span.op'},
      new VisualizeFunction('count(span.duration)', {chartType: ChartType.BAR}),
      {groupBy: ''},
      new VisualizeEquation('equation|count(span.duration) * 2', {
        internalExpression: 'equation|count(span.duration) * 2',
        transformations: ['fill(locf)'],
        visible: false,
      }),
    ]);
    expect(
      serializeAggregateFields(aggregateFields!).map(v => JSON.stringify(v))
    ).toEqual(raw);
  });

  it('skips only the malformed entries when some entries are malformed', () => {
    const aggregateFields = getAggregateFields([
      '{',
      '',
      'null',
      '[]',
      '"span.op"',
      JSON.stringify({}),
      JSON.stringify({groupBy: 1}),
      JSON.stringify({yAxes: [1]}),
      JSON.stringify({groupBy: 'span.op'}),
      JSON.stringify({yAxes: ['count(span.duration)']}),
    ]);

    expect(aggregateFields).toEqual([
      {groupBy: 'span.op'},
      new VisualizeFunction('count(span.duration)'),
    ]);
  });

  it('returns an empty list when every entry is malformed', () => {
    expect(getAggregateFields(['{', JSON.stringify({groupBy: null})])).toEqual([]);
  });

  it('keeps unknown keys when a group by has them', () => {
    const aggregateFields = getAggregateFields([
      JSON.stringify({groupBy: 'span.op', alias: 'Operation'}),
    ]);

    expect(aggregateFields).toEqual([{groupBy: 'span.op', alias: 'Operation'}]);
  });

  it('reads an entry as a group by when it also has y axes', () => {
    const aggregateFields = getAggregateFields([
      JSON.stringify({groupBy: 'span.op', yAxes: ['count(span.duration)']}),
    ]);

    expect(aggregateFields).toEqual([
      {groupBy: 'span.op', yAxes: ['count(span.duration)']},
    ]);
  });

  it('reads an entry as a visualize when its group by is not a string', () => {
    const aggregateFields = getAggregateFields([
      JSON.stringify({groupBy: 1, yAxes: ['count(span.duration)']}),
    ]);

    expect(aggregateFields).toEqual([new VisualizeFunction('count(span.duration)')]);
  });

  it('uses the default chart type when the chart type is malformed', () => {
    const aggregateFields = getAggregateFields([
      JSON.stringify({yAxes: ['avg(span.duration)'], chartType: 'LINE'}),
    ]);

    expect(aggregateFields).toEqual([new VisualizeFunction('avg(span.duration)')]);
  });

  it('groups y axes onto one chart when groupYAxes allows it', () => {
    const aggregateFields = getAggregateFields(
      [JSON.stringify({yAxes: ['p50(span.duration)', 'p75(span.duration)']})],
      {groupYAxes: () => true}
    );

    expect(aggregateFields).toEqual([
      new VisualizeFunction('p50(span.duration)', {chartGroup: expect.any(String)}),
      new VisualizeFunction('p75(span.duration)', {chartGroup: expect.any(String)}),
    ]);
    expect(serializeAggregateFields(aggregateFields!)).toEqual([
      {yAxes: ['p50(span.duration)', 'p75(span.duration)']},
    ]);
  });
});
