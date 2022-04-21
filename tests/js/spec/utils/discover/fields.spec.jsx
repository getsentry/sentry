import {
  aggregateMultiPlotType,
  aggregateOutputType,
  explodeField,
  fieldAlignment,
  generateAggregateFields,
  getAggregateAlias,
  isAggregateEquation,
  isAggregateField,
  isMeasurement,
  measurementType,
  parseFunction,
} from 'sentry/utils/discover/fields';

describe('parseFunction', function () {
  it('returns null on non aggregate fields', function () {
    expect(parseFunction('field')).toEqual(null);
    expect(parseFunction('under_field')).toEqual(null);
    expect(parseFunction('foo.bar.is-Enterprise_42')).toEqual(null);
  });

  it('handles 0 arg functions', function () {
    expect(parseFunction('count()')).toEqual({
      name: 'count',
      arguments: [],
    });
    expect(parseFunction('count_unique()')).toEqual({
      name: 'count_unique',
      arguments: [],
    });
  });

  it('handles 1 arg functions', function () {
    expect(parseFunction('count(id)')).toEqual({
      name: 'count',
      arguments: ['id'],
    });
    expect(parseFunction('count_unique(user)')).toEqual({
      name: 'count_unique',
      arguments: ['user'],
    });
    expect(parseFunction('count_unique(issue.id)')).toEqual({
      name: 'count_unique',
      arguments: ['issue.id'],
    });
    expect(parseFunction('count(foo.bar.is-Enterprise_42)')).toEqual({
      name: 'count',
      arguments: ['foo.bar.is-Enterprise_42'],
    });
  });

  it('handles 2 arg functions', function () {
    expect(parseFunction('percentile(transaction.duration,0.81)')).toEqual({
      name: 'percentile',
      arguments: ['transaction.duration', '0.81'],
    });
    expect(parseFunction('percentile(transaction.duration,  0.11)')).toEqual({
      name: 'percentile',
      arguments: ['transaction.duration', '0.11'],
    });
  });

  it('handles 3 arg functions', function () {
    expect(parseFunction('count_if(transaction.duration,greater,0.81)')).toEqual({
      name: 'count_if',
      arguments: ['transaction.duration', 'greater', '0.81'],
    });
    expect(parseFunction('count_if(some_tag,greater,"0.81,123,152,()")')).toEqual({
      name: 'count_if',
      arguments: ['some_tag', 'greater', '"0.81,123,152,()"'],
    });
    expect(parseFunction('function(foo, bar, baz)')).toEqual({
      name: 'function',
      arguments: ['foo', 'bar', 'baz'],
    });
  });

  it('handles 4 arg functions', function () {
    expect(parseFunction('to_other(release,"0.81,123,152,()",others,current)')).toEqual({
      name: 'to_other',
      arguments: ['release', '"0.81,123,152,()"', 'others', 'current'],
    });
  });
});

describe('getAggregateAlias', function () {
  it('no-ops simple fields', function () {
    expect(getAggregateAlias('field')).toEqual('field');
    expect(getAggregateAlias('under_field')).toEqual('under_field');
    expect(getAggregateAlias('foo.bar.is-Enterprise_42')).toEqual(
      'foo.bar.is-Enterprise_42'
    );
  });

  it('handles 0 arg functions', function () {
    expect(getAggregateAlias('count()')).toEqual('count');
    expect(getAggregateAlias('count_unique()')).toEqual('count_unique');
  });

  it('handles 1 arg functions', function () {
    expect(getAggregateAlias('count(id)')).toEqual('count_id');
    expect(getAggregateAlias('count_unique(user)')).toEqual('count_unique_user');
    expect(getAggregateAlias('count_unique(issue.id)')).toEqual('count_unique_issue_id');
    expect(getAggregateAlias('count(foo.bar.is-Enterprise_42)')).toEqual(
      'count_foo_bar_is_Enterprise_42'
    );
  });

  it('handles 2 arg functions', function () {
    expect(getAggregateAlias('percentile(transaction.duration,0.81)')).toEqual(
      'percentile_transaction_duration_0_81'
    );
    expect(getAggregateAlias('percentile(transaction.duration,  0.11)')).toEqual(
      'percentile_transaction_duration_0_11'
    );
  });

  it('handles to_other with symbols', function () {
    expect(
      getAggregateAlias('to_other(release,"release:beta@1.1.1 (2)",others,current)')
    ).toEqual('to_other_release__release_beta_1_1_1__2___others_current');
  });
});

