import {LocationFixture} from 'sentry-fixture/locationFixture';

import {
  MEPState,
  METRIC_SEARCH_SETTING_PARAM,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {
  DEFAULT_STATS_PERIOD,
  generateGenericPerformanceEventView,
} from 'sentry/views/performance/data';

describe('generateGenericPerformanceEventView()', () => {
  it('generates default values', () => {
    const result = generateGenericPerformanceEventView(
      LocationFixture({query: {}}),
      false
    );

    expect(result.id).toBeUndefined();
    expect(result.name).toBe('Performance');
    expect(result.fields.length).toBeGreaterThanOrEqual(7);
    expect(result.query).toBe('');
    expect(result.getQueryWithAdditionalConditions()).toBe('event.type:transaction');
    expect(result.sorts).toEqual([{kind: 'desc', field: 'tpm'}]);
    expect(result.statsPeriod).toEqual(DEFAULT_STATS_PERIOD);
  });

  it('applies sort from location', () => {
    const result = generateGenericPerformanceEventView(
      LocationFixture({query: {sort: ['-p50', '-count']}}),
      false
    );

    expect(result.sorts).toEqual([{kind: 'desc', field: 'p50'}]);
    expect(result.statsPeriod).toEqual(DEFAULT_STATS_PERIOD);
  });

  it('does not override statsPeriod from location', () => {
    const result = generateGenericPerformanceEventView(
      LocationFixture({query: {statsPeriod: ['90d', '45d']}}),
      false
    );
    expect(result.start).toBeUndefined();
    expect(result.end).toBeUndefined();
    expect(result.statsPeriod).toBe('90d');
  });

  it('does not apply range when start and end are present', () => {
    const result = generateGenericPerformanceEventView(
      LocationFixture({
        query: {start: '2020-04-25T12:00:00', end: '2020-05-25T12:00:00'},
      }),
      false
    );
    expect(result.start).toBe('2020-04-25T12:00:00.000');
    expect(result.end).toBe('2020-05-25T12:00:00.000');
    expect(result.statsPeriod).toBeUndefined();
  });

  it('converts bare query into transaction name wildcard', () => {
    const result = generateGenericPerformanceEventView(
      LocationFixture({query: {query: 'things.update'}}),
      false
    );
    expect(result.query).toEqual(expect.stringContaining('transaction:*things.update*'));
    expect(result.getQueryWithAdditionalConditions()).toEqual(
      expect.stringContaining('event.type:transaction')
    );
  });

  it('bare query overwrites transaction condition', () => {
    const result = generateGenericPerformanceEventView(
      LocationFixture({query: {query: 'things.update transaction:thing.gone'}}),
      false
    );
    expect(result.query).toEqual(expect.stringContaining('transaction:*things.update*'));
    expect(result.getQueryWithAdditionalConditions()).toEqual(
      expect.stringContaining('event.type:transaction')
    );
    expect(result.query).toEqual(expect.not.stringContaining('transaction:thing.gone'));
  });

  it('retains tag filter conditions', () => {
    const result = generateGenericPerformanceEventView(
      LocationFixture({query: {query: 'key:value tag:value'}}),
      false
    );
    expect(result.query).toEqual(expect.stringContaining('key:value'));
    expect(result.query).toEqual(expect.stringContaining('tag:value'));
    expect(result.getQueryWithAdditionalConditions()).toEqual(
      expect.stringContaining('event.type:transaction')
    );
  });

  it('gets the right column', () => {
    const result = generateGenericPerformanceEventView(
      LocationFixture({query: {query: 'key:value tag:value'}}),
      false
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

  it('removes unsupported tokens for limited search', () => {
    const result = generateGenericPerformanceEventView(
      LocationFixture({
        query: {
          query: 'tag:value transaction:*auth*',
          [METRIC_SEARCH_SETTING_PARAM]: MEPState.METRICS_ONLY,
        },
      }),
      true
    );
    expect(result.query).toBe('transaction:*auth*');
  });
});
