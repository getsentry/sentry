import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import moment from 'moment-timezone';

import MarkLine from 'sentry/components/charts/components/markLine';
import {ChartTooltip} from 'sentry/components/charts/components/tooltip';
import OptionSelector from 'sentry/components/charts/optionSelector';
import barSeries from 'sentry/components/charts/series/barSeries';
import lineSeries from 'sentry/components/charts/series/lineSeries';
import {
  ChartControls,
  InlineContainer,
  SectionValue,
} from 'sentry/components/charts/styles';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {IconCalendar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {decodeScalar} from 'sentry/utils/queryString';
import {useNavigate} from 'sentry/utils/useNavigate';
import UsageChart, {
  CHART_OPTIONS_DATA_TRANSFORM,
  CHART_OPTIONS_DATACATEGORY,
  ChartDataTransform,
  type CategoryOption,
  type ChartStats,
} from 'sentry/views/organizationStats/usageChart';
import {
  getDateFromMoment,
  getTooltipFormatter,
} from 'sentry/views/organizationStats/usageChart/utils';

import {
  ReservedBudgetCategoryType,
  type BillingMetricHistory,
  type BillingStat,
  type BillingStats,
  type CustomerUsage,
  type Plan,
  type ReservedBudgetForCategory,
  type Subscription,
} from 'getsentry/types';
import {
  displayBudgetName,
  formatReservedWithUnits,
  isUnlimitedReserved,
} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
  hasCategoryFeature,
  isPartOfReservedBudget,
} from 'getsentry/utils/dataCategory';
import formatCurrency from 'getsentry/utils/formatCurrency';
import {
  calculateCategoryOnDemandUsage,
  calculateCategoryPrepaidUsage,
} from 'getsentry/views/subscriptionPage/usageTotals';

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

type DroppedBreakdown = {
  other: number;
  overQuota: number;
  spikeProtection: number;
};

interface ReservedUsageChartProps {
  displayMode: 'usage' | 'cost';
  location: Location;
  organization: Organization;
  reservedBudgetCategoryInfo: Record<string, ReservedBudgetForCategory>;
  subscription: Subscription;
  usagePeriodEnd: string;
  usagePeriodStart: string;
  usageStats: CustomerUsage['stats'];
}

function selectedCategory(location: Location, categoryOptions: CategoryOption[]) {
  const category = decodeScalar(location.query.category) as undefined | DataCategory;

  if (!category || !categoryOptions.some(cat => cat.value === category)) {
    return DataCategory.ERRORS;
  }

  return category;
}

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

function ReservedUsageChart({
  location,
  organization,
  subscription,
  usagePeriodStart,
  usagePeriodEnd,
  usageStats,
  displayMode,
  reservedBudgetCategoryInfo,
}: ReservedUsageChartProps) {
  const categoryOptions = getCategoryOptions({
    plan: subscription.planDetails,
    hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
  });
  const navigate = useNavigate();
  const category = selectedCategory(location, categoryOptions);
  const transform = selectedTransform(location);

  const shouldDisplayBudgetStats = isPartOfReservedBudget(
    category,
    subscription.reservedBudgets ?? []
  );

  // For sales-led customers (canSelfServe: false), force cost view for reserved budget categories
  // since they don't have access to the usage/cost toggle
  if (shouldDisplayBudgetStats && !subscription.canSelfServe) {
    displayMode = 'cost';
  }

  function handleSelectDataCategory(value: DataCategory) {
    navigate({
      pathname: location.pathname,
      query: {...location.query, category: value},
    });
  }

  function handleSelectDataTransform(value: ChartDataTransform) {
    navigate({
      pathname: location.pathname,
      query: {...location.query, transform: value},
    });
  }

  function renderFooter() {
    const {planDetails} = subscription;
    const displayOptions = getCategoryOptions({
      plan: planDetails,
      hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
    }).reduce((acc, option) => {
      if (hasOrUsedCategory(option.value)) {
        if (
          option.value === DataCategory.SPANS &&
          subscription.hadCustomDynamicSampling
        ) {
          option.label = t('Accepted Spans');
        }
        acc.push(option);
        // Display upsell if the category is available
      } else if (planDetails.availableCategories?.includes(option.value)) {
        acc.push({
          ...option,
          tooltip: t(
            'Your plan does not include %s. Migrate to our latest plans to access new features.',
            option.value
          ),
          disabled: true,
        });
      }
      return acc;
    }, [] as CategoryOption[]);

    return (
      <ChartControls>
        <InlineContainer>
          <SectionValue>
            <IconCalendar />
          </SectionValue>
          <SectionValue>
            {moment(usagePeriodStart).format('ll')}
            {' — '}
            {moment(usagePeriodEnd).format('ll')}
          </SectionValue>
        </InlineContainer>
        <InlineContainer>
          <OptionSelector
            title={t('Display')}
            selected={category}
            options={displayOptions}
            onChange={(val: string) => handleSelectDataCategory(val as DataCategory)}
          />
          <OptionSelector
            title={t('Type')}
            selected={transform}
            options={CHART_OPTIONS_DATA_TRANSFORM}
            onChange={(val: string) =>
              handleSelectDataTransform(val as ChartDataTransform)
            }
          />
        </InlineContainer>
      </ChartControls>
    );
  }

  /**
   * Whether the account has access to the data category
   * or tracked usage in the current billing period.
   */
  function hasOrUsedCategory(dataCategory: DataCategory) {
    return (
      hasCategoryFeature(dataCategory, subscription, organization) ||
      usageStats[dataCategory]?.some(
        (item: BillingStat) => item.total > 0 && !item.isProjected
      )
    );
  }

  return (
    <ProductUsageChart
      useDisplayModeTitle
      footer={renderFooter()}
      usageStats={usageStats}
      shouldDisplayBudgetStats={shouldDisplayBudgetStats}
      reservedBudgetCategoryInfo={reservedBudgetCategoryInfo}
      displayMode={displayMode}
      subscription={subscription}
      category={category}
      transform={transform}
      usagePeriodStart={usagePeriodStart}
      usagePeriodEnd={usagePeriodEnd}
    />
  );
}

export default ReservedUsageChart;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: normal;
`;
