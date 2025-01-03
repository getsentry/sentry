import {OrganizationFixture} from 'sentry-fixture/organization';

import type {ColumnValueType} from 'sentry/utils/discover/fields';
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
    expect(parseFunction('field')).toBeNull();
    expect(parseFunction('under_field')).toBeNull();
    expect(parseFunction('foo.bar.is-Enterprise_42')).toBeNull();
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

  it('handles functions with numeric tag arguments', function () {
    expect(parseFunction('count(tags[foo,number])')).toEqual({
      name: 'count',
      arguments: ['tags[foo,number]'],
    });
  });
});

describe('getAggregateAlias', function () {
  it('no-ops simple fields', function () {
    expect(getAggregateAlias('field')).toBe('field');
    expect(getAggregateAlias('under_field')).toBe('under_field');
    expect(getAggregateAlias('foo.bar.is-Enterprise_42')).toBe(
      'foo.bar.is-Enterprise_42'
    );
  });

  it('handles 0 arg functions', function () {
    expect(getAggregateAlias('count()')).toBe('count');
    expect(getAggregateAlias('count_unique()')).toBe('count_unique');
  });

  it('handles 1 arg functions', function () {
    expect(getAggregateAlias('count(id)')).toBe('count_id');
    expect(getAggregateAlias('count_unique(user)')).toBe('count_unique_user');
    expect(getAggregateAlias('count_unique(issue.id)')).toBe('count_unique_issue_id');
    expect(getAggregateAlias('count(foo.bar.is-Enterprise_42)')).toBe(
      'count_foo_bar_is_Enterprise_42'
    );
  });

  it('handles 2 arg functions', function () {
    expect(getAggregateAlias('percentile(transaction.duration,0.81)')).toBe(
      'percentile_transaction_duration_0_81'
    );
    expect(getAggregateAlias('percentile(transaction.duration,  0.11)')).toBe(
      'percentile_transaction_duration_0_11'
    );
  });

  it('handles to_other with symbols', function () {
    expect(
      getAggregateAlias('to_other(release,"release:beta@1.1.1 (2)",others,current)')
    ).toBe('to_other_release__release_beta_1_1_1__2___others_current');
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
    expect(aggregateOutputType('')).toBe('number');
    expect(aggregateOutputType('blerg')).toBe('number');
  });

  it('handles duration functions', function () {
    expect(aggregateOutputType('p50()')).toBe('duration');
    expect(aggregateOutputType('p75()')).toBe('duration');
    expect(aggregateOutputType('p95()')).toBe('duration');
    expect(aggregateOutputType('p99()')).toBe('duration');
    expect(aggregateOutputType('p100()')).toBe('duration');
    expect(aggregateOutputType('p50(transaction.duration)')).toBe('duration');
    expect(aggregateOutputType('p75(transaction.duration)')).toBe('duration');
    expect(aggregateOutputType('p95(transaction.duration)')).toBe('duration');
    expect(aggregateOutputType('p99(transaction.duration)')).toBe('duration');
    expect(aggregateOutputType('p100(transaction.duration)')).toBe('duration');
    expect(aggregateOutputType('percentile(transaction.duration, 0.51)')).toBe(
      'duration'
    );
    expect(aggregateOutputType('percentile(transaction.duration,0.99)')).toBe('duration');
  });

  it('handles percentage functions', function () {
    expect(aggregateOutputType('failure_rate()')).toBe('percentage');
  });

  it('handles number functions', function () {
    expect(aggregateOutputType('apdex()')).toBe('number');
    expect(aggregateOutputType('apdex(500)')).toBe('number');
    expect(aggregateOutputType('count_miserable(user, 500)')).toBe('number');
    expect(aggregateOutputType('user_misery(500)')).toBe('number');
    expect(aggregateOutputType('eps()')).toBe('number');
    expect(aggregateOutputType('epm()')).toBe('number');
  });

  it('handles inherit functions', function () {
    expect(aggregateOutputType('sum(transaction.duration)')).toBe('duration');
    expect(aggregateOutputType('sum(stack.colno)')).toBe('number');

    expect(aggregateOutputType('min(stack.colno)')).toBe('number');
    expect(aggregateOutputType('min(timestamp)')).toBe('date');

    expect(aggregateOutputType('max(stack.colno)')).toBe('number');
    expect(aggregateOutputType('max(timestamp)')).toBe('date');
  });

  it('handles measurements', function () {
    expect(aggregateOutputType('sum(measurements.fcp)')).toBe('duration');
    expect(aggregateOutputType('min(measurements.fcp)')).toBe('duration');
    expect(aggregateOutputType('max(measurements.fcp)')).toBe('duration');
    expect(aggregateOutputType('avg(measurements.fcp)')).toBe('duration');
    expect(aggregateOutputType('percentile(measurements.fcp, 0.5)')).toBe('duration');
    expect(aggregateOutputType('sum(measurements.bar)')).toBe('number');
    expect(aggregateOutputType('min(measurements.bar)')).toBe('number');
    expect(aggregateOutputType('max(measurements.bar)')).toBe('number');
    expect(aggregateOutputType('avg(measurements.bar)')).toBe('number');
    expect(aggregateOutputType('percentile(measurements.bar, 0.5)')).toBe('number');
    expect(aggregateOutputType('p50(measurements.bar)')).toBe('number');
    expect(aggregateOutputType('p75(measurements.bar)')).toBe('number');
    expect(aggregateOutputType('p95(measurements.bar)')).toBe('number');
    expect(aggregateOutputType('p99(measurements.bar)')).toBe('number');
    expect(aggregateOutputType('p100(measurements.bar)')).toBe('number');
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
  const organization = OrganizationFixture();
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
    expect(fieldAlignment('event.type')).toBe('left');

    // Should be right, but we don't have any type data.
    expect(fieldAlignment('transaction.duration')).toBe('left');
  });

  it('works with type parameter', function () {
    expect(fieldAlignment('transaction.duration', 'duration')).toBe('right');
    expect(fieldAlignment('device.battery_level', 'number')).toBe('right');
    expect(fieldAlignment('min(timestamp)', 'date')).toBe('left');
  });

  it('can use table metadata', function () {
    const meta: Record<string, ColumnValueType> = {
      'transaction.duration': 'duration',
    };
    expect(fieldAlignment('transaction.duration', 'never', meta)).toBe('right');
    expect(fieldAlignment('transaction.duration', undefined, meta)).toBe('right');

    expect(fieldAlignment('title', undefined, meta)).toBe('left');
  });
});
