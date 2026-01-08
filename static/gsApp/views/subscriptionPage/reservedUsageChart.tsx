import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import moment from 'moment-timezone';

import MarkLine from 'sentry/components/charts/components/markLine';
import {ChartTooltip} from 'sentry/components/charts/components/tooltip';
import barSeries from 'sentry/components/charts/series/barSeries';
import lineSeries from 'sentry/components/charts/series/lineSeries';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import UsageChart, {
  CHART_OPTIONS_DATACATEGORY,
  ChartDataTransform,
  type CategoryOption,
  type ChartStats,
} from 'sentry/views/organizationStats/usageChart';
import {
  getDateFromMoment,
  getTooltipFormatter,
} from 'sentry/views/organizationStats/usageChart/utils';

import {GIGABYTE} from 'getsentry/constants';
import {
  ReservedBudgetCategoryType,
  type BillingMetricHistory,
  type BillingStats,
  type CustomerUsage,
  type Plan,
  type ReservedBudgetForCategory,
  type Subscription,
} from 'getsentry/types';
import {
  displayBudgetName,
  formatReservedWithUnits,
  getPercentage,
  isUnlimitedReserved,
  MILLISECONDS_IN_HOUR,
} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
  isByteCategory,
  isContinuousProfiling,
  isPartOfReservedBudget,
} from 'getsentry/utils/dataCategory';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {getBucket} from 'getsentry/views/amCheckout/utils';
import {
  getOnDemandBudget,
  parseOnDemandBudgetsFromSubscription,
} from 'getsentry/views/spendLimits/utils';
import {
  calculateCategorySpend,
  calculateTotalSpend,
} from 'getsentry/views/subscriptionPage/utils';

const USAGE_CHART_OPTIONS_DATACATEGORY = [
  ...CHART_OPTIONS_DATACATEGORY,
  {
    label: DATA_CATEGORY_INFO.span_indexed.titleName,
    value: DATA_CATEGORY_INFO.span_indexed.plural,
    yAxisMinInterval: 100,
  },
];

export function getCategoryOptions({
  plan,
  hadCustomDynamicSampling,
}: {
  hadCustomDynamicSampling: boolean;
  plan: Plan;
}): CategoryOption[] {
  return USAGE_CHART_OPTIONS_DATACATEGORY.filter(
    opt =>
      (plan.checkoutCategories.includes(opt.value) ||
        plan.onDemandCategories.includes(opt.value)) &&
      (opt.value === DataCategory.SPANS_INDEXED ? hadCustomDynamicSampling : true)
  );
}

/**
 * Calculates usage metrics for a subscription category's prepaid (reserved) events.
 *
 * @param category - The data category to calculate usage for (e.g. 'errors', 'transactions')
 * @param subscription - The subscription object containing plan and usage details
 * @param accepted - The accepted event count for this category
 * @param prepaid - The prepaid/reserved event limit (volume-based reserved) or commited spend (budget-based reserved) for this category
 * @param reservedCpe - The reserved cost-per-event for this category (for reserved budget categories), in cents
 * @param reservedSpend - The reserved spend for this category (for reserved budget categories). If provided, calculations with `totals` and `reservedCpe` are overriden to use the number provided for `prepaidSpend`
 *
 * @returns Object containing:
 *   - onDemandUsage: Number of events that exceeded the prepaid limit and went to on-demand
 *   - prepaidPercentUsed: Percentage of prepaid limit used (0-100)
 *   - prepaidPrice: Monthly cost of the prepaid events (reserved budget if it is a reserved budget category)
 *   - prepaidSpend: Cost of prepaid events used so far this period
 *   - prepaidUsage: Number of events used within prepaid limit
 */