describe('isAggregateField', function () {
  it('detects aliases', function () {
    expect(isAggregateField('p888')).toBe(false);
    expect(isAggregateField('other_field')).toBe(false);
    expect(isAggregateField('foo.bar.is-Enterprise_42')).toBe(false);
  });

  it('detects functions', function () {
    expect(isAggregateField('count()')).toBe(true);
    expect(isAggregateField('p75()')).toBe(true);
    expect(isAggregateField('percentile(transaction.duration, 0.55)')).toBe(true);
    expect(isAggregateField('last_seen()')).toBe(true);
    expect(isAggregateField('thing(')).toBe(false);
    expect(isAggregateField('unique_count(user)')).toBe(true);
    expect(isAggregateField('unique_count(foo.bar.is-Enterprise_42)')).toBe(true);
  });
});

describe('isAggregateEquation', function () {
  it('detects functions', function () {
    expect(isAggregateEquation('equation|5 + count()')).toBe(true);
    expect(
      isAggregateEquation('equation|percentile(transaction.duration, 0.55) / count()')
    ).toBe(true);
    expect(isAggregateEquation('equation|(5 + 5) + (count() - 2)')).toBe(true);
  });

  it('detects lack of functions', function () {
    expect(isAggregateEquation('equation|5 + 5')).toBe(false);
    expect(isAggregateEquation('equation|(5 + 5)')).toBe(false);
    expect(isAggregateEquation('equation|5 + (thing - other_thing)')).toBe(false);
    expect(isAggregateEquation('equation|5+(thing-other_thing)')).toBe(false);
  });
});

describe('measurement', function () {
  it('isMeasurement', function () {
    expect(isMeasurement('measurements.fp')).toBe(true);
    expect(isMeasurement('measurements.fcp')).toBe(true);
    expect(isMeasurement('measurements.lcp')).toBe(true);
    expect(isMeasurement('measurements.fid')).toBe(true);
    expect(isMeasurement('measurements.foo')).toBe(true);
    expect(isMeasurement('measurements.bar')).toBe(true);
    expect(isMeasurement('timestamp')).toBe(false);
    expect(isMeasurement('project.id')).toBe(false);
    expect(isMeasurement('transaction')).toBe(false);
    expect(isMeasurement('max(timestamp)')).toBe(false);
    expect(isMeasurement('percentile(measurements.fcp, 0.5)')).toBe(false);
  });

  it('measurementType', function () {
    expect(measurementType('measurements.fp')).toBe('duration');
    expect(measurementType('measurements.fcp')).toBe('duration');
    expect(measurementType('measurements.lcp')).toBe('duration');
    expect(measurementType('measurements.fid')).toBe('duration');
    expect(measurementType('measurements.foo')).toBe('number');
    expect(measurementType('measurements.bar')).toBe('number');
  });
});

describe('explodeField', function () {
  it('explodes fields', function () {
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
      function: ['count', 'foobar', undefined, undefined],
    });

    // custom tag
    expect(explodeField({field: 'foo.bar.is-Enterprise_42', width: 123})).toEqual({
      kind: 'field',
      field: 'foo.bar.is-Enterprise_42',
    });

    // custom tag with aggregation
    expect(explodeField({field: 'count(foo.bar.is-Enterprise_42)', width: 123})).toEqual({
      kind: 'function',
      function: ['count', 'foo.bar.is-Enterprise_42', undefined, undefined],
    });
  });
});

