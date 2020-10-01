import {generatePerformanceEventView} from 'app/views/performance/data';

describe('generatePerformanceEventView()', function () {
  const organization = TestStubs.Organization();

  it('generates default values', function () {
    const result = generatePerformanceEventView(organization, {
      query: {},
    });

    expect(result.id).toBeUndefined();
    expect(result.name).toEqual('Performance');
    expect(result.fields.length).toBeGreaterThanOrEqual(7);
    expect(result.query).toEqual('event.type:transaction');
    expect(result.sorts).toEqual([{kind: 'desc', field: 'epm'}]);
    expect(result.statsPeriod).toEqual('24h');
  });

  it('applies sort from location', function () {
    const result = generatePerformanceEventView(organization, {
      query: {
        sort: ['-p50', '-count'],
      },
    });

    expect(result.sorts).toEqual([{kind: 'desc', field: 'p50'}]);
    expect(result.statsPeriod).toEqual('24h');
  });

  it('does not override statsPeriod from location', function () {
    const result = generatePerformanceEventView(organization, {
      query: {
        statsPeriod: ['90d', '45d'],
      },
    });
    expect(result.start).toBeUndefined();
    expect(result.end).toBeUndefined();
    expect(result.statsPeriod).toEqual('90d');
  });

  it('does not apply range when start and end are present', function () {
    const result = generatePerformanceEventView(organization, {
      query: {
        start: '2020-04-25T12:00:00',
        end: '2020-05-25T12:00:00',
      },
    });
    expect(result.start).toEqual('2020-04-25T12:00:00.000');
    expect(result.end).toEqual('2020-05-25T12:00:00.000');
    expect(result.statsPeriod).toBeUndefined();
  });

  it('converts bare query into transaction name wildcard', function () {
    const result = generatePerformanceEventView(organization, {
      query: {
        query: 'things.update',
      },
    });
    expect(result.query).toEqual(expect.stringContaining('transaction:*things.update*'));
    expect(result.query).toEqual(expect.stringContaining('event.type:transaction'));
  });

  it('bare query overwrites transaction condition', function () {
    const result = generatePerformanceEventView(organization, {
      query: {
        query: 'things.update transaction:thing.gone',
      },
    });
    expect(result.query).toEqual(expect.stringContaining('transaction:*things.update*'));
    expect(result.query).toEqual(expect.stringContaining('event.type:transaction'));
    expect(result.query).toEqual(expect.not.stringContaining('transaction:thing.gone'));
  });

  it('retains tag filter conditions', function () {
    const result = generatePerformanceEventView(organization, {
      query: {
        query: 'key:value tag:value',
      },
    });
    expect(result.query).toEqual(expect.stringContaining('key:value'));
    expect(result.query).toEqual(expect.stringContaining('tag:value'));
    expect(result.query).toEqual(expect.stringContaining('event.type:transaction'));
  });
});