function calculateCategoryPrepaidUsage(
  category: DataCategory,
  subscription: Subscription,
  prepaid: number,
  accepted?: number | null,
  reservedCpe?: number | null,
  reservedSpend?: number | null
): {
  onDemandUsage: number;
  prepaidPercentUsed: number;
  prepaidPrice: number;
  /**
   * Total category spend this period
   */
  prepaidSpend: number;
  prepaidUsage: number;
} {
  const categoryInfo: BillingMetricHistory | undefined =
    subscription.categories[category];
  const usage = accepted ?? categoryInfo?.usage ?? 0;

  // If reservedCpe or reservedSpend aren't provided but category is part of a reserved budget,
  // try to extract them from subscription.reservedBudgets
  let effectiveReservedCpe = reservedCpe ?? undefined;
  let effectiveReservedSpend = reservedSpend ?? undefined;

  if (
    (effectiveReservedCpe === undefined || effectiveReservedSpend === undefined) &&
    isPartOfReservedBudget(category, subscription.reservedBudgets ?? [])
  ) {
    // Look for the category in reservedBudgets
    for (const budget of subscription.reservedBudgets || []) {
      if (category in budget.categories) {
        const categoryBudget = budget.categories[category];
        if (categoryBudget) {
          if (effectiveReservedCpe === undefined) {
            effectiveReservedCpe = categoryBudget.reservedCpe;
          }
          if (effectiveReservedSpend === undefined) {
            effectiveReservedSpend = categoryBudget.reservedSpend;
          }
          break;
        }
      }
    }
  }

  // Calculate the prepaid total
  let prepaidTotal: any;
  if (isUnlimitedReserved(prepaid)) {
    prepaidTotal = prepaid;
  } else {
    // Convert prepaid limits to the appropriate unit based on category
    prepaidTotal =
      prepaid *
      (isByteCategory(category)
        ? GIGABYTE
        : isContinuousProfiling(category)
          ? MILLISECONDS_IN_HOUR
          : 1);
  }

  const hasReservedBudget = Boolean(
    reservedCpe || typeof effectiveReservedSpend === 'number'
  ); // reservedSpend can be 0

  const prepaidUsed = hasReservedBudget
    ? (effectiveReservedSpend ?? usage * (effectiveReservedCpe ?? 0))
    : usage;
  const prepaidPercentUsed = getPercentage(prepaidUsed, prepaidTotal);

  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const slots: EventBucket[] = subscription.planDetails.planCategories[category];

  // If the category billing info is not in the subscription, return 0 for all values
  // This seems to happen sometimes on partner accounts
  if (!categoryInfo || !slots) {
    return {
      prepaidPrice: 0,
      prepaidSpend: 0,
      prepaidPercentUsed: 0,
      onDemandUsage: 0,
      prepaidUsage: 0,
    };
  }

  // Get the price bucket for the reserved event amount
  const prepaidPriceBucket = getBucket({events: categoryInfo.reserved!, buckets: slots});

  // Convert annual prices to monthly if needed
  const isMonthly = subscription.planDetails.billingInterval === 'monthly';
  // This will be 0 when they are using the included amount
  const prepaidPrice = hasReservedBudget
    ? prepaid
    : (prepaidPriceBucket.price ?? 0) / (isMonthly ? 1 : 12);

  // Calculate spend based on percentage used
  const prepaidSpend = (prepaidPercentUsed / 100) * prepaidPrice;

  // Round the usage width to avoid half pixel artifacts
  const prepaidPercentUsedRounded = Math.round(prepaidPercentUsed);

  // Calculate on-demand usage if we've exceeded prepaid limit
  // No on-demand usage for unlimited reserved
  const onDemandUsage =
    (prepaidUsed > prepaidTotal && !isUnlimitedReserved(prepaidTotal)) ||
    (hasReservedBudget && prepaidUsed >= prepaidTotal)
      ? categoryInfo.onDemandQuantity
      : 0;
  const prepaidUsage = usage - onDemandUsage;

  return {
    prepaidPrice,
    prepaidSpend,
    prepaidPercentUsed: prepaidPercentUsedRounded,
    onDemandUsage,
    prepaidUsage,
  };
}

function calculateCategoryOnDemandUsage(
  category: DataCategory,
  subscription: Subscription
): {
  /**
   * The maximum amount of on demand spend allowed for this category
   * This can be shared across all categories or specific to this category.
   * Other categories may have spent some of this budget making less avilable for this category.
   */
  onDemandCategoryMax: number;
  onDemandCategorySpend: number;
  /**
   * Will be the total on demand spend available for all categories if shared
   * or the total available for this category if not shared.
   */
  onDemandTotalAvailable: number;
  ondemandPercentUsed: number;
} {
  const onDemandBudgets = parseOnDemandBudgetsFromSubscription(subscription);
  const isSharedOnDemand = 'sharedMaxBudget' in onDemandBudgets;
  const onDemandTotalAvailable = isSharedOnDemand
    ? onDemandBudgets.sharedMaxBudget
    : getOnDemandBudget(onDemandBudgets, category);
  const {onDemandTotalSpent} = calculateTotalSpend(subscription);
  const {onDemandSpent: onDemandCategorySpend} = calculateCategorySpend(
    subscription,
    category
  );
  const onDemandCategoryMax = isSharedOnDemand
    ? // Subtract other category spend from shared on demand budget
      onDemandTotalAvailable - onDemandTotalSpent + onDemandCategorySpend
    : onDemandTotalAvailable;

  // Round the usage width to avoid half pixel artifacts
  const ondemandPercentUsed = Math.round(
    getPercentage(onDemandCategorySpend, onDemandCategoryMax)
  );

  return {
    onDemandTotalAvailable,
    onDemandCategorySpend,
    onDemandCategoryMax,
    ondemandPercentUsed,
  };
}

