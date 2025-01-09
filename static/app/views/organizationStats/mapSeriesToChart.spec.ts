import {mapSeriesToChart} from './mapSeriesToChart';
import type {UsageSeries} from './types';

const mockSeries: UsageSeries = {
  start: '2021-01-01T00:00:00Z',
  end: '2021-01-07T00:00:00Z',
  intervals: ['2021-01-01T00:00:00Z', '2021-01-02T00:00:00Z', '2021-01-03T00:00:00Z'],
  groups: [
    {
      by: {
        outcome: 'accepted',
      },
      totals: {
        'sum(quantity)': 6,
      },
      series: {
        'sum(quantity)': [1, 2, 3],
      },
    },
    {
      by: {
        outcome: 'filtered',
        reason: 'other',
      },
      totals: {
        'sum(quantity)': 4,
      },
      series: {
        'sum(quantity)': [0, 1, 3],
      },
    },
    {
      by: {
        outcome: 'invalid',
        reason: 'invalid_transaction',
      },
      totals: {
        'sum(quantity)': 6,
      },
      series: {
        'sum(quantity)': [2, 2, 2],
      },
    },
    {
      by: {
        outcome: 'invalid',
        reason: 'other_reason_a',
      },
      totals: {
        'sum(quantity)': 6,
      },
      series: {
        'sum(quantity)': [1, 2, 3],
      },
    },
    {
      by: {
        outcome: 'invalid',
        reason: 'other_reason_b',
      },
      totals: {
        'sum(quantity)': 3,
      },
      series: {
        'sum(quantity)': [1, 1, 1],
      },
    },
  ],
};

describe('mapSeriesToChart func', function () {
  it("should return correct chart tooltip's reasons", function () {
    const mappedSeries = mapSeriesToChart({
      orgStats: mockSeries,
      chartDateInterval: '1h',
      chartDateUtc: true,
      dataCategory: 'transactions',
      endpointQuery: {},
    });

    expect(mappedSeries.chartSubLabels).toEqual([
      {
        parentLabel: 'Filtered',
        label: 'Other',
        data: [
          {name: '2021-01-01T00:00:00Z', value: 0},
          {name: '2021-01-02T00:00:00Z', value: 1},
          {name: '2021-01-03T00:00:00Z', value: 3},
        ],
      },
      {
        parentLabel: 'Invalid',
        label: 'Invalid Data',
        data: [
          {name: '2021-01-01T00:00:00Z', value: 2},
          {name: '2021-01-02T00:00:00Z', value: 2},
          {name: '2021-01-03T00:00:00Z', value: 2},
        ],
      },
      {
        parentLabel: 'Invalid',
        label: 'Internal',
        data: [
          {name: '2021-01-01T00:00:00Z', value: 2},
          {name: '2021-01-02T00:00:00Z', value: 3},
          {name: '2021-01-03T00:00:00Z', value: 4},
        ],
      },
    ]);
  });

  it('should correctly sum up the rate limited count', function () {
    const mappedSeries = mapSeriesToChart({
      orgStats: {
        start: '2021-01-01T00:00:00Z',
        end: '2021-01-07T00:00:00Z',
        intervals: [
          '2021-01-01T00:00:00Z',
          '2021-01-02T00:00:00Z',
          '2021-01-03T00:00:00Z',
        ],
        groups: [
          {
            by: {
              outcome: 'accepted',
            },
            totals: {
              'sum(quantity)': 99,
            },
            series: {
              'sum(quantity)': [99],
            },
          },
          {
            by: {
              outcome: 'rate_limited',
            },
            totals: {
              'sum(quantity)': 6,
            },
            series: {
              'sum(quantity)': [1, 2, 3],
            },
          },
          {
            by: {
              outcome: 'abuse',
            },
            totals: {
              'sum(quantity)': 2,
            },
            series: {
              'sum(quantity)': [1, 1],
            },
          },
          {
            by: {
              outcome: 'cardinality_limited',
            },
            totals: {
              'sum(quantity)': 3,
            },
            series: {
              'sum(quantity)': [1, 2],
            },
          },
        ],
      },
      chartDateInterval: '1h',
      chartDateUtc: true,
      dataCategory: 'transactions',
      endpointQuery: {},
    });

    // sums up rate limited, abuse, and cardinality limited
    expect(mappedSeries.cardStats.rateLimited).toBe('11');
  });
});
