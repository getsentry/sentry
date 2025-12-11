import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  Am3DsEnterpriseSubscriptionFixture,
  SubscriptionFixture,
  SubscriptionWithLegacySeerFixture,
} from 'getsentry-test/fixtures/subscription';
import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';
import {ChartDataTransform} from 'sentry/views/organizationStats/usageChart';

import {GIGABYTE} from 'getsentry/constants';
import {PlanTier, type BillingStats} from 'getsentry/types';
import {MILLISECONDS_IN_HOUR} from 'getsentry/utils/billing';

import ReservedUsageChart, {
  getCategoryOptions,
  mapCostStatsToChart,
  mapReservedBudgetStatsToChart,
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
        apiName: 'dynamicSampling',
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
          value: ['Jan 1', 2000_00],
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
        apiName: 'dynamicSampling',
      },
      spansIndexed: {
        freeBudget: 0,
        prepaidBudget: 2000_00,
        reservedCpe: 2_00,
        reservedSpend: 500_00,
        totalReservedBudget: 2000_00,
        apiName: 'dynamicSampling',
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
          value: ['Jan 1', 2000_00],
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
        apiName: 'dynamicSampling',
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
          value: ['Jan 1', 2000_00],
        },
        {
          value: ['Jan 2', 2000_00],
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
        apiName: 'dynamicSampling',
      },
      spansIndexed: {
        freeBudget: 0,
        prepaidBudget: 2000_00,
        reservedCpe: 2_00,
        reservedSpend: 750_00,
        totalReservedBudget: 2000_00,
        apiName: 'dynamicSampling',
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
          value: ['Jan 1', 4000_00],
        },
        {
          value: ['Jan 2', 4000_00],
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
      const inCheckoutCategories = subscription.planDetails.checkoutCategories.includes(
        option.value
      );
      const inOnDemandCategories = subscription.planDetails.onDemandCategories.includes(
        option.value
      );
      expect(inCheckoutCategories || inOnDemandCategories).toBe(true);
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

describe('DisplayMode Toggle for Reserved Budget Categories', () => {
  const organization = OrganizationFixture({access: ['org:billing']});

  // Helper function to extract reservedBudgetCategoryInfo from subscription
  function getReservedBudgetCategoryInfo(subscription: any) {
    const info: Record<string, any> = {};
    subscription.reservedBudgets?.forEach((budget: any) => {
      Object.entries(budget.categories || {}).forEach(
        ([category, categoryData]: [string, any]) => {
          info[category] = {
            freeBudget: budget.freeBudget || 0,
            prepaidBudget: budget.reservedBudget || 0,
            reservedCpe: categoryData.reservedCpe || 0,
            reservedSpend: categoryData.reservedSpend || 0,
            totalReservedBudget: budget.reservedBudget || 0,
            apiName: budget.apiName || 'seer',
          };
        }
      );
    });
    return info;
  }

  it('should respect displayMode="usage" for SEER reserved budget categories', async () => {
    const subscription = SubscriptionWithLegacySeerFixture({
      organization,
      plan: 'am3_business',
    });

    const usageStats = {
      seerAutofix: [
        {
          date: '2019-01-01',
          ts: '',
          accepted: 5,
          filtered: 0,
          total: 5,
          dropped: {total: 0},
          onDemandCostRunningTotal: 0,
          isProjected: false,
        },
        {
          date: '2019-01-02',
          ts: '',
          accepted: 5,
          filtered: 0,
          total: 5,
          dropped: {total: 0},
          onDemandCostRunningTotal: 0,
          isProjected: false,
        },
      ],
    };

    const reservedBudgetCategoryInfo = getReservedBudgetCategoryInfo(subscription);

    const location = {
      pathname: '/billing',
      query: {
        category: DataCategory.SEER_AUTOFIX,
        displayMode: 'usage', // This should be respected, not overridden
      },
      search: '',
      hash: '',
      state: null,
      key: '',
      action: 'PUSH' as const,
    };

    const mockProps = {
      location,
      organization,
      subscription,
      usagePeriodStart: '2019-01-01',
      usagePeriodEnd: '2019-01-31',
      usageStats,
      displayMode: 'usage' as const,
      reservedBudgetCategoryInfo,
    };

    act(() => {
      render(<ReservedUsageChart {...mockProps} />);
    });

    // When displayMode is 'usage' for reserved budget categories,
    // it should show "Current Usage Period" title (usage mode)
    await screen.findByText('Current Usage Period');
    expect(screen.queryByText(/Estimated.*Spend This Period/)).not.toBeInTheDocument();
  });

  it('should respect displayMode="cost" for SEER reserved budget categories', async () => {
    const subscription = SubscriptionWithLegacySeerFixture({
      organization,
      plan: 'am3_business',
    });

    const usageStats = {
      seerAutofix: [
        {
          date: '2019-01-01',
          ts: '',
          accepted: 5,
          filtered: 0,
          total: 5,
          dropped: {total: 0},
          onDemandCostRunningTotal: 0,
          isProjected: false,
        },
        {
          date: '2019-01-02',
          ts: '',
          accepted: 5,
          filtered: 0,
          total: 5,
          dropped: {total: 0},
          onDemandCostRunningTotal: 0,
          isProjected: false,
        },
      ],
    };

    const reservedBudgetCategoryInfo = getReservedBudgetCategoryInfo(subscription);

    const location = {
      pathname: '/billing',
      query: {
        category: DataCategory.SEER_AUTOFIX,
        displayMode: 'cost', // This should be respected
      },
      search: '',
      hash: '',
      state: null,
      key: '',
      action: 'PUSH' as const,
    };

    const mockProps = {
      location,
      organization,
      subscription,
      usagePeriodStart: '2019-01-01',
      usagePeriodEnd: '2019-01-31',
      usageStats,
      displayMode: 'cost' as const,
      reservedBudgetCategoryInfo,
    };

    act(() => {
      render(<ReservedUsageChart {...mockProps} />);
    });

    // When displayMode is 'cost' for reserved budget categories,
    // it should show "Estimated ... Spend This Period" title (cost mode)
    await screen.findByText(/Estimated.*Spend This Period/);
    expect(screen.queryByText('Current Usage Period')).not.toBeInTheDocument();
  });

  it('should force displayMode="cost" for sales-led customers with reserved budget categories', async () => {
    const subscription = SubscriptionWithLegacySeerFixture({
      organization,
      plan: 'am3_business',
      canSelfServe: false, // Sales-led customer
    });

    const usageStats = {
      seerAutofix: [
        {
          date: '2019-01-01',
          ts: '',
          accepted: 5,
          filtered: 0,
          total: 5,
          dropped: {total: 0},
          onDemandCostRunningTotal: 0,
          isProjected: false,
        },
      ],
    };

    const reservedBudgetCategoryInfo = getReservedBudgetCategoryInfo(subscription);

    const location = {
      pathname: '/billing',
      query: {
        category: DataCategory.SEER_AUTOFIX,
        displayMode: 'usage', // Try to set usage mode
      },
      search: '',
      hash: '',
      state: null,
      key: '',
      action: 'PUSH' as const,
    };

    const mockProps = {
      location,
      organization,
      subscription,
      usagePeriodStart: '2019-01-01',
      usagePeriodEnd: '2019-01-31',
      usageStats,
      displayMode: 'usage' as const, // Try to set usage mode
      reservedBudgetCategoryInfo,
    };

    act(() => {
      render(<ReservedUsageChart {...mockProps} />);
    });

    // Sales-led customers should be forced to cost view, regardless of displayMode prop
    await screen.findByText(/Estimated.*Spend This Period/);
    expect(screen.queryByText('Current Usage Period')).not.toBeInTheDocument();
  });
});