type DroppedBreakdown = {
  other: number;
  overQuota: number;
  spikeProtection: number;
};

export function selectedTransform(location: Location) {
  const transform = decodeScalar(location.query.transform) as
    | undefined
    | ChartDataTransform;
  if (!transform || !Object.values(ChartDataTransform).includes(transform)) {
    return ChartDataTransform.CUMULATIVE;
  }
  return transform;
}

function chartTooltip(category: DataCategory, displayMode: 'usage' | 'cost') {
  const tooltipValueFormatter = getTooltipFormatter(category);

  return ChartTooltip({
    // Trigger to axis prevents tooltip from redrawing when hovering
    // over individual bars
    trigger: 'axis',
    // Custom tooltip implementation as we show a breakdown for dropped results.
    formatter(series) {
      const seriesList = Array.isArray(series) ? series : [series];
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      const time = seriesList[0]?.value?.[0];
      return [
        '<div class="tooltip-series">',
        seriesList
          .map(s => {
            const label = s.seriesName ?? '';
            const value =
              displayMode === 'usage'
                ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                  tooltipValueFormatter(s.value?.[1])
                : // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                  formatCurrency(s.value?.[1] ?? 0);

            // @ts-expect-error TS(2339): Property 'dropped' does not exist on type 'OptionD... Remove this comment to see the full error message
            const dropped = s.data.dropped as DroppedBreakdown | undefined;
            if (typeof dropped === 'undefined' || value === '0') {
              return `<div><span class="tooltip-label">${s.marker as string} <strong>${label}</strong></span> ${value}</div>`;
            }
            const other = tooltipValueFormatter(dropped.other);
            const overQuota = tooltipValueFormatter(dropped.overQuota);
            const spikeProtection = tooltipValueFormatter(dropped.spikeProtection);
            // Used to shift breakdown over the same amount as series markers.
            const indent = '<span style="display: inline-block; width: 15px"></span>';
            const labels = [
              `<div><span class="tooltip-label">${s.marker as string} <strong>${t(
                'Dropped'
              )}</strong></span> ${value}</div>`,
              `<div><span class="tooltip-label">${indent} <strong>${t(
                'Over Quota'
              )}</strong></span> ${overQuota}</div>`,
              `<div><span class="tooltip-label">${indent} <strong>${t(
                'Spike Protection'
              )}</strong></span> ${spikeProtection}</div>`,
              `<div><span class="tooltip-label">${indent} <strong>${t(
                'Other'
              )}</strong></span> ${other}</div>`,
            ];
            return labels.join('');
          })
          .join(''),
        '</div>',
        `<div class="tooltip-footer tooltip-footer-centered">${time}</div>`,
        `<div class="tooltip-arrow"></div>`,
      ].join('');
    },
  });
}

export function mapReservedToChart(reserved: number | null, category: DataCategory) {
  if (isUnlimitedReserved(reserved)) {
    return 0;
  }

  const categoryInfo = getCategoryInfoFromPlural(category);
  const multiplier = categoryInfo?.formatting.reservedMultiplier ?? 1;
  return typeof reserved === 'number' ? reserved * multiplier : 0;
}

function defaultChartData(): ChartStats {
  return {
    accepted: [],
    dropped: [],
    projected: [],
    reserved: [],
    onDemand: [],
  };
}

