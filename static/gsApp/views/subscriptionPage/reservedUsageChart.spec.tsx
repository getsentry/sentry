import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  Am3DsEnterpriseSubscriptionFixture,
  SubscriptionFixture,
} from 'getsentry-test/fixtures/subscription';

import {ChartDataTransform} from 'sentry/views/organizationStats/usageChart';

import {type BillingStats, PlanTier} from 'getsentry/types';

import {
  getCategoryOptions,
  mapCostStatsToChart,
  mapReservedBudgetStatsToChart,
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

describe('mapReservedBudgetStatsToChart', () => {
  const organization = OrganizationFixture();
  const subscription = Am3DsEnterpriseSubscriptionFixture({organization});

  it('should map cumulative individual reserved budget stats to chart data', () => {
    const statsByDateAndCategory = {
      '2019-01-01': {
        spans: [
          {
            date: '2019-01-01',
            ts: '',
            accepted: 500,
            filtered: 0,
            total: 500,
            dropped: {total: 0},
            onDemandCostRunningTotal: 0,
            isProjected: false,
          },
        ],
      },
      '2019-01-02': {
        spans: [
          {
            date: '2019-01-02',
            ts: '',
            accepted: 2000,
            filtered: 0,
            total: 2000,
            dropped: {total: 0},
            onDemandCostRunningTotal: 500,
            isProjected: false,
          },
        ],
      },
      '2019-01-03': {
        spans: [
          {
            date: '2019-01-03',
            ts: '',
            accepted: 2000,
            filtered: 0,
            total: 2000,
            dropped: {total: 0},
            onDemandCostRunningTotal: 2500,
            isProjected: false,
          },
        ],
      },
    };
    const reservedBudgetCategoryInfo = {
      spans: {
        freeBudget: 0,
        prepaidBudget: 2000_00,
        reservedCpe: 1_00,
        reservedSpend: 2000_00,
        totalReservedBudget: 2000_00,
      },
    };

    const result = mapReservedBudgetStatsToChart({
      statsByDateAndCategory,
      transform: ChartDataTransform.CUMULATIVE,
      subscription,
      reservedBudgetCategoryInfo,
    });

    expect(result).toEqual({
      accepted: [],
      dropped: [],
      projected: [],
      onDemand: [
        {
          value: ['Jan 1', 0],
        },
        {
          value: ['Jan 2', 500],
        },
        {
          value: ['Jan 3', 2500],
        },
      ],
      reserved: [
        {
          value: ['Jan 1', 500_00],
        },
        {
          value: ['Jan 2', 2000_00],
        },
        {
          value: ['Jan 3', 2000_00],
        },
      ],
    });
  });

  it('should map cumulative combined reserved budget stats to chart data', () => {
    const statsByDateAndCategory = {
      '2019-01-01': {
        spans: [
          {
            date: '2019-01-01',
            ts: '',
            accepted: 500,
            filtered: 0,
            total: 500,
            dropped: {total: 0},
            onDemandCostRunningTotal: 0,
            isProjected: false,
          },
        ],
        spansIndexed: [
          {
            date: '2019-01-01',
            ts: '',
            accepted: 250,
            filtered: 0,
            total: 250,
            dropped: {total: 0},
            onDemandCostRunningTotal: 0,
            isProjected: false,
          },
        ],
      },
      '2019-01-02': {
        spans: [
          {
            date: '2019-01-02',
            ts: '',
            accepted: 1000,
            filtered: 0,
            total: 1000,
            dropped: {total: 0},
            onDemandCostRunningTotal: 1000,
            isProjected: false,
          },
        ],
        spansIndexed: [
          {
            date: '2019-01-02',
            ts: '',
            accepted: 1000,
            filtered: 0,
            total: 1000,
            dropped: {total: 0},
            onDemandCostRunningTotal: 2000,
            isProjected: false,
          },
        ],
      },
      '2019-01-03': {
        spans: [
          {
            date: '2019-01-03',
            ts: '',
            accepted: 2000,
            filtered: 0,
            total: 2000,
            dropped: {total: 0},
            onDemandCostRunningTotal: 2000,
            isProjected: false,
          },
        ],
        spansIndexed: [
          {
            date: '2019-01-03',
            ts: '',
            accepted: 1000,
            filtered: 0,
            total: 1000,
            dropped: {total: 0},
            onDemandCostRunningTotal: 4000,
            isProjected: false,
          },
        ],
      },
    };
    const reservedBudgetCategoryInfo = {
      spans: {
        freeBudget: 0,
        prepaidBudget: 2000_00,
        reservedCpe: 1_00,
        reservedSpend: 1500_00,
        totalReservedBudget: 2000_00,
      },
      spansIndexed: {
        freeBudget: 0,
        prepaidBudget: 2000_00,
        reservedCpe: 2_00,
        reservedSpend: 500_00,
        totalReservedBudget: 2000_00,
      },
    };

    const result = mapReservedBudgetStatsToChart({
      statsByDateAndCategory,
      transform: ChartDataTransform.CUMULATIVE,
      subscription,
      reservedBudgetCategoryInfo,
    });

    expect(result).toEqual({
      accepted: [],
      dropped: [],
      projected: [],
      onDemand: [
        {
          value: ['Jan 1', 0],
        },
        {
          value: ['Jan 2', 3000],
        },
        {
          value: ['Jan 3', 6000],
        },
      ],
      reserved: [
        {
          value: ['Jan 1', 1000_00],
        },
        {
          value: ['Jan 2', 2000_00],
        },
        {
          value: ['Jan 3', 2000_00],
        },
      ],
    });
  });

  it('should map periodic individual reserved budget stats to chart data', () => {
    const statsByDateAndCategory = {
      '2019-01-01': {
        spans: [
          {
            date: '2019-01-01',
            ts: '',
            accepted: 500,
            filtered: 0,
            total: 500,
            dropped: {total: 0},
            onDemandCostRunningTotal: 0,
            isProjected: false,
          },
        ],
      },
      '2019-01-02': {
        spans: [
          {
            date: '2019-01-02',
            ts: '',
            accepted: 1500,
            filtered: 0,
            total: 1500,
            dropped: {total: 0},
            onDemandCostRunningTotal: 0,
            isProjected: false,
          },
        ],
      },
    };
    const reservedBudgetCategoryInfo = {
      spans: {
        freeBudget: 0,
        prepaidBudget: 2000_00,
        reservedCpe: 1_00,
        reservedSpend: 2000_00,
        totalReservedBudget: 2000_00,
      },
    };

    const result = mapReservedBudgetStatsToChart({
      statsByDateAndCategory,
      transform: ChartDataTransform.PERIODIC,
      subscription,
      reservedBudgetCategoryInfo,
    });

    expect(result).toEqual({
      accepted: [],
      dropped: [],
      projected: [],
      onDemand: [
        {
          value: ['Jan 1', 0],
        },
        {
          value: ['Jan 2', 0],
        },
      ],
      reserved: [
        {
          value: ['Jan 1', 500_00],
        },
        {
          value: ['Jan 2', 1500_00],
        },
      ],
    });
  });

  it('should map periodic combined reserved budget stats to chart data', () => {
    const statsByDateAndCategory = {
      '2019-01-01': {
        spans: [
          {
            date: '2019-01-01',
            ts: '',
            accepted: 500,
            filtered: 0,
            total: 500,
            dropped: {total: 0},
            onDemandCostRunningTotal: 0,
            isProjected: false,
          },
        ],
        spansIndexed: [
          {
            date: '2019-01-01',
            ts: '',
            accepted: 250,
            filtered: 0,
            total: 250,
            dropped: {total: 0},
            onDemandCostRunningTotal: 0,
            isProjected: false,
          },
        ],
      },
      '2019-01-02': {
        spans: [
          {
            date: '2019-01-02',
            ts: '',
            accepted: 750,
            filtered: 0,
            total: 750,
            dropped: {total: 0},
            onDemandCostRunningTotal: 0,
            isProjected: false,
          },
        ],
        spansIndexed: [
          {
            date: '2019-01-02',
            ts: '',
            accepted: 125,
            filtered: 0,
            total: 125,
            dropped: {total: 0},
            onDemandCostRunningTotal: 0,
            isProjected: false,
          },
        ],
      },
    };
    const reservedBudgetCategoryInfo = {
      spans: {
        freeBudget: 0,
        prepaidBudget: 2000_00,
        reservedCpe: 1_00,
        reservedSpend: 1250_00,
        totalReservedBudget: 2000_00,
      },
      spansIndexed: {
        freeBudget: 0,
        prepaidBudget: 2000_00,
        reservedCpe: 2_00,
        reservedSpend: 750_00,
        totalReservedBudget: 2000_00,
      },
    };

    const result = mapReservedBudgetStatsToChart({
      statsByDateAndCategory,
      transform: ChartDataTransform.PERIODIC,
      subscription,
      reservedBudgetCategoryInfo,
    });

    expect(result).toEqual({
      accepted: [],
      dropped: [],
      projected: [],
      onDemand: [
        {
          value: ['Jan 1', 0],
        },
        {
          value: ['Jan 2', 0],
        },
      ],
      reserved: [
        {
          value: ['Jan 1', 1000_00],
        },
        {
          value: ['Jan 2', 1000_00],
        },
      ],
    });
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
