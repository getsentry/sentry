import {explodeFieldString, generateFieldAsString} from 'sentry/utils/discover/fields';

import {
  applyTraceMetricAggregateFilter,
  buildTraceMetricAggregate,
  extractTraceMetricFromColumn,
  getTraceMetricFunctionParts,
} from './buildTraceMetricAggregate';

const METRIC = {name: 'foo', type: 'counter', unit: 'none'};

describe('buildTraceMetricAggregate', () => {
  it('builds a plain aggregate', () => {
    const column = buildTraceMetricAggregate('sum', METRIC);
    expect(generateFieldAsString(column)).toBe('sum(value,foo,counter,none)');
    expect(getTraceMetricFunctionParts(column)).toEqual({
      aggregation: 'sum',
      args: ['value', 'foo', 'counter', 'none'],
      filter: '',
    });
  });

  it('builds a conditional aggregate when given a filter', () => {
    const column = buildTraceMetricAggregate('sum', METRIC, 'status:500');
    expect(generateFieldAsString(column)).toBe(
      'sum_if(`status:500`,value,foo,counter,none)'
    );
    expect(getTraceMetricFunctionParts(column)).toEqual({
      aggregation: 'sum',
      args: ['value', 'foo', 'counter', 'none'],
      filter: 'status:500',
    });
  });

  it('extracts the metric from a conditional aggregate', () => {
    const column = explodeFieldString('sum_if(`status:500`,value,foo,counter,none)');
    expect(extractTraceMetricFromColumn(column)).toEqual(METRIC);
  });

  it('sets and clears the filter on an existing aggregate', () => {
    const column = explodeFieldString('sum(value,foo,counter,none)');
    const filtered = applyTraceMetricAggregateFilter(column, 'status:500');
    expect(generateFieldAsString(filtered)).toBe(
      'sum_if(`status:500`,value,foo,counter,none)'
    );
    expect(generateFieldAsString(applyTraceMetricAggregateFilter(filtered, ''))).toBe(
      'sum(value,foo,counter,none)'
    );
  });

  describe('virtual metrics', () => {
    const LCP_SCORE = {name: 'browser.web_vital.lcp.score', type: 'distribution'};
    const LCP_SCORE_AGGREGATE =
      'avg(tags[score.ratio.lcp,percentage],browser.web_vital.lcp,distribution,millisecond)';

    it('builds an aggregate of the attribute on the stored metric', () => {
      expect(generateFieldAsString(buildTraceMetricAggregate('avg', LCP_SCORE))).toBe(
        LCP_SCORE_AGGREGATE
      );
      expect(
        generateFieldAsString(
          buildTraceMetricAggregate('count', {
            name: 'browser.web_vital.cls.score',
            type: 'distribution',
          })
        )
      ).toBe(
        'count(tags[score.ratio.cls,percentage],browser.web_vital.cls,distribution,none)'
      );
    });

    it('keeps the filter on a virtual metric aggregate', () => {
      expect(
        generateFieldAsString(
          buildTraceMetricAggregate('avg', LCP_SCORE, 'browser.name:Chrome')
        )
      ).toBe(
        'avg_if(`browser.name:Chrome`,tags[score.ratio.lcp,percentage],browser.web_vital.lcp,distribution,millisecond)'
      );
    });

    it('extracts the virtual metric from an attribute aggregate', () => {
      expect(
        extractTraceMetricFromColumn(explodeFieldString(LCP_SCORE_AGGREGATE))
      ).toEqual({
        name: 'browser.web_vital.lcp.score',
        type: 'distribution',
        unit: 'ratio',
      });
    });

    it('does not resolve an attribute no virtual metric stands for', () => {
      expect(
        extractTraceMetricFromColumn(
          explodeFieldString('avg(tags[foo,number],bar,distribution,none)')
        )
      ).toBeUndefined();
    });

    it('moves a stored score metric aggregate onto the attribute', () => {
      const metric = extractTraceMetricFromColumn(
        explodeFieldString('avg(value,browser.web_vital.lcp.score,distribution,ratio)')
      );
      expect(generateFieldAsString(buildTraceMetricAggregate('avg', metric!))).toBe(
        LCP_SCORE_AGGREGATE
      );
    });
  });
});
