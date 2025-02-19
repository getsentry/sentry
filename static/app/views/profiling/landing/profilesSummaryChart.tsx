import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {AreaChartProps} from 'sentry/components/charts/areaChart';
import {AreaChart} from 'sentry/components/charts/areaChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {useProfileEventsStats} from 'sentry/utils/profiling/hooks/useProfileEventsStats';

// We want p99 to be before p75 because echarts renders the series in order.
// So if p75 is before p99, p99 will be rendered on top of p75 which will
// cover it up.
const SERIES_ORDER = ['count()', 'p99()', 'p95()', 'p75()'] as const;

interface ProfileSummaryChartProps {
  query: string;
  referrer: string;
  hideCount?: boolean;
  selection?: PageFilters;
}

export function ProfilesSummaryChart({
  query,
  referrer,
  selection,
  hideCount,
}: ProfileSummaryChartProps) {
  const theme = useTheme();

  const seriesOrder = useMemo(() => {
    if (hideCount) {
      return SERIES_ORDER.filter(s => s !== 'count()');
    }
    return SERIES_ORDER;
  }, [hideCount]);

  const profileStats = useProfileEventsStats({
    dataset: 'profiles',
    query,
    referrer,
    yAxes: seriesOrder,
  });

  const series: Series[] = useMemo(() => {
    if (profileStats.status !== 'success') {
      return [];
    }

    // the timestamps in the response is in seconds but echarts expects
    // a timestamp in milliseconds, so multiply by 1e3 to do the conversion
    const timestamps = profileStats.data.timestamps.map((ts: any) => ts * 1e3);

    const allSeries = profileStats.data.data
      .filter((rawData: any) => seriesOrder.includes(rawData.axis))
      .map((rawData: any) => {
        if (timestamps.length !== rawData.values.length) {
          throw new Error('Invalid stats response');
        }

        if (rawData.axis === 'count()') {
          return {
            // @ts-expect-error TS(7006): Parameter 'value' implicitly has an 'any' type.
            data: rawData.values.map((value, i) => ({
              name: timestamps[i]!,

              // the response value contains nulls when no data is
              // available, use 0 to represent it
              value: value ?? 0,
            })),
            seriesName: rawData.axis,
            xAxisIndex: 0,
            yAxisIndex: 0,
          };
        }

        return {
          // @ts-expect-error TS(7006): Parameter 'value' implicitly has an 'any' type.
          data: rawData.values.map((value, i) => ({
            name: timestamps[i]!,

            // the response value contains nulls when no data
            // is available, use 0 to represent it
            value: value ?? 0,
          })),
          seriesName: rawData.axis,
          xAxisIndex: 1,
          yAxisIndex: 1,
        };
      });

    allSeries.sort((a: any, b: any) => {
      const idxA = seriesOrder.indexOf(a.seriesName);
      const idxB = seriesOrder.indexOf(b.seriesName);

      return idxA - idxB;
    });

    return allSeries;
  }, [profileStats, seriesOrder]);

  const chartProps: AreaChartProps = useMemo(() => {
    const baseProps: AreaChartProps = {
      height: 150,
      series,
      grid: [
        {
          top: '16px',
          left: '16px',
          right: '8px',
          bottom: '16px',
        },
        {
          top: '16px',
          left: '8px',
          right: '16px',
          bottom: '8px',
        },
      ],
      legend: {
        right: 16,
        top: 0,
        data: seriesOrder.slice(),
      },
      tooltip: {
        valueFormatter: (value, label) =>
          tooltipFormatter(value, aggregateOutputType(label)),
      },
      axisPointer: {
        link: [
          {
            xAxisIndex: [0, 1],
          },
        ],
      },
      xAxes: [
        {
          show: !hideCount,
          gridIndex: 0,
          type: 'time' as const,
        },
        {
          gridIndex: 1,
          type: 'time' as const,
        },
      ],
      yAxes: [
        {
          gridIndex: 0,
          scale: true,
          axisLabel: {
            color: theme.chartLabel,
            formatter(value: number) {
              return axisLabelFormatter(value, 'integer');
            },
          },
        },
        {
          gridIndex: 1,
          scale: true,
          axisLabel: {
            color: theme.chartLabel,
            formatter(value: number) {
              return axisLabelFormatter(value, 'duration');
            },
          },
        },
      ],
    };

    return baseProps;
  }, [hideCount, series, seriesOrder, theme.chartLabel]);

  return (
    <ProfilesChartContainer>
      <ProfilesChartTitle>{t('Durations')}</ProfilesChartTitle>
      <ChartZoom {...selection?.datetime}>
        {zoomRenderProps => (
          <AreaChart
            {...chartProps}
            isGroupedByDate
            showTimeInTooltip
            {...zoomRenderProps}
          />
        )}
      </ChartZoom>
    </ProfilesChartContainer>
  );
}

const ProfilesChartTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.textColor};
  font-weight: ${p => p.theme.fontWeightBold};
  padding: ${space(0.25)} ${space(1)};
`;

const ProfilesChartContainer = styled('div')`
  background-color: ${p => p.theme.background};
  border-bottom: 1px solid ${p => p.theme.border};
`;