describe('aggregateOutputType', function () {
  it('handles unknown fields', function () {
    expect(aggregateOutputType('')).toEqual('number');
    expect(aggregateOutputType('blerg')).toEqual('number');
  });

  it('handles duration functions', function () {
    expect(aggregateOutputType('p50()')).toEqual('duration');
    expect(aggregateOutputType('p75()')).toEqual('duration');
    expect(aggregateOutputType('p95()')).toEqual('duration');
    expect(aggregateOutputType('p99()')).toEqual('duration');
    expect(aggregateOutputType('p100()')).toEqual('duration');
    expect(aggregateOutputType('p50(transaction.duration)')).toEqual('duration');
    expect(aggregateOutputType('p75(transaction.duration)')).toEqual('duration');
    expect(aggregateOutputType('p95(transaction.duration)')).toEqual('duration');
    expect(aggregateOutputType('p99(transaction.duration)')).toEqual('duration');
    expect(aggregateOutputType('p100(transaction.duration)')).toEqual('duration');
    expect(aggregateOutputType('percentile(transaction.duration, 0.51)')).toEqual(
      'duration'
    );
    expect(aggregateOutputType('percentile(transaction.duration,0.99)')).toEqual(
      'duration'
    );
  });

  it('handles percentage functions', function () {
    expect(aggregateOutputType('failure_rate()')).toEqual('percentage');
  });

  it('handles number functions', function () {
    expect(aggregateOutputType('apdex()')).toEqual('number');
    expect(aggregateOutputType('apdex(500)')).toEqual('number');
    expect(aggregateOutputType('count_miserable(user, 500)')).toEqual('number');
    expect(aggregateOutputType('user_misery(500)')).toEqual('number');
    expect(aggregateOutputType('eps()')).toEqual('number');
    expect(aggregateOutputType('epm()')).toEqual('number');
  });

  it('handles inherit functions', function () {
    expect(aggregateOutputType('sum(transaction.duration)')).toEqual('duration');
    expect(aggregateOutputType('sum(stack.colno)')).toEqual('number');

    expect(aggregateOutputType('min(stack.colno)')).toEqual('number');
    expect(aggregateOutputType('min(timestamp)')).toEqual('date');

    expect(aggregateOutputType('max(stack.colno)')).toEqual('number');
    expect(aggregateOutputType('max(timestamp)')).toEqual('date');
  });

  it('handles measurements', function () {
    expect(aggregateOutputType('sum(measurements.fcp)')).toEqual('duration');
    expect(aggregateOutputType('min(measurements.fcp)')).toEqual('duration');
    expect(aggregateOutputType('max(measurements.fcp)')).toEqual('duration');
    expect(aggregateOutputType('avg(measurements.fcp)')).toEqual('duration');
    expect(aggregateOutputType('percentile(measurements.fcp, 0.5)')).toEqual('duration');
    expect(aggregateOutputType('sum(measurements.bar)')).toEqual('number');
    expect(aggregateOutputType('min(measurements.bar)')).toEqual('number');
    expect(aggregateOutputType('max(measurements.bar)')).toEqual('number');
    expect(aggregateOutputType('avg(measurements.bar)')).toEqual('number');
    expect(aggregateOutputType('percentile(measurements.bar, 0.5)')).toEqual('number');
    expect(aggregateOutputType('p50(measurements.bar)')).toEqual('number');
    expect(aggregateOutputType('p75(measurements.bar)')).toEqual('number');
    expect(aggregateOutputType('p95(measurements.bar)')).toEqual('number');
    expect(aggregateOutputType('p99(measurements.bar)')).toEqual('number');
    expect(aggregateOutputType('p100(measurements.bar)')).toEqual('number');
  });
});

describe('aggregateMultiPlotType', function () {
  it('handles unknown functions', function () {
    expect(aggregateMultiPlotType('blerg')).toBe('area');
    expect(aggregateMultiPlotType('blerg(uhoh)')).toBe('area');
  });
  it('handles known functions', function () {
    expect(aggregateMultiPlotType('sum(transaction.duration)')).toBe('area');
    expect(aggregateMultiPlotType('p95()')).toBe('line');
    expect(aggregateMultiPlotType('equation|sum(transaction.duration) / 2')).toBe('line');
  });
});

describe('generateAggregateFields', function () {
  const organization = TestStubs.Organization();
  it('gets default aggregates', function () {
    expect(generateAggregateFields(organization, [])).toContainEqual({field: 'count()'});
  });

  it('includes fields from eventFields', function () {
    expect(
      generateAggregateFields(organization, [{field: 'not_real_aggregate()'}])
    ).toContainEqual({field: 'not_real_aggregate()'});
  });

  it('excludes fields from aggregates', function () {
    expect(generateAggregateFields(organization, [], ['count()'])).not.toContainEqual({
      field: 'count()',
    });
  });
});

describe('fieldAlignment()', function () {
  it('works with only field name', function () {
    expect(fieldAlignment('event.type')).toEqual('left');

    // Should be right, but we don't have any type data.
    expect(fieldAlignment('transaction.duration')).toEqual('left');
  });

  it('works with type parameter', function () {
    expect(fieldAlignment('transaction.duration', 'duration')).toEqual('right');
    expect(fieldAlignment('device.battery_level', 'number')).toEqual('right');
    expect(fieldAlignment('min(timestamp)', 'datetime')).toEqual('left');
  });

  it('can use table metadata', function () {
    const meta = {
      'transaction.duration': 'duration',
      title: 'string',
    };
    expect(fieldAlignment('transaction.duration', 'never', meta)).toEqual('right');
    expect(fieldAlignment('transaction.duration', undefined, meta)).toEqual('right');

    expect(fieldAlignment('title', undefined, meta)).toEqual('left');
  });
});
