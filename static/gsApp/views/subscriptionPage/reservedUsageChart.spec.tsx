import {DataCategory} from 'sentry/types/core';
import {ChartDataTransform} from 'sentry/views/organizationStats/usageChart';

import {GIGABYTE} from 'getsentry/constants';
import {type BillingStats} from 'getsentry/types';
import {MILLISECONDS_IN_HOUR} from 'getsentry/utils/billing';

import {mapReservedToChart, mapStatsToChart} from './reservedUsageChart';

describe('mapStatsToChart', () => {
  it('should map stats to chart data', () => {
    const stats: BillingStats = [
      {
        date: '2019-01-01',
        ts: '',
        accepted: 1,
        filtered: 0,
        total: 1,
        dropped: {total: 0},
        isProjected: false,
      },
    ];

    const result = mapStatsToChart({
      stats,
      transform: ChartDataTransform.CUMULATIVE,
    });

    expect(result).toEqual({
      accepted: [
        {
          value: ['Jan 1', 1],
        },
      ],
      dropped: [
        {
          dropped: {
            other: 0,
            overQuota: 0,
            spikeProtection: 0,
          },
          value: ['Jan 1', 0],
        },
      ],
      projected: [],
      onDemand: [],
      reserved: [],
    });
  });
});

describe('mapReservedToChart', () => {
  it('should apply GIGABYTE multiplier for byte categories', () => {
    const reserved = 5; // 5 GB
    const result = mapReservedToChart(reserved, DataCategory.ATTACHMENTS);
    expect(result).toBe(reserved * GIGABYTE);
  });

  it('should apply MILLISECONDS_IN_HOUR multiplier for duration categories', () => {
    const reserved = 100; // 100 hours
    const result = mapReservedToChart(reserved, DataCategory.PROFILE_DURATION);
    expect(result).toBe(reserved * MILLISECONDS_IN_HOUR);
  });

  it('should apply multiplier of 1 for count categories', () => {
    const reserved = 50000;
    const result = mapReservedToChart(reserved, DataCategory.ERRORS);
    expect(result).toBe(reserved);
  });

  it('should return 0 for unlimited reserved (-1)', () => {
    const result = mapReservedToChart(-1, DataCategory.ERRORS);
    expect(result).toBe(0);
  });

  it('should return 0 for null reserved', () => {
    const result = mapReservedToChart(null, DataCategory.ERRORS);
    expect(result).toBe(0);
  });
});
