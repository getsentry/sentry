import {DataCategory} from 'sentry/types/core';

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
    {
      by: {
        outcome: 'filtered',
        reason: 'react-hydration-errors',
      },
      totals: {
        'sum(quantity)': 6,
      },
      series: {
        'sum(quantity)': [5, 0, 1],
      },
    },
    {
      by: {
        outcome: 'filtered',
        reason: 'chunk-load-error',
      },
      totals: {
        'sum(quantity)': 2,
      },
      series: {
        'sum(quantity)': [1, 0, 1],
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
      dataCategory: DataCategory.TRANSACTIONS,
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
      {
        parentLabel: 'Filtered',
        label: 'React Hydration Errors',
        data: [
          {name: '2021-01-01T00:00:00Z', value: 5},
          {name: '2021-01-02T00:00:00Z', value: 0},
          {name: '2021-01-03T00:00:00Z', value: 1},
        ],
      },
      {
        parentLabel: 'Filtered',
        label: 'Chunk Load Error',
        data: [
          {name: '2021-01-01T00:00:00Z', value: 1},
          {name: '2021-01-02T00:00:00Z', value: 0},
          {name: '2021-01-03T00:00:00Z', value: 1},
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
      dataCategory: DataCategory.TRANSACTIONS,
      endpointQuery: {},
    });

    // sums up rate limited, abuse, and cardinality limited
    expect(mappedSeries.cardStats.rateLimited).toBe('11');
  });

  it('should correctly format client discard data', function () {
    const mappedSeries = mapSeriesToChart({
      orgStats: {
        start: '2021-01-01T00:00:00Z',
        end: '2021-01-07T00:00:00Z',
        intervals: ['2021-01-01T00:00:00Z', '2021-01-02T00:00:00Z'],
        groups: [
          {
            by: {
              outcome: 'client_discard',
              reason: 'queue_overflow',
              category: 'error',
            },
            totals: {
              'sum(quantity)': 1500,
            },
            series: {
              'sum(quantity)': [750, 750],
            },
          },
        ],
      },
      chartDateInterval: '1h',
      chartDateUtc: true,
      dataCategory: DataCategory.ERRORS,
      endpointQuery: {},
    });

    // should format client discard data correctly
    expect(mappedSeries.cardStats.clientDiscard).toBe('1.5K');
  });

  it('should correctly sum up the profile chunks', function () {
    const mappedSeries = mapSeriesToChart({
      orgStats: {
        start: '2021-01-01T00:00:00Z',
        end: '2021-01-07T00:00:00Z',
        intervals: ['2021-01-01T00:00:00Z', '2021-01-02T00:00:00Z'],
        groups: [
          {
            by: {
              outcome: 'invalid',
              reason: 'bad',
              category: 'profile_chunk',
            },
            totals: {
              'sum(quantity)': 10,
            },
            series: {
              'sum(quantity)': [1, 2],
            },
          },
          {
            by: {
              outcome: 'accepted',
              reason: 'good',
              category: 'profile_chunk',
            },
            totals: {
              'sum(quantity)': 10,
            },
            series: {
              'sum(quantity)': [3, 4],
            },
          },
          {
            by: {
              outcome: 'accepted',
              reason: 'good',
              category: 'profile_duration',
            },
            totals: {
              'sum(quantity)': 10,
            },
            series: {
              'sum(quantity)': [1, 2],
            },
          },
        ],
      },
      chartDateInterval: '1h',
      chartDateUtc: true,
      dataCategory: DataCategory.PROFILE_DURATION,
      endpointQuery: {},
    });

    // multiplies dropped profile chunks by 9000
    expect(mappedSeries.chartStats.invalid).toEqual([
      {value: ['Jan 1 12:00 AM - 1:00 AM (+00:00)', 9000]},
      {value: ['Jan 2 12:00 AM - 1:00 AM (+00:00)', 18000]},
    ]);

    // does not add accepted profile chunks to accepted profile duration
    expect(mappedSeries.chartStats.accepted).toEqual([
      {value: ['Jan 1 12:00 AM - 1:00 AM (+00:00)', 1]},
      {value: ['Jan 2 12:00 AM - 1:00 AM (+00:00)', 2]},
    ]);
  });

  it('should correctly sum up the profiles', function () {
    const groups = [
      {
        by: {
          outcome: 'invalid',
          reason: 'bad',
          category: 'profile',
        },
        totals: {
          'sum(quantity)': 10,
        },
        series: {
          'sum(quantity)': [1, 2],
        },
      },
      {
        by: {
          outcome: 'accepted',
          reason: 'good',
          category: 'profile',
        },
        totals: {
          'sum(quantity)': 10,
        },
        series: {
          'sum(quantity)': [3, 4],
        },
      },
      {
        by: {
          outcome: 'accepted',
          reason: 'good',
          category: 'profile_duration',
        },
        totals: {
          'sum(quantity)': 10,
        },
        series: {
          'sum(quantity)': [1, 2],
        },
      },
    ];

    const mappedSeries = mapSeriesToChart({
      orgStats: {
        start: '2021-01-01T00:00:00Z',
        end: '2021-01-07T00:00:00Z',
        intervals: ['2021-01-01T00:00:00Z', '2021-01-02T00:00:00Z'],
        groups,
      },
      chartDateInterval: '1h',
      chartDateUtc: true,
      dataCategory: DataCategory.PROFILE_DURATION,
      shouldEstimateDroppedProfiles: true,
      endpointQuery: {},
    });

    // multiplies dropped profiles by 9000
    expect(mappedSeries.chartStats.invalid).toEqual([
      {value: ['Jan 1 12:00 AM - 1:00 AM (+00:00)', 9000]},
      {value: ['Jan 2 12:00 AM - 1:00 AM (+00:00)', 18000]},
    ]);

    // does not add accepted profiles to accepted profile duration
    expect(mappedSeries.chartStats.accepted).toEqual([
      {value: ['Jan 1 12:00 AM - 1:00 AM (+00:00)', 1]},
      {value: ['Jan 2 12:00 AM - 1:00 AM (+00:00)', 2]},
    ]);
  });
});