export function mapStatsToChart({
  stats = [],
  transform,
}: {
  stats: BillingStats;
  transform: ChartDataTransform;
}) {
  const isCumulative = transform === ChartDataTransform.CUMULATIVE;

  let sumAccepted = 0;
  let sumDropped = 0;
  let sumOther = 0;
  let sumOverQuota = 0;
  let sumSpikeProtection = 0;
  const chartData = defaultChartData();

  stats.forEach(stat => {
    if (!stat) {
      return;
    }

    const date = getDateFromMoment(moment(stat.date));

    const isProjected = stat.isProjected ?? true;
    const accepted = stat.accepted ?? 0;
    const dropped = stat.dropped.total ?? 0;

    sumDropped = isCumulative ? sumDropped + dropped : dropped;
    sumAccepted = isCumulative ? sumAccepted + accepted : accepted;
    if (stat.dropped.overQuota) {
      sumOverQuota = isCumulative
        ? sumOverQuota + stat.dropped.overQuota
        : stat.dropped.overQuota;
    }
    if (stat.dropped.spikeProtection) {
      sumSpikeProtection = isCumulative
        ? sumSpikeProtection + stat.dropped.spikeProtection
        : stat.dropped.spikeProtection;
    }
    sumOther = Math.max(sumDropped - sumOverQuota - sumSpikeProtection, 0);

    if (isProjected) {
      chartData.projected.push({
        value: [date, sumAccepted],
      });
    } else {
      chartData.accepted.push({
        value: [date, sumAccepted],
      });
      // TODO(ts)
      (chartData.dropped as any[]).push({
        value: [date, sumDropped],
        dropped: {
          other: sumOther,
          overQuota: sumOverQuota,
          spikeProtection: sumSpikeProtection,
        } as DroppedBreakdown,
      });
    }
  });

  return chartData;
}

export function mapCostStatsToChart({
  stats = [],
  transform,
  subscription,
  category,
}: {
  category: DataCategory;
  stats: BillingStats;
  subscription: Subscription;
  transform: ChartDataTransform;
}) {
  const isCumulative = transform === ChartDataTransform.CUMULATIVE;

  /**
   * On demand is already a running total, so we'll need to subtract when not cumulative.
   */
  let previousOnDemandCostRunningTotal = 0;
  let sumReserved = 0;
  const chartData = defaultChartData();
  const metricHistory = subscription.categories[category];

  const prepaid = metricHistory?.prepaid ?? 0;
  stats.forEach(stat => {
    if (!stat) {
      return;
    }

    const date = getDateFromMoment(moment(stat.date));

    const isProjected = stat.isProjected ?? true;
    const accepted = stat.accepted ?? 0;
    let onDemand = 0;

    if (defined(stat.onDemandCostRunningTotal)) {
      onDemand = isCumulative
        ? stat.onDemandCostRunningTotal
        : stat.onDemandCostRunningTotal - previousOnDemandCostRunningTotal;
      previousOnDemandCostRunningTotal = stat.onDemandCostRunningTotal;
    }

    const {prepaidSpend, prepaidPrice} = calculateCategoryPrepaidUsage(
      category,
      subscription,
      prepaid,
      accepted
    );
    sumReserved = isCumulative ? sumReserved + prepaidSpend : prepaidSpend;
    // Ensure that the reserved amount does not exceed the prepaid amount.
    sumReserved = Math.min(sumReserved, prepaidPrice);

    if (!isProjected) {
      chartData.reserved!.push({
        value: [date, sumReserved],
      });
      chartData.onDemand!.push({
        value: [date, onDemand],
      });
    }
  });

  return chartData;
}

