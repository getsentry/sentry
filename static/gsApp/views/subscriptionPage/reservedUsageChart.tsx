import type {Theme} from '@emotion/react';
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
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {IconCalendar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {browserHistory} from 'sentry/utils/browserHistory';
import {decodeScalar} from 'sentry/utils/queryString';
import {
  type CategoryOption,
  CHART_OPTIONS_DATACATEGORY,
  type ChartStats,
} from 'sentry/views/organizationStats/usageChart';
import UsageChart, {
  CHART_OPTIONS_DATA_TRANSFORM,
  ChartDataTransform,
} from 'sentry/views/organizationStats/usageChart';
import {
  getDateFromMoment,
  getTooltipFormatter,
} from 'sentry/views/organizationStats/usageChart/utils';

import {GIGABYTE} from 'getsentry/constants';
import {
  type BillingMetricHistory,
  type BillingStat,
  type BillingStats,
  type CustomerUsage,
  type Plan,
  PlanTier,
  type Subscription,
} from 'getsentry/types';
import {formatReservedWithUnits, isUnlimitedReserved} from 'getsentry/utils/billing';
import {getPlanCategoryName, hasCategoryFeature} from 'getsentry/utils/dataCategory';
import formatCurrency from 'getsentry/utils/formatCurrency';
import titleCase from 'getsentry/utils/titleCase';
import {
  calculateCategoryOnDemandUsage,
  calculateCategoryPrepaidUsage,
} from 'getsentry/views/subscriptionPage/usageTotals';

const USAGE_CHART_OPTIONS_DATACATEGORY = [
  ...CHART_OPTIONS_DATACATEGORY,
  {
    label: DATA_CATEGORY_INFO.spanIndexed.titleName,
    value: DATA_CATEGORY_INFO.spanIndexed.plural,
    yAxisMinInterval: 100,
  },
];

/** @internal exported for tests only */
export function getCategoryOptions({
  plan,
  hadCustomDynamicSampling,
}: {
  hadCustomDynamicSampling: boolean;
  plan: Plan;
}): CategoryOption[] {
  return USAGE_CHART_OPTIONS_DATACATEGORY.filter(
    opt =>
      plan.categories.includes(opt.value as DataCategory) &&
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
  subscription: Subscription;
  usagePeriodEnd: string;
  usagePeriodStart: string;
  usageStats: CustomerUsage['stats'];
}

function getCategoryColors(theme: Theme) {
  return [
    theme.outcome.accepted!,
    theme.outcome.filtered!,
    theme.outcome.dropped!,
    theme.chartOther!, // Projected
  ];
}

function selectedCategory(location: Location, categoryOptions: CategoryOption[]) {
  const category = decodeScalar(location.query.category) as undefined | DataCategory;

  if (!category || !categoryOptions.some(cat => cat.value === category)) {
    return DataCategory.ERRORS;
  }

  return category;
}

function selectedTransform(location: Location) {
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
              return `<div><span class="tooltip-label">${s.marker} <strong>${label}</strong></span> ${value}</div>`;
            }
            const other = tooltipValueFormatter(dropped.other);
            const overQuota = tooltipValueFormatter(dropped.overQuota);
            const spikeProtection = tooltipValueFormatter(dropped.spikeProtection);
            // Used to shift breakdown over the same amount as series markers.
            const indent = '<span style="display: inline-block; width: 15px"></span>';
            const labels = [
              `<div><span class="tooltip-label">${s.marker} <strong>${t(
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

function mapReservedToChart(reserved: number | null, category: string) {
  if (isUnlimitedReserved(reserved)) {
    return 0;
  }

  if (category === DataCategory.ATTACHMENTS) {
    return typeof reserved === 'number' ? reserved * GIGABYTE : 0;
  }
  return reserved || 0;
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

/** @internal exported for tests only */
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

/** @internal exported for tests only */
export function mapCostStatsToChart({
  stats = [],
  transform,
  subscription,
  category,
}: {
  category: string;
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

  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const prepaid = subscription.categories[category]?.prepaid ?? 0;

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
      {accepted},
      prepaid
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

function ReservedUsageChart({
  location,
  organization,
  subscription,
  usagePeriodStart,
  usagePeriodEnd,
  usageStats,
  displayMode,
}: ReservedUsageChartProps) {
  const theme = useTheme();
  const categoryOptions = getCategoryOptions({
    plan: subscription.planDetails,
    hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
  });
  const category = selectedCategory(location, categoryOptions);
  const transform = selectedTransform(location);

  const currentHistory: BillingMetricHistory | undefined =
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
      if (displayMode === 'cost') {
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
          {accepted: 0},
          currentHistory.prepaid
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

  function handleSelectDataCategory(value: ChartDataTransform) {
    browserHistory.push({
      pathname: location.pathname,
      query: {...location.query, transform: value},
    });
  }

  function handleSelectDataTransform(value: DataCategory) {
    browserHistory.push({
      pathname: location.pathname,
      query: {...location.query, category: value},
    });
  }

  /**
   * Whether the account has access to the data category
   * or tracked usage in the current billing period.
   */
  function hasOrUsedCategory(dataCategory: string) {
    return (
      hasCategoryFeature(dataCategory, subscription, organization) ||
      usageStats[dataCategory]?.some(
        (item: BillingStat) => item.total > 0 && !item.isProjected
      )
    );
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
            onChange={(val: string) => handleSelectDataTransform(val as DataCategory)}
          />
          <OptionSelector
            title={t('Type')}
            selected={transform}
            options={CHART_OPTIONS_DATA_TRANSFORM}
            onChange={(val: string) =>
              handleSelectDataCategory(val as ChartDataTransform)
            }
          />
        </InlineContainer>
      </ChartControls>
    );
  }

  const {isCumulative, isUnlimitedQuota, chartData, yAxisQuotaLine, yAxisQuotaLineLabel} =
    chartMetadata();

  return (
    <UsageChart
      footer={renderFooter()}
      dataCategory={category}
      dataTransform={transform}
      handleDataTransformation={s => s}
      usageDateStart={usagePeriodStart}
      usageDateEnd={usagePeriodEnd}
      usageStats={chartData}
      usageDateShowUtc={false}
      categoryOptions={categoryOptions}
      categoryColors={getCategoryColors(theme)}
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
                color: CHART_PALETTE[5]![0]!,
              }),
              barSeries({
                name:
                  subscription.planTier === PlanTier.AM3 ? 'Pay-as-you-go' : 'On-Demand',
                data: chartData.onDemand,
                barMinHeight: 1,
                stack: 'usage',
                legendHoverLink: false,
                color: CHART_PALETTE[5]![1]!,
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
              color: theme.chartLabel,
              backgroundColor: theme.background,
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
        <Title>
          {displayMode === 'usage'
            ? t('Current Usage Period')
            : t(
                'Estimated %s Spend This Period',
                titleCase(
                  getPlanCategoryName({
                    plan: subscription.planDetails,
                    category,
                    hadCustomDynamicSampling: subscription.hadCustomDynamicSampling,
                  })
                )
              )}
        </Title>
      }
    />
  );
}

export default ReservedUsageChart;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: normal;
`;
