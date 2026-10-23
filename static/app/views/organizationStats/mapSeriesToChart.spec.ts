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

describe('mapSeriesToChart func', () => {
  it("should return correct chart tooltip's reasons", () => {
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

  it('should correctly sum up the rate limited count', () => {
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

  it('excludes no_parent_span from client discard data', () => {
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
          {
            by: {
              outcome: 'client_discard',
              reason: 'no_parent_span',
              category: 'span',
            },
            totals: {
              'sum(quantity)': 1000,
            },
            series: {
              'sum(quantity)': [400, 600],
            },
          },
        ],
      },
      chartDateInterval: '1h',
      chartDateUtc: true,
      dataCategory: DataCategory.ERRORS,
      endpointQuery: {},
    });

    expect(mappedSeries.cardStats.clientDiscard).toBe('1.5K');
    expect(mappedSeries.chartStats.clientDiscard).toEqual([
      {value: [expect.any(String), 750]},
      {value: [expect.any(String), 750]},
    ]);
    expect(mappedSeries.chartSubLabels).toEqual([
      {
        parentLabel: 'Client Discard',
        label: 'Queue Overflow',
        data: [
          {name: '2021-01-01T00:00:00Z', value: 750},
          {name: '2021-01-02T00:00:00Z', value: 750},
        ],
      },
    ]);
  });

  describe('client discards for byte categories', () => {
    const intervals = ['2021-01-01T00:00:00Z', '2021-01-02T00:00:00Z'];
    const acceptedBytes = {
      by: {outcome: 'accepted', category: 'log_byte'},
      totals: {'sum(quantity)': 3000},
      series: {'sum(quantity)': [1000, 2000]},
    };
    const acceptedCount = {
      by: {outcome: 'accepted', category: 'log_item'},
      totals: {'sum(quantity)': 30},
      series: {'sum(quantity)': [10, 20]},
    };
    const clientDiscardCount = {
      by: {outcome: 'client_discard', reason: 'queue_overflow', category: 'log_item'},
      totals: {'sum(quantity)': 1_500_000},
      series: {'sum(quantity)': [500_000, 1_000_000]},
    };

    it('charts client discards in bytes and lists counts in the tooltip', () => {
      const mappedSeries = mapSeriesToChart({
        orgStats: {
          start: intervals[0]!,
          end: intervals[1]!,
          intervals,
          groups: [
            acceptedBytes,
            acceptedCount,
            clientDiscardCount,
            {
              by: {
                outcome: 'client_discard',
                reason: 'queue_overflow',
                category: 'log_byte',
              },
              totals: {'sum(quantity)': 500},
              series: {'sum(quantity)': [200, 300]},
            },
          ],
        },
        chartDateInterval: '1d',
        chartDateUtc: true,
        dataCategory: DataCategory.LOG_BYTE,
        endpointQuery: {},
      });

      expect(mappedSeries.clientDiscardCountCategory).toBeUndefined();
      expect(mappedSeries.cardStats.accepted).toBe('3 kB');
      expect(mappedSeries.cardStats.clientDiscard).toBe('500 B');
      expect(mappedSeries.chartStats.clientDiscard).toEqual([
        {value: [expect.any(String), 200]},
        {value: [expect.any(String), 300]},
      ]);
      expect(mappedSeries.chartSubLabels).toEqual([
        {
          parentLabel: 'Client Discard',
          label: 'Queue Overflow',
          data: [
            {name: intervals[0], value: 200},
            {name: intervals[1], value: 300},
          ],
        },
        {
          parentLabel: 'Client Discard',
          label: 'Queue Overflow (Count)',
          data: [
            {name: intervals[0], value: 500_000},
            {name: intervals[1], value: 1_000_000},
          ],
          excludeFromTotal: true,
          valueFormatter: expect.any(Function),
        },
      ]);
    });

    it('charts client discards in counts if there are none in bytes', () => {
      const mappedSeries = mapSeriesToChart({
        orgStats: {
          start: intervals[0]!,
          end: intervals[1]!,
          intervals,
          groups: [acceptedBytes, acceptedCount, clientDiscardCount],
        },
        chartDateInterval: '1d',
        chartDateUtc: true,
        dataCategory: DataCategory.LOG_BYTE,
        endpointQuery: {},
      });

      expect(mappedSeries.clientDiscardCountCategory).toBe(DataCategory.LOG_ITEM);
      expect(mappedSeries.cardStats.accepted).toBe('3 kB');
      expect(mappedSeries.cardStats.clientDiscard).toBe('1.5M logs');
      expect(mappedSeries.chartStats.clientDiscard).toEqual([
        {value: [expect.any(String), 500_000]},
        {value: [expect.any(String), 1_000_000]},
      ]);
      expect(mappedSeries.chartSubLabels).toEqual([
        expect.objectContaining({
          parentLabel: 'Client Discard',
          label: 'Queue Overflow (Count)',
          excludeFromTotal: true,
        }),
      ]);
    });
  });
});