export function mapReservedBudgetStatsToChart({
  statsByDateAndCategory = {},
  transform,
  subscription,
  reservedBudgetCategoryInfo,
}: {
  statsByDateAndCategory: Record<string, Record<string, BillingStats>>;
  subscription: Subscription;
  transform: ChartDataTransform;
  reservedBudgetCategoryInfo?: Record<string, ReservedBudgetForCategory>;
}) {
  const isCumulative = transform === ChartDataTransform.CUMULATIVE;

  /**
   * On demand is already a running total, so we'll need to subtract when not cumulative.
   */
  let previousOnDemandCostRunningTotal = 0;
  let sumReserved = 0;
  const chartData = defaultChartData();
  if (!reservedBudgetCategoryInfo) {
    return chartData;
  }

  let previousReservedForDate = 0;
  let previousOnDemandForDate = 0;
  Object.entries(statsByDateAndCategory).forEach(([date, statsByCategory]) => {
    let reservedForDate = 0;
    let onDemandForDate = 0;
    (Object.entries(statsByCategory) as Array<[DataCategory, BillingStats]>).forEach(
      ([category, stats]) => {
        const prepaid = reservedBudgetCategoryInfo[category]?.prepaidBudget ?? 0;
        const reservedCpe = reservedBudgetCategoryInfo[category]?.reservedCpe ?? 0;

        stats.forEach(stat => {
          if (!stat) {
            return;
          }

          const isProjected = stat.isProjected ?? true;
          const accepted = stat.accepted ?? 0;
          let onDemand = 0;

          if (defined(stat.onDemandCostRunningTotal)) {
            onDemand = isCumulative
              ? stat.onDemandCostRunningTotal
              : stat.onDemandCostRunningTotal - previousOnDemandCostRunningTotal;
            previousOnDemandCostRunningTotal = stat.onDemandCostRunningTotal;
          }

          const {prepaidSpend, prepaidPrice} = calculateCategoryPrepaidUsage(
            category,
            subscription,
            prepaid,
            accepted,
            reservedCpe
          );
          sumReserved = isCumulative ? sumReserved + prepaidSpend : prepaidSpend;
          sumReserved = Math.min(sumReserved, prepaidPrice);

          if (!isProjected) {
            // if cumulative, sumReserved is the prepaid amount used so far, otherwise it's the amount used for this date
            if (isCumulative) {
              reservedForDate = sumReserved;
            } else {
              reservedForDate += sumReserved;
            }
            // when cumulative, onDemand is the running total for the category
            // otherwise, onDemand is the amount used for the category for this date
            // either way we need to add them together to get the on-demand/PAYG amount across the categories
            onDemandForDate += onDemand;
          }
        });
      }
    );
    // if cumulative and there was no new spend on this date, use the previous date's spend
    if (
      reservedForDate === 0 &&
      isCumulative &&
      moment(date).isSameOrBefore(moment().toDate())
    ) {
      reservedForDate = previousReservedForDate;
    }
    if (onDemandForDate === 0 && isCumulative) {
      onDemandForDate = previousOnDemandForDate;
    }
    const dateKey = getDateFromMoment(moment(date));
    chartData.reserved!.push({
      value: [dateKey, reservedForDate],
    });
    previousReservedForDate = reservedForDate;
    chartData.onDemand!.push({
      value: [dateKey, onDemandForDate],
    });
    previousOnDemandForDate = onDemandForDate;
  });

  return chartData;
}

