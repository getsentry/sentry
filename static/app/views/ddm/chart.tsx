import {useEffect, useRef} from 'react';
import {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {AreaChart} from 'sentry/components/charts/areaChart';
import {BarChart} from 'sentry/components/charts/barChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import Legend from 'sentry/components/charts/components/legend';
import {LineChart} from 'sentry/components/charts/lineChart';
import ReleaseSeries from 'sentry/components/charts/releaseSeries';
import {RELEASE_LINES_THRESHOLD} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {DateString, PageFilters} from 'sentry/types';
import {ReactEchartsRef} from 'sentry/types/echarts';
import {
  formatMetricsUsingUnitAndOp,
  getNameFromMRI,
  MetricDisplayType,
} from 'sentry/utils/metrics';
import theme from 'sentry/utils/theme';
import useRouter from 'sentry/utils/useRouter';
import {DDM_CHART_GROUP} from 'sentry/views/ddm/constants';

import {getFormatter} from '../../components/charts/components/tooltip';

import {Series} from './widget';

type ChartProps = {
  displayType: MetricDisplayType;
  environments: PageFilters['environments'];
  projects: PageFilters['projects'];
  series: Series[];
  end?: string;
  onZoom?: (start: DateString, end: DateString) => void;
  operation?: string;
  period?: string;
  start?: string;
  utc?: boolean;
};

export function MetricChart({
  series,
  displayType,
  start,
  end,
  period,
  utc,
  operation,
  projects,
  environments,
  onZoom,
}: ChartProps) {
  const chartRef = useRef<ReactEchartsRef>(null);
  const router = useRouter();

  // TODO(ddm): Try to do this in a more elegant way
  useEffect(() => {
    const echartsInstance = chartRef?.current?.getEchartsInstance();
    if (echartsInstance && !echartsInstance.group) {
      echartsInstance.group = DDM_CHART_GROUP;
    }
  });

  const unit = series[0]?.unit;
  const seriesToShow = series.filter(s => !s.hidden);

  // TODO(ddm): This assumes that all series have the same bucket size
  const bucketSize = seriesToShow[0]?.data[1]?.name - seriesToShow[0]?.data[0]?.name;
  const isSubMinuteBucket = bucketSize < 60_000;
  const seriesLength = seriesToShow[0]?.data.length;

  const formatters = {
    valueFormatter: (value: number) =>
      formatMetricsUsingUnitAndOp(value, unit, operation),
    nameFormatter: mri => getNameFromMRI(mri),
    isGroupedByDate: true,
    bucketSize,
    showTimeInTooltip: true,
    addSecondsToTimeFormat: isSubMinuteBucket,
  };
  const displayFogOfWar = operation && ['sum', 'count'].includes(operation);

  const chartProps = {
    forwardedRef: chartRef,
    isGroupedByDate: true,
    height: 300,
    colors: seriesToShow.map(s => s.color),
    grid: {top: 20, bottom: 20, left: 15, right: 25},
    tooltip: {
      formatter: (params, asyncTicket) => {
        const hoveredEchartElement = Array.from(document.querySelectorAll(':hover')).find(
          element => {
            return element.classList.contains('echarts-for-react');
          }
        );

        if (hoveredEchartElement === chartRef?.current?.ele) {
          return getFormatter(formatters)(params, asyncTicket);
        }
        return '';
      },
    },

    yAxis: {
      axisLabel: {
        formatter: (value: number) => {
          return formatMetricsUsingUnitAndOp(value, unit, operation);
        },
      },
    },
  };

  return (
    <ChartWrapper>
      <ChartZoom
        router={router}
        period={period}
        start={start}
        end={end}
        utc={utc}
        onZoom={zoomPeriod => {
          onZoom?.(zoomPeriod.start, zoomPeriod.end);
        }}
      >
        {zoomRenderProps => (
          <ReleaseSeries
            utc={utc}
            period={period}
            start={zoomRenderProps.start!}
            end={zoomRenderProps.end!}
            projects={projects}
            environments={environments}
            preserveQueryParams
          >
            {({releaseSeries}) => {
              const releaseSeriesData = releaseSeries?.[0]?.markLine?.data ?? [];

              const selected =
                releaseSeriesData?.length >= RELEASE_LINES_THRESHOLD
                  ? {[t('Releases')]: false}
                  : {};

              const legend = releaseSeriesData?.length
                ? Legend({
                    itemGap: 20,
                    top: 0,
                    right: 20,
                    data: releaseSeries.map(s => s.seriesName),
                    theme: theme as Theme,
                    selected,
                  })
                : undefined;

              const allProps = {
                ...chartProps,
                ...zoomRenderProps,
                series: [...seriesToShow, ...releaseSeries],
                legend,
              };

              return displayType === MetricDisplayType.LINE ? (
                <LineChart {...allProps} />
              ) : displayType === MetricDisplayType.AREA ? (
                <AreaChart {...allProps} />
              ) : (
                <BarChart stacked animation={false} {...allProps} />
              );
            }}
          </ReleaseSeries>
        )}
      </ChartZoom>
      {displayFogOfWar && (
        <FogOfWar bucketSize={bucketSize} seriesLength={seriesLength} />
      )}
    </ChartWrapper>
  );
}

function FogOfWar({
  bucketSize,
  seriesLength,
}: {
  bucketSize?: number;
  seriesLength?: number;
}) {
  if (!bucketSize || !seriesLength) {
    return null;
  }

  const widthFactor = getWidthFactor(bucketSize);
  const fogOfWarWidth = widthFactor * bucketSize + 30_000;

  const seriesWidth = bucketSize * seriesLength;

  // If either of these are undefiend, NaN or 0 the result will be invalid
  if (!fogOfWarWidth || !seriesWidth) {
    return null;
  }

  const width = (fogOfWarWidth / seriesWidth) * 100;

  return <FogOfWarOverlay width={width ?? 0} />;
}

function getWidthFactor(bucketSize: number) {
  // In general, fog of war should cover the last bucket
  if (bucketSize > 30 * 60_000) {
    return 1;
  }

  // for 10s timeframe we want to show a fog of war that spans last 10 buckets
  // because on average, we are missing last 90 seconds of data
  if (bucketSize <= 10_000) {
    return 10;
  }

  // For smaller time frames we want to show a wider fog of war
  return 2;
}

const ChartWrapper = styled('div')`
  position: relative;
  height: 300px;
`;

const FogOfWarOverlay = styled('div')<{width?: number}>`
  height: 244px;
  width: ${p => p.width}%;
  position: absolute;
  right: 21px;
  top: 18px;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    ${p => p.theme.background}00 0%,
    ${p => p.theme.background}FF 70%,
    ${p => p.theme.background}FF 100%
  );
`;
