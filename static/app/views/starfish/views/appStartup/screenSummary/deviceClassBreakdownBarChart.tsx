import {BarChart} from 'sentry/components/charts/barChart';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import TransitionChart from 'sentry/components/charts/transitionChart';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {formatVersion} from 'sentry/utils/formatters';
import {LoadingScreen} from 'sentry/views/starfish/components/chart';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';
import {useReleaseSelection} from 'sentry/views/starfish/queries/useReleases';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';

const XAXIS_CATEGORIES = ['high', 'medium', 'low', 'Unknown'];
const CHART_HEIGHT = 70;

interface DeviceClassBreakdownBarChartProps {
  isError: boolean;
  isLoading: boolean;
  title: string;
  yAxis: string;
  data?: Series[];
}

function DeviceClassBreakdownBarChart({
  isLoading,
  isError,
  title,
  data,
  yAxis,
}: DeviceClassBreakdownBarChartProps) {
  const {
    primaryRelease,
    secondaryRelease,
    isLoading: isReleasesLoading,
  } = useReleaseSelection();

  if (isReleasesLoading || isLoading) {
    return <LoadingContainer isLoading />;
  }

  return (
    <MiniChartPanel
      title={title}
      subtitle={
        primaryRelease
          ? t(
              '%s v. %s',
              formatVersionAndCenterTruncate(primaryRelease, 12),
              secondaryRelease ? formatVersionAndCenterTruncate(secondaryRelease, 12) : ''
            )
          : ''
      }
    >
      <TransitionChart
        loading={Boolean(isLoading)}
        reloading={Boolean(isLoading)}
        height={`${CHART_HEIGHT}px`}
      >
        <LoadingScreen loading={Boolean(isLoading)} />
        {isError ? (
          <ErrorPanel height={`${CHART_HEIGHT}px`}>
            <IconWarning color="gray300" size="lg" />
          </ErrorPanel>
        ) : (
          <BarChart
            height={CHART_HEIGHT}
            series={
              data?.map(series => ({
                ...series,
                name: formatVersion(series.seriesName),
              })) ?? []
            }
            grid={{
              left: '0',
              right: '0',
              top: '8px',
              bottom: '0',
              containLabel: true,
            }}
            xAxis={{
              type: 'category',
              axisTick: {show: true},
              data: XAXIS_CATEGORIES,
              truncate: 14,
              axisLabel: {
                interval: 0,
              },
            }}
            yAxis={{
              axisLabel: {
                formatter(value: number) {
                  return axisLabelFormatter(
                    value,
                    aggregateOutputType(yAxis),
                    undefined,
                    getDurationUnit(data ?? [])
                  );
                },
              },
            }}
            tooltip={{
              valueFormatter: (value, _seriesName) => {
                return tooltipFormatter(value, aggregateOutputType(yAxis));
              },
            }}
          />
        )}
      </TransitionChart>
    </MiniChartPanel>
  );
}

export default DeviceClassBreakdownBarChart;
