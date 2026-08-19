import {TermOperator, WildcardOperators} from 'sentry/components/searchSyntax/parser';
import {addSearchFilterToQuery} from 'sentry/views/explore/components/traceItemFilterActions';
import {DEFAULT_VISUALIZATION} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {
  canCompareQueries,
  canReorderCharts,
  reorderCharts,
} from 'sentry/views/explore/spans/spansCommandPaletteActions';

describe('canCompareQueries', () => {
  it('requires at least two chart queries', () => {
    const chart = () => new VisualizeFunction(DEFAULT_VISUALIZATION);

    expect(canCompareQueries([chart()])).toBe(false);
    expect(canCompareQueries([chart(), new VisualizeEquation('#1 + #2')])).toBe(false);
    expect(canCompareQueries([chart(), chart()])).toBe(true);
  });
});

describe('chart reordering', () => {
  const charts = [
    new VisualizeFunction('count(span.duration)'),
    new VisualizeFunction('p95(span.duration)'),
    new VisualizeEquation('#1 + #2'),
  ];

  it('is available only with multiple distinguishable charts', () => {
    expect(canReorderCharts(charts.slice(0, 1))).toBe(false);
    expect(canReorderCharts(charts.slice(0, 2))).toBe(true);
    expect(
      canReorderCharts([
        new VisualizeFunction('count(span.duration)'),
        new VisualizeFunction('count(span.duration)'),
      ])
    ).toBe(false);
  });

  it('moves a chart in either direction without mutating the input', () => {
    expect(reorderCharts(charts, 0, 'down')).toEqual([charts[1], charts[0], charts[2]]);
    expect(reorderCharts(charts, 2, 'up')).toEqual([charts[0], charts[2], charts[1]]);
    expect(charts.map(chart => chart.yAxis)).toEqual([
      'count(span.duration)',
      'p95(span.duration)',
      '#1 + #2',
    ]);
  });

  it('does not move a chart beyond the list boundaries', () => {
    expect(reorderCharts(charts, 0, 'up')).toEqual(charts);
    expect(reorderCharts(charts, charts.length - 1, 'down')).toEqual(charts);
  });
});

describe('addSearchFilterToQuery', () => {
  it('does not add the same filter twice', () => {
    expect(
      addSearchFilterToQuery('project:frontend-react', {
        key: 'project',
        op: TermOperator.DEFAULT,
        value: 'frontend-react',
      })
    ).toBe('project:frontend-react');
  });

  it('preserves distinct values for the same attribute', () => {
    expect(
      addSearchFilterToQuery('project:frontend-react', {
        key: 'project',
        op: TermOperator.DEFAULT,
        value: 'backend-python',
      })
    ).toBe('project:frontend-react project:backend-python');
  });

  it('does not add the same negated filter twice', () => {
    expect(
      addSearchFilterToQuery('!project:frontend-react', {
        key: 'project',
        op: TermOperator.NOT_EQUAL,
        value: 'frontend-react',
      })
    ).toBe('!project:frontend-react');
  });

  it.each([
    [TermOperator.CONTAINS, '', WildcardOperators.CONTAINS],
    [TermOperator.DOES_NOT_CONTAIN, '!', WildcardOperators.CONTAINS],
    [TermOperator.STARTS_WITH, '', WildcardOperators.STARTS_WITH],
    [TermOperator.DOES_NOT_START_WITH, '!', WildcardOperators.STARTS_WITH],
    [TermOperator.ENDS_WITH, '', WildcardOperators.ENDS_WITH],
    [TermOperator.DOES_NOT_END_WITH, '!', WildcardOperators.ENDS_WITH],
  ])('serializes the %s wildcard operator', (op, negation, wildcard) => {
    expect(
      addSearchFilterToQuery('', {
        key: 'span.description',
        op,
        value: 'checkout request',
      })
    ).toBe(`${negation}span.description:${wildcard}"checkout request"`);
  });

  it('preserves multiple wildcard values for the same attribute', () => {
    expect(
      addSearchFilterToQuery(`span.description:${WildcardOperators.CONTAINS}checkout`, {
        key: 'span.description',
        op: TermOperator.CONTAINS,
        value: 'payment',
      })
    ).toBe(
      `span.description:${WildcardOperators.CONTAINS}checkout ` +
        `span.description:${WildcardOperators.CONTAINS}payment`
    );
  });

  it('does not conflate exact and wildcard values when deduplicating', () => {
    expect(
      addSearchFilterToQuery('span.description:checkout', {
        key: 'span.description',
        op: TermOperator.CONTAINS,
        value: 'checkout',
      })
    ).toBe(
      `span.description:checkout span.description:${WildcardOperators.CONTAINS}checkout`
    );
  });
});
