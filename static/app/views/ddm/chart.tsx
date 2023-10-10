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
import {PageFilters} from 'sentry/types';
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

  const formatters = {
    valueFormatter: (value: number) =>
      formatMetricsUsingUnitAndOp(value, unit, operation),
    nameFormatter: mri => getNameFromMRI(mri),
    isGroupedByDate: true,
    bucketSize,
    showTimeInTooltip: true,
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
      axisPointer: {
        label: {show: true},
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
      <ChartZoom router={router} period={period} start={start} end={end} utc={utc}>
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
                <BarChart stacked {...allProps} />
              );
            }}
          </ReleaseSeries>
        )}
      </ChartZoom>
      {displayFogOfWar && <FogOfWarOverlay />}
    </ChartWrapper>
  );
}

const ChartWrapper = styled('div')`
  position: relative;
  height: 300px;
`;

const FogOfWarOverlay = styled('div')`
  height: 238px;
  width: 10%;
  position: absolute;
  right: 10px;
  top: 18px;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    ${p => p.theme.background}00 0%,
    ${p => p.theme.background}FF 70%,
    ${p => p.theme.background}FF 100%
  );
`;
