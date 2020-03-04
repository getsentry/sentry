import {
  generatePerformanceQuery,
  PERFORMANCE_EVENT_VIEW,
} from 'app/views/performance/data';

describe('generatePerformanceQuery()', function() {
  it('generates default values', function() {
    const result = generatePerformanceQuery({});

    expect(result).toEqual({
      ...PERFORMANCE_EVENT_VIEW,

      orderby: '-rpm',
      range: '24h',
    });
  });

  it('override sort', function() {
    const result = generatePerformanceQuery({
      query: {
        sort: ['-avg_transaction_duration', '-count'],
      },
    });

    expect(result).toEqual({
      ...PERFORMANCE_EVENT_VIEW,

      orderby: '-count',
      range: '24h',
    });
  });

  it('does not override statsPeriod', function() {
    const result = generatePerformanceQuery({
      query: {
        statsPeriod: ['90d', '45d'],
      },
    });

    expect(result).toEqual({
      ...PERFORMANCE_EVENT_VIEW,

      orderby: '-rpm',
    });
  });

  it('does not override start & end', function() {
    const result = generatePerformanceQuery({
      query: {
        start: 'start',
        end: 'end',
      },
    });

    expect(result).toEqual({
      ...PERFORMANCE_EVENT_VIEW,

      orderby: '-rpm',
    });
  });
});