export function ProductUsageChart({
  usageStats,
  shouldDisplayBudgetStats,
  reservedBudgetCategoryInfo,
  displayMode,
  subscription,
  category,
  transform,
  footer,
  usagePeriodStart,
  usagePeriodEnd,
  useDisplayModeTitle,
}: {
  category: DataCategory;
  displayMode: 'usage' | 'cost';
  reservedBudgetCategoryInfo: Record<string, ReservedBudgetForCategory>;
  shouldDisplayBudgetStats: boolean;
  subscription: Subscription;
  transform: ChartDataTransform;
  usagePeriodEnd: string;
  usagePeriodStart: string;
  usageStats: CustomerUsage['stats'];
  useDisplayModeTitle: boolean;
  footer?: React.ReactNode;
}) {
  const theme = useTheme();
  const currentHistory: BillingMetricHistory | undefined =
    subscription.categories[category];
  const categoryStats = usageStats[category];

  function chartMetadata() {
    let dataCategoryMetadata: {
      chartData: ChartStats;
      isUnlimitedQuota: boolean;
      yAxisQuotaLine: number;
      yAxisQuotaLineLabel: string;
    } = {
      isUnlimitedQuota: false,
      chartData: {
        accepted: [],
        dropped: [],
        projected: [],
        reserved: [],
        onDemand: [],
      },
      yAxisQuotaLine: 0,
      yAxisQuotaLineLabel: '',
    };

    if (categoryStats) {
      if (shouldDisplayBudgetStats && displayMode === 'cost') {
        const budgetType = reservedBudgetCategoryInfo[category]?.apiName;
        if (
          budgetType !== ReservedBudgetCategoryType.DYNAMIC_SAMPLING ||
          (budgetType === ReservedBudgetCategoryType.DYNAMIC_SAMPLING &&
            subscription.hadCustomDynamicSampling)
        ) {
          const statsByDateAndCategory = categoryStats.reduce(
            (acc, stat) => {
              if (stat) {
                acc[stat.date] = {[category]: [stat]};
              }
              return acc;
            },
            {} as Record<string, Record<string, BillingStats>>
          );
          dataCategoryMetadata.chartData = mapReservedBudgetStatsToChart({
            statsByDateAndCategory,
            transform,
            subscription,
            reservedBudgetCategoryInfo,
          });
        } else {
          const otherCategory =
            category === DataCategory.SPANS
              ? DataCategory.SPANS_INDEXED
              : DataCategory.SPANS;
          const otherCategoryStats = usageStats[otherCategory] ?? [];
          const statsByCategory = {
            [category]: categoryStats,
            [otherCategory]: otherCategoryStats,
          };
          const statsByDateAndCategory = Object.entries(statsByCategory).reduce(
            (acc, [budgetCategory, stats]) => {
              stats.forEach(stat => {
                if (stat) {
                  acc[stat.date] = {...acc[stat.date], [budgetCategory]: [stat]};
                }
              });
              return acc;
            },
            {} as Record<string, Record<string, BillingStats>>
          );
          dataCategoryMetadata.chartData = mapReservedBudgetStatsToChart({
            statsByDateAndCategory,
            transform,
            subscription,
            reservedBudgetCategoryInfo,
          });
        }
      } else if (displayMode === 'cost') {
        dataCategoryMetadata.chartData = mapCostStatsToChart({
          stats: categoryStats,
          transform,
          category,
          subscription,
        });
      } else {
        dataCategoryMetadata.chartData = mapStatsToChart({
          stats: categoryStats,
          transform,
        });
      }
    }

    if (currentHistory) {
      dataCategoryMetadata = {
        ...dataCategoryMetadata,
        isUnlimitedQuota: isUnlimitedReserved(currentHistory.reserved),
        yAxisQuotaLine: mapReservedToChart(currentHistory.reserved, category),
        yAxisQuotaLineLabel: formatReservedWithUnits(currentHistory.reserved, category, {
          isAbbreviated: true,
        }),
      };
      if (displayMode === 'cost') {
        const {prepaidPrice} = calculateCategoryPrepaidUsage(
          category,
          subscription,
          reservedBudgetCategoryInfo[category]?.prepaidBudget ?? currentHistory.prepaid,
          0
        );
        const {onDemandCategoryMax} = calculateCategoryOnDemandUsage(
          category,
          subscription
        );
        dataCategoryMetadata.yAxisQuotaLine = prepaidPrice + onDemandCategoryMax;
      }
    }

    return {
      isCumulative: transform === ChartDataTransform.CUMULATIVE,
      ...dataCategoryMetadata,
    };
  }

  const {isCumulative, isUnlimitedQuota, chartData, yAxisQuotaLine, yAxisQuotaLineLabel} =
    chartMetadata();

  return (
    <UsageChart
      footer={footer}
      dataCategory={category}
      dataTransform={transform}
      handleDataTransformation={s => s}
      usageDateStart={usagePeriodStart}
      usageDateEnd={usagePeriodEnd}
      usageStats={chartData}
      usageDateShowUtc={false}
      chartSeries={[
        ...(displayMode === 'cost' && chartData.reserved
          ? [
              barSeries({
                // Reserved spend
                name: 'Included in Subscription',
                data: chartData.reserved,
                barMinHeight: 1,
                stack: 'usage',
                legendHoverLink: false,
                color: theme.chart.getColorPalette(5)[0],
              }),
              barSeries({
                name: displayBudgetName(subscription.planDetails, {title: true}),
                data: chartData.onDemand,
                barMinHeight: 1,
                stack: 'usage',
                legendHoverLink: false,
                color: theme.chart.getColorPalette(5)[1],
              }),
            ]
          : []),
        lineSeries({
          markLine: MarkLine({
            silent: true,
            lineStyle: {
              color: !isCumulative || isUnlimitedQuota ? 'transparent' : theme.gray300,
              type: 'dashed',
            },
            data: [{yAxis: isCumulative ? yAxisQuotaLine : 0}],
            precision: 1,
            label: {
              show: isCumulative ? true : false,
              position: 'insideStartBottom',
              formatter:
                displayMode === 'usage'
                  ? t(`Plan Quota (%s)`, yAxisQuotaLineLabel)
                  : t('Max Spend'),
              color: theme.tokens.content.muted,
              backgroundColor: theme.tokens.background.primary,
              borderRadius: 2,
              padding: 2,
              fontSize: 10,
            },
          }),
        }),
      ]}
      yAxisFormatter={displayMode === 'usage' ? undefined : formatCurrency}
      chartTooltip={chartTooltip(category, displayMode)}
      title={
        useDisplayModeTitle ? (
          <Title>
            {displayMode === 'usage'
              ? t('Current Usage Period')
              : t(
                  'Estimated %s Spend This Period',
                  getPlanCategoryName({
                    plan: subscription.planDetails,
                    category,
                    hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
                    title: true,
                  })
                )}
          </Title>
        ) : undefined
      }
    />
  );
}

const Title = styled('div')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: normal;
`;
