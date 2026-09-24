import {DisplayType} from 'sentry/views/dashboards/types';
import {canScaleThresholds} from 'sentry/views/dashboards/widgetCard/canScaleThresholds';
import {SpanFields} from 'sentry/views/insights/types';

const query = {
  name: '',
  fields: ['count()'],
  aggregates: ['count()'],
  columns: [],
  conditions: '',
  orderby: '',
};

describe('canScaleThresholds', () => {
  it.each([
    'count()',
    `count(${SpanFields.SPAN_DURATION})`,
    'count(custom_field)',
    `count_if(${SpanFields.SPAN_STATUS},equals,error)`,
    'failure_count()',
    'sum(session)',
    `sum(${SpanFields.SPAN_DURATION})`,
    'sum(value,metricA,gauge,none)',
    'equation|count() / 2',
    `equation|p95(${SpanFields.SPAN_DURATION}) / 100`,
  ])('allows the aggregate %s', aggregate => {
    expect(
      canScaleThresholds({
        displayType: DisplayType.LINE,
        queries: [{...query, aggregates: [aggregate]}],
      })
    ).toBe(true);
  });

  it.each([
    ['duration', [`p95(${SpanFields.SPAN_DURATION})`]],
    ['rate', ['eps()']],
    ['average', [`avg(${SpanFields.SPAN_DURATION})`]],
    ['distinct count', ['count_unique(user)']],
    ['empty equation', ['equation|']],
    ['mixed aggregates', ['count()', `p95(${SpanFields.SPAN_DURATION})`]],
    ['no aggregates', []],
  ])('disallows %s', (_name, aggregates) => {
    expect(
      canScaleThresholds({
        displayType: DisplayType.LINE,
        queries: [{...query, aggregates}],
      })
    ).toBe(false);
  });

  it('disallows a mixed set of queries', () => {
    expect(
      canScaleThresholds({
        displayType: DisplayType.LINE,
        queries: [query, {...query, aggregates: ['eps()']}],
      })
    ).toBe(false);
  });

  it('allows a count with an equation stored only in fields', () => {
    expect(
      canScaleThresholds({
        displayType: DisplayType.LINE,
        queries: [{...query, fields: ['count()', 'equation|count() / 2']}],
      })
    ).toBe(true);
  });

  it('disallows table widgets and widgets without queries', () => {
    expect(canScaleThresholds({displayType: DisplayType.TABLE, queries: [query]})).toBe(
      false
    );
    expect(canScaleThresholds({displayType: DisplayType.LINE, queries: []})).toBe(false);
  });
});
