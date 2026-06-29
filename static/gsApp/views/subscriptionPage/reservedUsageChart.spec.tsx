import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';

import {DataCategory} from 'sentry/types/core';
import {ChartDataTransform} from 'sentry/views/organizationStats/usageChart';

import {GIGABYTE} from 'getsentry/constants';
import {type BillingStats} from 'getsentry/types';
import {MILLISECONDS_IN_HOUR} from 'getsentry/utils/billing';

import {
  mapCostStatsToChart,
  mapReservedToChart,
  mapStatsToChart,
} from './reservedUsageChart';

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
        onDemandCostRunningTotal: 0,
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

describe('mapCostStatsToChart', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({
    organization,
    plan: 'am2_business',
  });

  it('should map cost stats to chart data', () => {
    const stats: BillingStats = [
      {
        date: '2019-01-01',
        ts: '',
        accepted: 1,
        filtered: 0,
        total: 1,
        dropped: {total: 0},
        onDemandCostRunningTotal: 100,
        isProjected: false,
      },
      {
        date: '2019-01-02',
        ts: '',
        accepted: 2,
        filtered: 0,
        total: 2,
        dropped: {total: 0},
        onDemandCostRunningTotal: 200,
        isProjected: false,
      },
    ];

    const result = mapCostStatsToChart({
      category: DataCategory.ERRORS,
      stats,
      transform: ChartDataTransform.CUMULATIVE,
      subscription,
    });

    expect(result).toEqual({
      accepted: [],
      dropped: [],
      projected: [],
      onDemand: [
        {
          value: ['Jan 1', 100],
        },
        {
          value: ['Jan 2', 200],
        },
      ],
      reserved: [
        {
          value: ['Jan 1', 0],
        },
        {
          value: ['Jan 2', 0],
        },
      ],
    });
  });

  it('should subtract previous onDemandCostRunningTotal to get periodic', () => {
    const stats: BillingStats = [
      {
        date: '2019-01-01',
        ts: '',
        accepted: 1,
        filtered: 0,
        total: 1,
        dropped: {total: 0},
        onDemandCostRunningTotal: 100,
        isProjected: false,
      },
      {
        date: '2019-01-02',
        ts: '',
        accepted: 2,
        filtered: 0,
        total: 2,
        dropped: {total: 0},
        onDemandCostRunningTotal: 200,
        isProjected: false,
      },
    ];

    const result = mapCostStatsToChart({
      category: DataCategory.ERRORS,
      stats,
      transform: ChartDataTransform.PERIODIC,
      subscription,
    });

    expect(result).toEqual({
      accepted: [],
      dropped: [],
      projected: [],
      onDemand: [
        {
          value: ['Jan 1', 100],
        },
        {
          value: ['Jan 2', 100],
        },
      ],
      reserved: [
        {
          value: ['Jan 1', 0],
        },
        {
          value: ['Jan 2', 0],
        },
      ],
    });
  });

  it('should ignore projected days from periodic onDemandCost', () => {
    const stats: BillingStats = [
      {
        date: '2019-01-01',
        ts: '',
        accepted: 0,
        filtered: 0,
        total: 0,
        dropped: {total: 0},
        onDemandCostRunningTotal: 100,
        isProjected: false,
      },
      {
        date: '2019-01-02',
        ts: '',
        accepted: 2,
        filtered: 0,
        total: 2,
        dropped: {total: 0},
        onDemandCostRunningTotal: 200,
        isProjected: true,
      },
    ];

    const result = mapCostStatsToChart({
      category: DataCategory.ERRORS,
      stats,
      transform: ChartDataTransform.PERIODIC,
      subscription,
    });

    expect(result).toEqual({
      accepted: [],
      dropped: [],
      projected: [],
      onDemand: [
        {
          value: ['Jan 1', 100],
        },
      ],
      reserved: expect.any(Array),
    });
  });

  it('should subtract previous onDemandCostRunningTotal for periodic', () => {
    const stats: BillingStats = [100, 200, 200, 200].map(
      (onDemandCostRunningTotal, i) => ({
        date: `2019-01-0${i + 1}`,
        ts: '',
        accepted: 0,
        filtered: 0,
        total: 0,
        dropped: {total: 0},
        onDemandCostRunningTotal,
        isProjected: false,
      })
    );

    const result = mapCostStatsToChart({
      category: DataCategory.ERRORS,
      stats,
      transform: ChartDataTransform.PERIODIC,
      subscription,
    });

    expect(result.onDemand?.map(item => (item as any).value?.[1])).toEqual([
      100, 100, 0, 0,
    ]);
  });
});
