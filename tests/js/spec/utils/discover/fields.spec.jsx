import {
  getAggregateAlias,
  isAggregateField,
  explodeField,
  aggregateOutputType,
  aggregateMultiPlotType,
} from 'app/utils/discover/fields';

describe('getAggregateAlias', function() {
  it('no-ops simple fields', function() {
    expect(getAggregateAlias('field')).toEqual('field');
    expect(getAggregateAlias('under_field')).toEqual('under_field');
    expect(getAggregateAlias('foo.bar.is-Enterprise_42')).toEqual(
      'foo.bar.is-Enterprise_42'
    );
  });

  it('handles 0 arg functions', function() {
    expect(getAggregateAlias('count()')).toEqual('count');
    expect(getAggregateAlias('count_unique()')).toEqual('count_unique');
  });

  it('handles 1 arg functions', function() {
    expect(getAggregateAlias('count(id)')).toEqual('count_id');
    expect(getAggregateAlias('count_unique(user)')).toEqual('count_unique_user');
    expect(getAggregateAlias('count_unique(issue.id)')).toEqual('count_unique_issue_id');
    expect(getAggregateAlias('count(foo.bar.is-Enterprise_42)')).toEqual(
      'count_foo_bar_is-Enterprise_42'
    );
  });

  it('handles 2 arg functions', function() {
    expect(getAggregateAlias('percentile(transaction.duration,0.81)')).toEqual(
      'percentile_transaction_duration_0_81'
    );
    expect(getAggregateAlias('percentile(transaction.duration,  0.11)')).toEqual(
      'percentile_transaction_duration_0_11'
    );
  });
});

describe('isAggregateField', function() {
  it('detects aliases', function() {
    expect(isAggregateField('p888')).toBe(false);
    expect(isAggregateField('other_field')).toBe(false);
    expect(isAggregateField('foo.bar.is-Enterprise_42')).toBe(false);
  });

  it('detects functions', function() {
    expect(isAggregateField('count()')).toBe(true);
    expect(isAggregateField('p75()')).toBe(true);
    expect(isAggregateField('percentile(transaction.duration, 0.55)')).toBe(true);
    expect(isAggregateField('last_seen()')).toBe(true);
    expect(isAggregateField('thing(')).toBe(false);
    expect(isAggregateField('unique_count(user)')).toBe(true);
    expect(isAggregateField('unique_count(foo.bar.is-Enterprise_42)')).toBe(true);
  });
});

describe('explodeField', function() {
  it('explodes fields', function() {
    expect(explodeField({field: 'foobar'})).toEqual({
      kind: 'field',
      field: 'foobar',
    });

    // has width
    expect(explodeField({field: 'foobar', width: 123})).toEqual({
      kind: 'field',
      field: 'foobar',
    });

    // has aggregation
    expect(explodeField({field: 'count(foobar)', width: 123})).toEqual({
      kind: 'function',
      function: ['count', 'foobar', undefined],
    });

    // custom tag
    expect(explodeField({field: 'foo.bar.is-Enterprise_42', width: 123})).toEqual({
      kind: 'field',
      field: 'foo.bar.is-Enterprise_42',
    });

    // custom tag with aggregation
    expect(explodeField({field: 'count(foo.bar.is-Enterprise_42)', width: 123})).toEqual({
      kind: 'function',
      function: ['count', 'foo.bar.is-Enterprise_42', undefined],
    });
  });
});

describe('aggregateOutputType', function() {
  it('handles unknown fields', function() {
    expect(aggregateOutputType('')).toEqual('number');
    expect(aggregateOutputType('blerg')).toEqual('number');
  });

  it('handles duration functions', function() {
    expect(aggregateOutputType('p50()')).toEqual('duration');
    expect(aggregateOutputType('p75()')).toEqual('duration');
    expect(aggregateOutputType('p95()')).toEqual('duration');
    expect(aggregateOutputType('p99()')).toEqual('duration');
    expect(aggregateOutputType('p100()')).toEqual('duration');
    expect(aggregateOutputType('percentile(transaction.duration, 0.51)')).toEqual(
      'duration'
    );
    expect(aggregateOutputType('percentile(transaction.duration,0.99)')).toEqual(
      'duration'
    );
  });

  it('handles percentage functions', function() {
    expect(aggregateOutputType('failure_rate()')).toEqual('percentage');
  });

  it('handles number functions', function() {
    expect(aggregateOutputType('apdex()')).toEqual('number');
    expect(aggregateOutputType('apdex(500)')).toEqual('number');
    expect(aggregateOutputType('user_misery(500)')).toEqual('number');
    expect(aggregateOutputType('eps()')).toEqual('number');
    expect(aggregateOutputType('epm()')).toEqual('number');
  });

  it('handles inherit functions', function() {
    expect(aggregateOutputType('sum(transaction.duration)')).toEqual('duration');
    expect(aggregateOutputType('sum(stack.colno)')).toEqual('number');

    expect(aggregateOutputType('min(stack.colno)')).toEqual('number');
    expect(aggregateOutputType('min(timestamp)')).toEqual('date');

    expect(aggregateOutputType('max(stack.colno)')).toEqual('number');
    expect(aggregateOutputType('max(timestamp)')).toEqual('date');
  });
});

describe('aggregateMultiPlotType', function() {
  it('handles unknown functions', function() {
    expect(aggregateMultiPlotType('blerg')).toBe('area');
    expect(aggregateMultiPlotType('blerg(uhoh)')).toBe('area');
  });
  it('handles known functions', function() {
    expect(aggregateMultiPlotType('sum(transaction.duration)')).toBe('area');
    expect(aggregateMultiPlotType('p95()')).toBe('line');
  });
});
