import {
  applyConditionalFilter,
  buildConditionalAggregate,
  parseConditionalAggregate,
  supportsConditionalAggregateFilter,
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
});
