import type {ReactNode} from 'react';
import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {AreaChart} from 'sentry/components/charts/areaChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import {useProfileEventsStats} from 'sentry/utils/profiling/hooks/useProfileEventsStats';

import {
  ContentContainer,
  HeaderContainer,
  HeaderTitleLegend,
  WidgetContainer,
} from './styles';

interface ProfilesChartWidgetProps {
  chartHeight: number;
  referrer: string;
  header?: ReactNode;
  selection?: PageFilters;
  userQuery?: string;
  widgetHeight?: string;
}

const SERIES_ORDER = ['p99()', 'p95()', 'p75()', 'p50()'] as const;

export function ProfilesChartWidget({
  chartHeight,
  header,
  referrer,
  selection,
  userQuery,
  widgetHeight,
}: ProfilesChartWidgetProps) {
  const theme = useTheme();

  const profileStats = useProfileEventsStats({
    dataset: 'profiles',
    query: userQuery,
    referrer,
    yAxes: SERIES_ORDER,
  });

  const series: Series[] = useMemo(() => {
    if (profileStats.status !== 'success') {
      return [];
    }

    // the timestamps in the response is in seconds but echarts expects
    // a timestamp in milliseconds, so multiply by 1e3 to do the conversion
    const timestamps = profileStats.data.timestamps.map(ts => ts * 1e3);

    return profileStats.data.data
      .map(rawData => {
        if (timestamps.length !== rawData.values.length) {
          throw new Error('Invalid stats response');
        }

        return {
          data: rawData.values.map((value, i) => ({
            name: timestamps[i]!,
            // the response value contains nulls when no data
            // is available, use 0 to represent it
            value: value ?? 0,
          })),
          seriesName: rawData.axis,
        };
      })
      .sort((a, b) => {
        const idxA = SERIES_ORDER.indexOf(a.seriesName as any);
        const idxB = SERIES_ORDER.indexOf(b.seriesName as any);

        return idxA - idxB;
      });
  }, [profileStats]);

  const chartOptions = useMemo(() => {
    return {
      height: chartHeight,
      grid: {
        top: '16px',
        left: '24px',
        right: '24px',
        bottom: '16px',
      },
      xAxis: {
        type: 'time' as const,
      },
      yAxis: {
        scale: true,
        axisLabel: {
          color: theme.chartLabel,
          formatter(value: number) {
            return axisLabelFormatter(value, 'duration');
          },
        },
      },
      tooltip: {
        valueFormatter: value => tooltipFormatter(value, 'duration'),
      },
      legend: {
        right: 16,
        top: 0,
        data: SERIES_ORDER.slice(),
      },
    };
  }, [chartHeight, theme.chartLabel]);

  return (
    <WidgetContainer height={widgetHeight}>
      <HeaderContainer>
        {header ?? (
          <HeaderTitleLegend>{t('Transactions by Percentiles')}</HeaderTitleLegend>
        )}
      </HeaderContainer>
      <ContentContainer>
        <ChartZoom {...selection?.datetime}>
          {zoomRenderProps => (
            <AreaChart
              {...zoomRenderProps}
              {...chartOptions}
              series={series}
              isGroupedByDate
              showTimeInTooltip
            />
          )}
        </ChartZoom>
      </ContentContainer>
    </WidgetContainer>
  );
}
