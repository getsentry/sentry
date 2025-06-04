import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  MEPState,
  METRIC_SEARCH_SETTING_PARAM,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {
  DEFAULT_STATS_PERIOD,
  generatePerformanceEventView,
} from 'sentry/views/performance/data';

describe('generatePerformanceEventView()', function () {
  const organization = OrganizationFixture();

  it('generates default values', function () {
    const result = generatePerformanceEventView(
      LocationFixture({query: {}}),
      [],
      {},
      organization
    );

    expect(result.id).toBeUndefined();
    expect(result.name).toBe('Performance');
    expect(result.fields.length).toBeGreaterThanOrEqual(7);
    expect(result.query).toBe('');
    expect(result.getQueryWithAdditionalConditions()).toBe('event.type:transaction');
    expect(result.sorts).toEqual([{kind: 'desc', field: 'tpm'}]);
    expect(result.statsPeriod).toEqual(DEFAULT_STATS_PERIOD);
  });

  it('applies sort from location', function () {
    const result = generatePerformanceEventView(
      LocationFixture({query: {sort: ['-p50', '-count']}}),
      [],
      {},
      organization
    );

    expect(result.sorts).toEqual([{kind: 'desc', field: 'p50'}]);
    expect(result.statsPeriod).toEqual(DEFAULT_STATS_PERIOD);
  });

  it('does not override statsPeriod from location', function () {
    const result = generatePerformanceEventView(
      LocationFixture({query: {statsPeriod: ['90d', '45d']}}),
      [],
      {},
      organization
    );
    expect(result.start).toBeUndefined();
    expect(result.end).toBeUndefined();
    expect(result.statsPeriod).toBe('90d');
  });

  it('does not apply range when start and end are present', function () {
    const result = generatePerformanceEventView(
      LocationFixture({
        query: {start: '2020-04-25T12:00:00', end: '2020-05-25T12:00:00'},
      }),
      [],
      {},
      organization
    );
    expect(result.start).toBe('2020-04-25T12:00:00.000');
    expect(result.end).toBe('2020-05-25T12:00:00.000');
    expect(result.statsPeriod).toBeUndefined();
  });

  it('converts bare query into transaction name wildcard', function () {
    const result = generatePerformanceEventView(
      LocationFixture({query: {query: 'things.update'}}),
      [],
      {},
      organization
    );
    expect(result.query).toEqual(expect.stringContaining('transaction:*things.update*'));
    expect(result.getQueryWithAdditionalConditions()).toEqual(
      expect.stringContaining('event.type:transaction')
    );
  });

  it('bare query overwrites transaction condition', function () {
    const result = generatePerformanceEventView(
      LocationFixture({query: {query: 'things.update transaction:thing.gone'}}),
      [],
      {},
      organization
    );
    expect(result.query).toEqual(expect.stringContaining('transaction:*things.update*'));
    expect(result.getQueryWithAdditionalConditions()).toEqual(
      expect.stringContaining('event.type:transaction')
    );
    expect(result.query).toEqual(expect.not.stringContaining('transaction:thing.gone'));
  });

  it('retains tag filter conditions', function () {
    const result = generatePerformanceEventView(
      LocationFixture({query: {query: 'key:value tag:value'}}),
      [],
      {},
      organization
    );
    expect(result.query).toEqual(expect.stringContaining('key:value'));
    expect(result.query).toEqual(expect.stringContaining('tag:value'));
    expect(result.getQueryWithAdditionalConditions()).toEqual(
      expect.stringContaining('event.type:transaction')
    );
  });

  it('gets the right column', function () {
    const result = generatePerformanceEventView(
      LocationFixture({query: {query: 'key:value tag:value'}}),
      [],
      {},
      organization
    );
    expect(result.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({field: 'user_misery()'})])
    );
    expect(result.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({field: 'count_miserable(user)'})])
    );
    expect(result.fields).toEqual(
      expect.arrayContaining([expect.objectContaining({field: 'apdex()'})])
    );
  });

  it('removes unsupported tokens for limited search', function () {
    const result = generatePerformanceEventView(
      LocationFixture({
        query: {
          query: 'tag:value transaction:*auth*',
          [METRIC_SEARCH_SETTING_PARAM]: MEPState.METRICS_ONLY,
        },
      }),
      [],
      {withStaticFilters: true},
      organization
    );
    expect(result.query).toBe('transaction:*auth*');
  });
});
