import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {
  applyConditionalFilter,
  areAllVisualizesInvalidConditionalFilters,
  buildConditionalAggregate,
  escapeConditionalFilter,
  getConditionalFilterInvalidSeriesMessage,
  getConditionalFilterInvalidSeriesMessageForYAxis,
  isConditionalAggregateFilterValid,
  isConditionalAggregateYAxisValid,
  parseConditionalAggregate,
  supportsConditionalAggregateFilter,
  withReadableConditionalFilter,
} from 'sentry/views/explore/utils/conditionalAggregate';

describe('escapeConditionalFilter', () => {
  it('leaves filters without backticks alone', () => {
    expect(escapeConditionalFilter('span.op:db')).toBe('span.op:db');
  });

  it('trims surrounding whitespace', () => {
    expect(escapeConditionalFilter('  span.op:db  ')).toBe('span.op:db');
  });

  it('drops backticks so the filter can be wrapped in them', () => {
    expect(escapeConditionalFilter('span.description:"a`b"')).toBe(
      'span.description:"ab"'
    );
    expect(escapeConditionalFilter('`span.op:db`')).toBe('span.op:db');
  });
});

// The parsing itself is covered by parseFunction's backtick / `_if` tests in
// static/app/utils/discover/fields.spec.tsx.
describe('parseConditionalAggregate', () => {
  it('parses a plain aggregate', () => {
    expect(parseConditionalAggregate('avg(span.duration)')).toEqual({
      name: 'avg',
      arguments: ['span.duration'],
    });
  });

  it('strips the _if combinator and filter argument', () => {
    expect(parseConditionalAggregate('avg_if(`span.op:db`,span.duration)')).toEqual({
      name: 'avg',
      arguments: ['span.duration'],
      filter: 'span.op:db',
    });
  });

  it('returns null when the yAxis is not a function', () => {
    expect(parseConditionalAggregate('span.duration')).toBeNull();
  });
});

describe('buildConditionalAggregate', () => {
  it('builds a plain aggregate when there is no filter', () => {
    expect(
      buildConditionalAggregate({
        name: 'avg',
        arguments: ['span.duration'],
        filter: '',
      })
    ).toBe('avg(span.duration)');
  });

  it('treats a whitespace only filter as no filter', () => {
    expect(
      buildConditionalAggregate({
        name: 'avg',
        arguments: ['span.duration'],
        filter: '   ',
      })
    ).toBe('avg(span.duration)');
  });

  it('wraps the filter in backticks as the first argument', () => {
    expect(
      buildConditionalAggregate({
        name: 'avg',
        arguments: ['span.duration'],
        filter: 'span.op:db',
      })
    ).toBe('avg_if(`span.op:db`,span.duration)');
  });

  it('escapes backticks in the filter', () => {
    expect(
      buildConditionalAggregate({
        name: 'count',
        arguments: ['span.duration'],
        filter: 'span.description:"a`b"',
      })
    ).toBe('count_if(`span.description:"ab"`,span.duration)');
  });

  it('round trips a filter containing commas', () => {
    const filter = 'span.op:[db,http]';
    const yAxis = buildConditionalAggregate({
      name: 'sum',
      arguments: ['span.duration'],
      filter,
    });

    expect(yAxis).toBe('sum_if(`span.op:[db,http]`,span.duration)');
    expect(parseConditionalAggregate(yAxis)?.filter).toBe(filter);
  });
});

describe('applyConditionalFilter', () => {
  it('adds a filter to a plain aggregate', () => {
    expect(applyConditionalFilter('avg(span.duration)', 'span.op:db')).toBe(
      'avg_if(`span.op:db`,span.duration)'
    );
  });

  it('replaces an existing filter', () => {
    expect(
      applyConditionalFilter('avg_if(`span.op:db`,span.duration)', 'span.op:http')
    ).toBe('avg_if(`span.op:http`,span.duration)');
  });

  it('removes the combinator when the filter is cleared', () => {
    expect(applyConditionalFilter('avg_if(`span.op:db`,span.duration)', '')).toBe(
      'avg(span.duration)'
    );
  });
});

describe('withReadableConditionalFilter', () => {
  it('rewrites wildcard markers into wildcard syntax', () => {
    const contains = '\uF00DContains\uF00D';
    expect(
      withReadableConditionalFilter(`avg_if(\`span.op:${contains}db\`,span.duration)`)
    ).toBe('avg_if(`span.op:*db*`,span.duration)');
  });

  it('rewrites wildcard markers on each item of a list value', () => {
    const contains = '\uF00DContains\uF00D';
    expect(
      withReadableConditionalFilter(
        `avg_if(\`span.op:${contains}[db,http]\`,span.duration)`
      )
    ).toBe('avg_if(`span.op:[*db*,*http*]`,span.duration)');
  });

  it('leaves plain filters unchanged', () => {
    expect(withReadableConditionalFilter('avg_if(`span.op:db`,span.duration)')).toBe(
      'avg_if(`span.op:db`,span.duration)'
    );
    expect(withReadableConditionalFilter('avg(span.duration)')).toBe(
      'avg(span.duration)'
    );
  });
});

