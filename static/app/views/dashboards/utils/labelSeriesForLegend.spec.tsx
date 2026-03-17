import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {NAMESPACE_SYMBOL} from 'sentry/actionCreators/savedSearches';

import {labelSeriesForLegend, prettifyQueryConditions} from './labelSeriesForLegend';

describe('labelSeriesForLegend', () => {
  it('does nothing for single-query widgets', () => {
    const widget = WidgetFixture({
      queries: [WidgetQueryFixture({name: '', conditions: 'browser:Chrome'})],
    });
    const series = [{seriesName: 'count()', data: []}];

    expect(labelSeriesForLegend(series, widget.queries[0]!, widget)).toEqual(series);
  });

  it('does nothing when the query has an alias', () => {
    const widget = WidgetFixture({
      queries: [
        WidgetQueryFixture({name: 'Chrome', conditions: 'browser:Chrome'}),
        WidgetQueryFixture({name: 'Firefox', conditions: 'browser:Firefox'}),
      ],
    });
    const series = [{seriesName: 'Chrome : count()', data: []}];

    expect(labelSeriesForLegend(series, widget.queries[0]!, widget)).toEqual(series);
  });

  it('prefixes series names with conditions for multi-query without aliases', () => {
    const widget = WidgetFixture({
      queries: [
        WidgetQueryFixture({name: '', conditions: 'browser:Chrome'}),
        WidgetQueryFixture({name: '', conditions: 'browser:Firefox'}),
      ],
    });
    const series = [{seriesName: 'count()', data: []}];

    const result = labelSeriesForLegend(series, widget.queries[0]!, widget);
    expect(result[0]!.seriesName).toBe('browser:Chrome : count()');

    const result2 = labelSeriesForLegend(series, widget.queries[1]!, widget);
    expect(result2[0]!.seriesName).toBe('browser:Firefox : count()');
  });

  it('does nothing when conditions are empty', () => {
    const widget = WidgetFixture({
      queries: [
        WidgetQueryFixture({name: '', conditions: ''}),
        WidgetQueryFixture({name: '', conditions: ''}),
      ],
    });
    const series = [{seriesName: 'count()', data: []}];

    expect(labelSeriesForLegend(series, widget.queries[0]!, widget)).toEqual(series);
  });
});

describe('prettifyQueryConditions', () => {
  it('returns undefined for empty conditions', () => {
    expect(prettifyQueryConditions('')).toBeUndefined();
    expect(prettifyQueryConditions(undefined)).toBeUndefined();
  });

  it('strips wildcard operator markers', () => {
    const contains = `${NAMESPACE_SYMBOL}Contains${NAMESPACE_SYMBOL}`;
    expect(prettifyQueryConditions(`transaction:${contains}issues`)).toBe(
      'transaction:issues'
    );
  });

  it('strips wildcard * characters', () => {
    expect(prettifyQueryConditions('transaction:*issues*')).toBe('transaction:issues');
  });

  it('passes through plain conditions unchanged', () => {
    expect(prettifyQueryConditions('browser:Chrome')).toBe('browser:Chrome');
  });
});
