import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import moment from 'moment-timezone';

import {markLine} from 'sentry/components/charts/components/markLine';
import {ChartTooltip} from 'sentry/components/charts/components/tooltip';
import {createLineSeries} from 'sentry/components/charts/series/lineSeries';
import {t} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {decodeScalar} from 'sentry/utils/queryString';
import {
  ChartDataTransform,
  UsageChart,
  type ChartStats,
} from 'sentry/views/organizationStats/usageChart';
import {
  getDateFromMoment,
  getTooltipFormatter,
} from 'sentry/views/organizationStats/usageChart/utils';

import {type BillingStats, type CustomerUsage, type Subscription} from 'getsentry/types';
import {formatReservedWithUnits, isUnlimitedReserved} from 'getsentry/utils/billing';
import {getCategoryInfoFromPlural} from 'getsentry/utils/dataCategory';

type DroppedBreakdown = {other: number; overQuota: number; spikeProtection: number};

export function selectedTransform(location: Location) {
  const transform = decodeScalar(location.query.transform) as
    | undefined
    | ChartDataTransform;
  if (!transform || !Object.values(ChartDataTransform).includes(transform)) {
    return ChartDataTransform.CUMULATIVE;
  }
  return transform;
}

function chartTooltip(category: DataCategory) {
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
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            const value = tooltipValueFormatter(s.value?.[1]);

            // @ts-expect-error TS(2339): Property 'dropped' does not exist on type 'OptionD... Remove this comment to see the full error message
            const dropped = s.data.dropped as DroppedBreakdown | undefined;
            if (dropped === undefined || value === '0') {
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
        '<div class="tooltip-arrow"></div>',
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
  return {accepted: [], dropped: [], projected: [], reserved: [], onDemand: []};
}

export function mapStatsToChart({
  stats,
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
      chartData.projected.push({value: [date, sumAccepted]});
    } else {
      chartData.accepted.push({value: [date, sumAccepted]});
      // TODO(ts)
      (chartData.dropped as any[]).push({
        value: [date, sumDropped],
        dropped: {
          other: sumOther,
          overQuota: sumOverQuota,
          spikeProtection: sumSpikeProtection,
        },
      });
    }
  });

  return chartData;
}

export function ProductUsageChart({
  usageStats,
  subscription,
  category,
  transform,
  footer,
  usagePeriodStart,
  usagePeriodEnd,
  useDisplayModeTitle,
}: {
  category: DataCategory;
  subscription: Subscription;
  transform: ChartDataTransform;
  usagePeriodEnd: string;
  usagePeriodStart: string;
  usageStats: CustomerUsage['stats'];
  useDisplayModeTitle: boolean;
  footer?: React.ReactNode;
}) {
  const theme = useTheme();
  const currentHistory = subscription.categories[category];
  const categoryStats = usageStats[category];

  function chartMetadata() {
    let dataCategoryMetadata: {
      chartData: ChartStats;
      isUnlimitedQuota: boolean;
      yAxisQuotaLine: number;
      yAxisQuotaLineLabel: string;
    } = {
      isUnlimitedQuota: false,
      chartData: {accepted: [], dropped: [], projected: [], reserved: [], onDemand: []},
      yAxisQuotaLine: 0,
      yAxisQuotaLineLabel: '',
    };

    if (categoryStats) {
      dataCategoryMetadata.chartData = mapStatsToChart({stats: categoryStats, transform});
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
        createLineSeries({
          markLine: markLine({
            silent: true,
            lineStyle: {
              color:
                !isCumulative || isUnlimitedQuota ? 'transparent' : theme.colors.gray400,
              type: 'dashed',
            },
            data: [{yAxis: isCumulative ? yAxisQuotaLine : 0}],
            precision: 1,
            label: {
              show: isCumulative ? true : false,
              position: 'insideStartBottom',
              formatter: t('Plan Quota (%s)', yAxisQuotaLineLabel),
              color: theme.tokens.content.secondary,
              backgroundColor: theme.tokens.background.primary,
              borderRadius: 2,
              padding: 2,
              fontSize: 10,
            },
          }),
        }),
      ]}
      chartTooltip={chartTooltip(category)}
      title={useDisplayModeTitle ? <Title>{t('Current Usage Period')}</Title> : undefined}
    />
  );
}

const Title = styled('div')`
  font-size: ${p => p.theme.font.size.xl};
  font-weight: normal;
`;
