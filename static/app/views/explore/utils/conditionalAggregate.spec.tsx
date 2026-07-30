import {
  andSearchQueries,
  applyConditionalFilter,
  buildConditionalAggregate,
  foldConditionalAggregateIntoQuery,
  parseConditionalAggregate,
  supportsConditionalAggregateFilter,
  withBaseConditionalAggregateField,
  withReadableConditionalFilter,
} from 'sentry/views/explore/utils/conditionalAggregate';

describe('conditionalAggregate', () => {
  describe('parseConditionalAggregate', () => {
    it('parses a plain aggregate', () => {
      expect(parseConditionalAggregate('avg(span.duration)')).toEqual({
        name: 'avg',
        arguments: ['span.duration'],
        filter: '',
      });
    });

    it('parses an _if aggregate with a simple filter', () => {
      expect(parseConditionalAggregate('avg_if(`span.op:db`,span.duration)')).toEqual({
        name: 'avg',
        arguments: ['span.duration'],
        filter: 'span.op:db',
      });
    });

    it('parses an _if aggregate with commas inside the filter', () => {
      expect(
        parseConditionalAggregate('avg_if(`span.op:[db,http]`,span.duration)')
      ).toEqual({
        name: 'avg',
        arguments: ['span.duration'],
        filter: 'span.op:[db,http]',
      });
    });

    it('parses a parameterless _if aggregate', () => {
      expect(parseConditionalAggregate('failure_rate_if(`span.status:error`)')).toEqual({
        name: 'failure_rate',
        arguments: [],
        filter: 'span.status:error',
      });
    });

    it('leaves Discover-style count_if without backticks as-is', () => {
      expect(
        parseConditionalAggregate('count_if(transaction.duration,equals,300)')
      ).toEqual({
        name: 'count_if',
        arguments: ['transaction.duration', 'equals', '300'],
        filter: '',
      });
    });
  });

  describe('buildConditionalAggregate', () => {
    it('builds a plain aggregate when filter is empty', () => {
      expect(
        buildConditionalAggregate({
          name: 'avg',
          arguments: ['span.duration'],
          filter: '',
        })
      ).toBe('avg(span.duration)');
    });

    it('builds an _if aggregate when filter is present', () => {
      expect(
        buildConditionalAggregate({
          name: 'avg',
          arguments: ['span.duration'],
          filter: 'span.op:db',
        })
      ).toBe('avg_if(`span.op:db`,span.duration)');
    });

    it('builds a parameterless _if aggregate when filter is present', () => {
      expect(
        buildConditionalAggregate({
          name: 'failure_rate',
          arguments: [],
          filter: 'span.status:error',
        })
      ).toBe('failure_rate_if(`span.status:error`)');
    });

    it('treats whitespace-only filters as empty', () => {
      expect(
        buildConditionalAggregate({
          name: 'count',
          arguments: ['span.duration'],
          filter: '   ',
        })
      ).toBe('count(span.duration)');
    });
  });

  describe('applyConditionalFilter', () => {
    it('wraps a plain aggregate with a filter', () => {
      expect(applyConditionalFilter('avg(span.duration)', 'span.op:db')).toBe(
        'avg_if(`span.op:db`,span.duration)'
      );
    });

    it('removes _if when filter is cleared', () => {
      expect(applyConditionalFilter('avg_if(`span.op:db`,span.duration)', '')).toBe(
        'avg(span.duration)'
      );
    });
  });

  describe('andSearchQueries', () => {
    it('returns empty when all parts are empty', () => {
      expect(andSearchQueries('', '  ')).toBe('');
    });

    it('returns the sole non-empty part without parentheses', () => {
      expect(andSearchQueries('', 'span.op:db')).toBe('span.op:db');
      expect(andSearchQueries('span.status:error', '')).toBe('span.status:error');
    });

    it('ANDs multiple parts with parentheses', () => {
      expect(andSearchQueries('span.op:http', 'span.status:error')).toBe(
        '(span.op:http) (span.status:error)'
      );
    });

    it('preserves OR precedence when combining queries', () => {
      expect(andSearchQueries('a:1 OR a:2', 'b:3')).toBe('(a:1 OR a:2) (b:3)');
    });
  });

  describe('foldConditionalAggregateIntoQuery', () => {
    it('leaves plain aggregates unchanged', () => {
      expect(
        foldConditionalAggregateIntoQuery({
          query: 'span.op:http',
          yAxis: 'avg(span.duration)',
        })
      ).toEqual({
        query: 'span.op:http',
        yAxis: 'avg(span.duration)',
      });
    });

    it('merges the _if filter into the query and strips _if from the yAxis', () => {
      expect(
        foldConditionalAggregateIntoQuery({
          query: 'span.op:http',
          yAxis: 'avg_if(`span.status:error`,span.duration)',
        })
      ).toEqual({
        query: '(span.op:http) (span.status:error)',
        yAxis: 'avg(span.duration)',
      });
    });

    it('uses only the _if filter when the top-level query is empty', () => {
      expect(
        foldConditionalAggregateIntoQuery({
          query: '',
          yAxis: 'count_if(`span.op:db`,span.duration)',
        })
      ).toEqual({
        query: 'span.op:db',
        yAxis: 'count(span.duration)',
      });
    });

    it('leaves Discover-style count_if unchanged', () => {
      expect(
        foldConditionalAggregateIntoQuery({
          query: 'span.op:http',
          yAxis: 'count_if(transaction.duration,equals,300)',
        })
      ).toEqual({
        query: 'span.op:http',
        yAxis: 'count_if(transaction.duration,equals,300)',
      });
    });

    it('strips whitespace-only _if filters without changing the query', () => {
      expect(
        foldConditionalAggregateIntoQuery({
          query: 'span.op:http',
          yAxis: 'avg_if(`   `,span.duration)',
        })
      ).toEqual({
        query: 'span.op:http',
        yAxis: 'avg(span.duration)',
      });
    });
  });

  describe('withReadableConditionalFilter', () => {
    it('rewrites contains markers to *value*', () => {
      const contains = '\uF00DContains\uF00D';
      expect(
        withReadableConditionalFilter(`avg_if(\`span.op:${contains}db\`,span.duration)`)
      ).toBe('avg_if(`span.op:*db*`,span.duration)');
    });

    it('rewrites starts with markers to value*', () => {
      const startsWith = '\uF00DStartsWith\uF00D';
      expect(
        withReadableConditionalFilter(`avg_if(\`span.op:${startsWith}db\`,span.duration)`)
      ).toBe('avg_if(`span.op:db*`,span.duration)');
    });

    it('leaves plain filters unchanged', () => {
      expect(withReadableConditionalFilter('avg_if(`span.op:db`,span.duration)')).toBe(
        'avg_if(`span.op:db`,span.duration)'
      );
    });
  });

  describe('supportsConditionalAggregateFilter', () => {
    it('allows filters for standard aggregates', () => {
      expect(supportsConditionalAggregateFilter('avg')).toBe(true);
      expect(supportsConditionalAggregateFilter('count')).toBe(true);
      expect(supportsConditionalAggregateFilter('sum')).toBe(true);
    });

    it('denies filters when no aggregate is selected', () => {
      expect(supportsConditionalAggregateFilter('')).toBe(false);
    });

    it('denies filters for no-argument and score formulas', () => {
      expect(supportsConditionalAggregateFilter('epm')).toBe(false);
      expect(supportsConditionalAggregateFilter('eps')).toBe(false);
      expect(supportsConditionalAggregateFilter('failure_rate')).toBe(false);
      expect(supportsConditionalAggregateFilter('failure_count')).toBe(false);
      expect(supportsConditionalAggregateFilter('performance_score')).toBe(false);
      expect(supportsConditionalAggregateFilter('opportunity_score')).toBe(false);
      expect(supportsConditionalAggregateFilter('apdex')).toBe(false);
      expect(supportsConditionalAggregateFilter('user_misery')).toBe(false);
    });
  });

  describe('withBaseConditionalAggregateField', () => {
    it('rewrites Explore-style _if function names to the base aggregate', () => {
      expect(
        withBaseConditionalAggregateField({
          kind: 'function',
          function: ['count_unique_if' as any, '`span.op:db`', 'span.op', undefined],
        })
      ).toEqual({
        kind: 'function',
        function: ['count_unique', 'span.op', undefined, undefined],
      });
    });

    it('leaves Discover-style count_if unchanged', () => {
      const field = {
        kind: 'function' as const,
        function: ['count_if' as any, 'transaction.duration', 'equals', '300'] as const,
      };
      expect(withBaseConditionalAggregateField(field as any)).toEqual(field);
    });
  });
});
