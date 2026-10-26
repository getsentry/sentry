import {DetectorMetricsConfig} from 'sentry/views/detectors/datasetConfig/metrics';

const EQUATION =
  'sum_if(`user.id:bc`,value,page.view,counter,none) + sum(value,page.view,counter,none)';

describe('DetectorMetricsConfig.getAggregateSummary', () => {
  it('collapses an equation to its reference labels', () => {
    expect(DetectorMetricsConfig.getAggregateSummary?.(`equation|${EQUATION}`)).toEqual({
      expression: 'A + B',
      headers: ['Application Metric', 'Operation', 'Filter'],
      components: [
        // `sum_if` splits into a plain operation and the filter it carried
        {label: 'A', values: ['page.view', 'sum', 'user.id:bc']},
        {label: 'B', values: ['page.view', 'sum', '']},
      ],
    });
  });

  it('tightens parentheses', () => {
    expect(
      DetectorMetricsConfig.getAggregateSummary?.(
        'equation|(sum(value,page.view,counter,none) + sum(value,checkout,counter,none)) / sum(value,errors,counter,none)'
      )?.expression
    ).toBe('(A + B) / C');
  });

  it('returns null for a single aggregate', () => {
    expect(
      DetectorMetricsConfig.getAggregateSummary?.('sum(value,page.view,counter,none)')
    ).toBeNull();
  });

  it('returns null for a single conditional aggregate', () => {
    expect(
      DetectorMetricsConfig.getAggregateSummary?.(
        'sum_if(`user.id:bc`,value,page.view,counter,none)'
      )
    ).toBeNull();
  });
});

describe('DetectorMetricsConfig.formatAggregateForTitle', () => {
  it('uses the reference labels for an equation', () => {
    expect(DetectorMetricsConfig.formatAggregateForTitle?.(`equation|${EQUATION}`)).toBe(
      'A + B'
    );
  });

  it('uses the reference labels when the form has not prefixed the equation', () => {
    expect(DetectorMetricsConfig.formatAggregateForTitle?.(EQUATION)).toBe('A + B');
  });

  it('leaves a single aggregate alone', () => {
    expect(
      DetectorMetricsConfig.formatAggregateForTitle?.('sum(value,page.view,counter,none)')
    ).toBe('sum(value,page.view,counter,none)');
  });

  it('labels a bare count', () => {
    expect(DetectorMetricsConfig.formatAggregateForTitle?.('count()')).toBe(
      'Number of application metrics'
    );
  });
});
