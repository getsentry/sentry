import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {AreaChart, AreaChartProps} from 'sentry/components/charts/areaChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChartProps} from 'sentry/components/charts/lineChart';
import {HeaderTitle} from 'sentry/components/charts/styles';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {axisLabelFormatter, tooltipFormatter} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {useProfileEventsStats} from 'sentry/utils/profiling/hooks/useProfileEventsStats';
import useRouter from 'sentry/utils/useRouter';

// We want p99 to be before p75 because echarts renders the series in order.
// So if p75 is before p99, p99 will be rendered on top of p75 which will
// cover it up.
const SERIES_ORDER = ['count()', 'p99()', 'p95()', 'p75()'] as const;

interface ProfilesChartProps {
  query: string;
  referrer: string;
  compact?: boolean;
  hideCount?: boolean;
  selection?: PageFilters;
}

export function ProfilesChart({
  query,
  referrer,
  selection,
  hideCount,
  compact = false,
}: ProfilesChartProps) {
  const router = useRouter();
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
    const timestamps = profileStats.data.timestamps.map(ts => ts * 1e3);

    const allSeries = profileStats.data.data
      .filter(rawData => seriesOrder.includes(rawData.axis))
      .map(rawData => {
        if (timestamps.length !== rawData.values.length) {
          throw new Error('Invalid stats response');
        }

        if (rawData.axis === 'count()') {
          return {
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

    allSeries.sort((a, b) => {
      const idxA = seriesOrder.indexOf(a.seriesName as any);
      const idxB = seriesOrder.indexOf(b.seriesName as any);

      return idxA - idxB;
    });

    return allSeries;
  }, [profileStats, seriesOrder]);

  const chartProps: LineChartProps | AreaChartProps = useMemo(() => {
    const baseProps: LineChartProps | AreaChartProps = {
      height: compact ? 150 : 300,
      series,
      grid: [
        {
          top: '32px',
          left: '24px',
          right: '52%',
          bottom: '16px',
        },
        {
          top: '32px',
          left: hideCount ? '24px' : '52%',
          right: '24px',
          bottom: '16px',
        },
      ],
      legend: {
        right: 16,
        top: 12,
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
  }, [compact, hideCount, series, seriesOrder, theme.chartLabel]);

  return (
    <ChartZoom router={router} {...selection?.datetime}>
      {zoomRenderProps => (
        <StyledPanel>
          <TitleContainer>
            {!hideCount && (
              <StyledHeaderTitle compact>{t('Profiles by Count')}</StyledHeaderTitle>
            )}
            <StyledHeaderTitle compact>{t('Profiles Duration')}</StyledHeaderTitle>
          </TitleContainer>
          <AreaChart
            {...chartProps}
            isGroupedByDate
            showTimeInTooltip
            {...zoomRenderProps}
          />
        </StyledPanel>
      )}
    </ChartZoom>
  );
}

const StyledPanel = styled(Panel)`
  padding-top: ${space(2)};
`;

const TitleContainer = styled('div')`
  width: 100%;
  display: flex;
  flex-direction: row;
`;

const StyledHeaderTitle = styled(HeaderTitle)<{compact?: boolean}>`
  flex-grow: 1;
  margin-left: ${space(2)};
  font-size: ${p => (p.compact ? p.theme.fontSizeSmall : undefined)};
`;