describe('supportsConditionalAggregateFilter', () => {
  it('supports span aggregates', () => {
    for (const aggregate of [
      'count',
      'count_unique',
      'avg',
      'sum',
      'min',
      'max',
      'p95',
    ]) {
      expect(supportsConditionalAggregateFilter(aggregate)).toBe(true);
    }
  });

  it('does not support formulas or an empty aggregate', () => {
    for (const aggregate of [
      '',
      'epm',
      'eps',
      'failure_rate',
      'failure_count',
      'performance_score',
      'opportunity_score',
    ]) {
      expect(supportsConditionalAggregateFilter(aggregate)).toBe(false);
    }
  });
});

describe('isConditionalAggregateFilterValid', () => {
  it('accepts empty filters', () => {
    expect(isConditionalAggregateFilterValid('')).toBe(true);
    expect(isConditionalAggregateFilterValid('   ')).toBe(true);
  });

  it('accepts attribute filters', () => {
    expect(isConditionalAggregateFilterValid('span.op:db')).toBe(true);
  });

  it('rejects incomplete filters', () => {
    expect(isConditionalAggregateFilterValid('span.op:')).toBe(false);
  });

  it('rejects aggregate filter keys', () => {
    expect(isConditionalAggregateFilterValid('p95(span.duration):>100')).toBe(false);
    expect(isConditionalAggregateFilterValid('count():>0')).toBe(false);
    // Duration units make the parser treat this as free text without duration
    // config; still reject it as an aggregate key.
    expect(isConditionalAggregateFilterValid('p95(span.duration):>300ms')).toBe(false);
  });

  it('rejects aggregate keys mixed with valid attribute filters', () => {
    expect(
      isConditionalAggregateFilterValid(
        'span.category:db _pi_file_io_main_thread:492262d12c82474e p95(span.duration):>300ms'
      )
    ).toBe(false);
  });
});

describe('isConditionalAggregateYAxisValid', () => {
  it('accepts plain aggregates and valid _if filters', () => {
    expect(isConditionalAggregateYAxisValid('count(span.duration)')).toBe(true);
    expect(isConditionalAggregateYAxisValid('count_if(`span.op:db`,span.duration)')).toBe(
      true
    );
  });

  it('rejects _if filters that use aggregate keys', () => {
    expect(
      isConditionalAggregateYAxisValid(
        'count_if(`p95(span.duration):>100`,span.duration)'
      )
    ).toBe(false);
    expect(
      isConditionalAggregateYAxisValid(
        'count_if(`span.category:db _pi_file_io_main_thread:492262d12c82474e p95(span.duration):>300ms`,span.duration)'
      )
    ).toBe(false);
  });
});

describe('getConditionalFilterInvalidSeriesMessage', () => {
  it('mentions aggregates when the filter includes a visualize aggregate', () => {
    expect(getConditionalFilterInvalidSeriesMessage('p95(span.duration):>100')).toBe(
      'Aggregates cannot be used in conditional filters'
    );
  });

  it('uses the generic message for other invalid filters', () => {
    expect(getConditionalFilterInvalidSeriesMessage('span.op:')).toBe(
      'Invalid series filter'
    );
  });

  it('uses the aggregate message for yAxes with aggregate filters', () => {
    expect(
      getConditionalFilterInvalidSeriesMessageForYAxis(
        'count_if(`p95(span.duration):>100`,span.duration)'
      )
    ).toBe('Aggregates cannot be used in conditional filters');
  });
});

describe('areAllVisualizesInvalidConditionalFilters', () => {
  it('is false when there are no visualizes', () => {
    expect(areAllVisualizesInvalidConditionalFilters([])).toBe(false);
  });

  it('is true when every series has an invalid _if filter', () => {
    expect(
      areAllVisualizesInvalidConditionalFilters([
        new VisualizeFunction('count_if(`p95(span.duration):>100`,span.duration)'),
      ])
    ).toBe(true);
  });

  it('is false when an invalid equation is the only series', () => {
    expect(
      areAllVisualizesInvalidConditionalFilters([new VisualizeEquation('equation|')])
    ).toBe(false);
  });

  it('is false when any series is still valid', () => {
    expect(
      areAllVisualizesInvalidConditionalFilters([
        new VisualizeFunction('count(span.duration)'),
        new VisualizeFunction('count_if(`p95(span.duration):>100`,span.duration)'),
      ])
    ).toBe(false);
  });
});
