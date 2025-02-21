import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';

import {ChartDataTransform} from 'sentry/views/organizationStats/usageChart';

import {type BillingStats, PlanTier} from 'getsentry/types';

import {
  getCategoryOptions,
  mapCostStatsToChart,
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
      category: 'errors',
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
      category: 'errors',
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
      category: 'errors',
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
      category: 'errors',
      stats,
      transform: ChartDataTransform.PERIODIC,
      subscription,
    });

    expect(result.onDemand?.map(item => (item as any).value?.[1])).toEqual([
      100, 100, 0, 0,
    ]);
  });
});

describe('getCategoryOptions', () => {
  const organization = OrganizationFixture({access: ['org:billing']});

  it('should return am3 categories', () => {
    const subscription = SubscriptionFixture({
      plan: 'am3_f',
      planTier: PlanTier.AM3,
      organization,
    });

    const result = getCategoryOptions({
      plan: subscription.planDetails,
      hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
    });

    result.forEach(option => {
      expect(subscription.planDetails.checkoutCategories).toContain(option.value);
    });
  });

  it('should return am3 categories with stored spans for custom dynamic sampling', () => {
    const subscription = SubscriptionFixture({
      plan: 'am3_f',
      planTier: PlanTier.AM3,
      organization,
      hadCustomDynamicSampling: true,
    });

    const result = getCategoryOptions({
      plan: subscription.planDetails,
      hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
    });

    result.forEach(option => {
      expect(subscription.planDetails.categories).toContain(option.value);
    });
  });

  it('should return am2 categories', () => {
    const subscription = SubscriptionFixture({
      plan: 'am2_f',
      planTier: PlanTier.AM2,
      organization,
    });

    const result = getCategoryOptions({
      plan: subscription.planDetails,
      hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
    });

    result.forEach(option => {
      expect(subscription.planDetails.categories).toContain(option.value);
    });
  });

  it('should return am1 categories', () => {
    const subscription = SubscriptionFixture({
      plan: 'am1_f',
      planTier: PlanTier.AM1,
      organization,
    });

    const result = getCategoryOptions({
      plan: subscription.planDetails,
      hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
    });

    result.forEach(option => {
      expect(subscription.planDetails.categories).toContain(option.value);
    });
  });

  it('should return mm2 categories', () => {
    const subscription = SubscriptionFixture({
      plan: 'mm2_f',
      planTier: PlanTier.MM2,
      organization,
    });

    const result = getCategoryOptions({
      plan: subscription.planDetails,
      hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
    });

    result.forEach(option => {
      expect(subscription.planDetails.categories).toContain(option.value);
    });
  });
});
