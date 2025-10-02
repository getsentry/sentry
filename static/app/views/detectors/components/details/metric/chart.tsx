import {useMemo} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {YAXisComponentOption} from 'echarts';

import {AreaChart} from 'sentry/components/charts/areaChart';
import {defaultFormatAxisLabel} from 'sentry/components/charts/components/tooltip';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {useChartZoom} from 'sentry/components/charts/useChartZoom';
import {Flex} from 'sentry/components/core/layout';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricDetector, SnubaQuery} from 'sentry/types/workflowEngine/detectors';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  buildDetectorZoomQuery,
  computeZoomRangeMs,
} from 'sentry/views/detectors/components/details/common/buildDetectorZoomQuery';
import {useDetectorDateParams} from 'sentry/views/detectors/components/details/metric/utils/useDetectorTimePeriods';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {getDetectorDataset} from 'sentry/views/detectors/datasetConfig/getDetectorDataset';
import {
  useIncidentMarkers,
  type IncidentPeriod,
} from 'sentry/views/detectors/hooks/useIncidentMarkers';
import {useMetricDetectorSeries} from 'sentry/views/detectors/hooks/useMetricDetectorSeries';
import {useMetricDetectorThresholdSeries} from 'sentry/views/detectors/hooks/useMetricDetectorThresholdSeries';
import {useOpenPeriods} from 'sentry/views/detectors/hooks/useOpenPeriods';
import {getDetectorChartFormatters} from 'sentry/views/detectors/utils/detectorChartFormatting';

interface IncidentTooltipContext {
  period: IncidentPeriod;
  theme: Theme;
}

function incidentSeriesTooltip(ctx: IncidentTooltipContext) {
  const startTime = defaultFormatAxisLabel(ctx.period.start, true, false, true, false);
  const endTime = ctx.period.end
    ? defaultFormatAxisLabel(ctx.period.end, true, false, true, false)
    : '-';
  const priorityDot = `<span style="display:inline-block;width:10px;height:8px;border-radius:100%;background:${ctx.theme.red400};margin-right:6px;vertical-align:middle;"></span>`;
  return [
    '<div class="tooltip-series">',
    `<div><span class="tooltip-label"><strong>#${ctx.period.id}</strong></span></div>`,
    `<div><span class="tooltip-label">${t('Started')}</span> ${startTime}</div>`,
    `<div><span class="tooltip-label">${t('Ended')}</span> ${endTime}</div>`,
    `<div><span class="tooltip-label">${t('Priority')}</span> ${priorityDot} ${t('Critical')}</div>`,
    '</div>',
    '<div class="tooltip-arrow arrow-top"></div>',
  ].join('');
}

function incidentMarklineTooltip(ctx: IncidentTooltipContext) {
  const time = defaultFormatAxisLabel(ctx.period.start, true, false, true, false);
  const priorityDot = `<span style="display:inline-block;width:10px;height:8px;border-radius:100%;background:${ctx.theme.red400};margin-right:6px;vertical-align:middle;"></span>`;
  return [
    '<div class="tooltip-series">',
    `<div><span class="tooltip-label"><strong>${t('#%s Triggered', ctx.period.id)}</strong></span></div>`,
    `<div><span class="tooltip-label">${t('Started')}</span> ${time}</div>`,
    `<div><span class="tooltip-label">${t('Priority')}</span> ${priorityDot} ${t('Critical')}</div>`,
    '</div>',
    '<div class="tooltip-arrow arrow-top"></div>',
  ].join('');
}

interface MetricDetectorDetailsChartProps {
  detector: MetricDetector;
  // Passing snubaQuery separately to avoid checking null in all places
  snubaQuery: SnubaQuery;
}
const CHART_HEIGHT = 180;

interface MetricDetectorChartProps {
  detector: MetricDetector;
  snubaQuery: SnubaQuery;
  /**
   * Relative time period (e.g., '7d'). Use either statsPeriod or absolute start/end.
   */
  end?: string;
  start?: string;
  statsPeriod?: string;
}

function MetricDetectorChart({
  statsPeriod,
  start,
  end,
  snubaQuery,
  detector,
}: MetricDetectorChartProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const detectionType = detector.config.detectionType;
  const comparisonDelta =
    detectionType === 'percent' ? detector.config.comparisonDelta : undefined;
  const dataset = getDetectorDataset(snubaQuery.dataset, snubaQuery.eventTypes);
  const datasetConfig = getDatasetConfig(dataset);
  const {series, comparisonSeries, isLoading, error} = useMetricDetectorSeries({
    detectorDataset: dataset,
    dataset: snubaQuery.dataset,
    aggregate: datasetConfig.fromApiAggregate(snubaQuery.aggregate),
    interval: snubaQuery.timeWindow,
    query: snubaQuery.query,
    environment: snubaQuery.environment,
    projectId: detector.projectId,
    eventTypes: snubaQuery.eventTypes,
    comparisonDelta,
    statsPeriod,
    start,
    end,
  });

  const {maxValue: thresholdMaxValue, additionalSeries: thresholdAdditionalSeries} =
    useMetricDetectorThresholdSeries({
      conditions: detector.conditionGroup?.conditions,
      detectionType,
      comparisonSeries,
    });

  const {data: openPeriods = []} = useOpenPeriods({
    detectorId: detector.id,
    start,
    end,
    statsPeriod,
  });

  const incidentPeriods = useMemo(() => {
    const endDate = end ? new Date(end).getTime() : Date.now();

    return openPeriods.map<IncidentPeriod>(period => ({
      ...period,
      // TODO: When open periods return a priority, use that to determine the color
      color: 'red',
      name: t('Open Periods'),
      type: 'openPeriod',
      end: period.end ? new Date(period.end).getTime() : endDate,
      start: new Date(period.start).getTime(),
    }));
  }, [openPeriods, end]);

  const openPeriodMarkerResult = useIncidentMarkers({
    incidents: incidentPeriods,
    seriesName: t('Open Periods'),
    seriesId: '__incident_marker__',
    yAxisIndex: 1, // Use index 1 to avoid conflict with main chart axis
    seriesTooltip: incidentSeriesTooltip,
    markLineTooltip: incidentMarklineTooltip,
    onClick: context => {
      const startMs = context.period.start;
      const endMs = context.period.end ?? Date.now();
      const intervalSeconds = Number(snubaQuery.timeWindow) || 60;
      const {start: zoomStart, end: zoomEnd} = computeZoomRangeMs({
        startMs,
        endMs,
        intervalSeconds,
      });
      navigate({
        pathname: location.pathname,
        query: buildDetectorZoomQuery(location.query, zoomStart, zoomEnd),
      });
    },
  });

  const chartZoomProps = useChartZoom({
    usePageDate: true,
  });

  // Calculate y-axis bounds to ensure all thresholds are visible
  const maxValue = useMemo(() => {
    // Get max from series data
    let seriesMax = 0;
    if (series.length > 0) {
      const allSeriesValues = series.flatMap(s =>
        s.data
          .map(point => point.value)
          .filter(val => typeof val === 'number' && !isNaN(val))
      );
      seriesMax = allSeriesValues.length > 0 ? Math.max(...allSeriesValues) : 0;
    }

    // Combine with threshold max and round to nearest whole number
    const combinedMax = thresholdMaxValue
      ? Math.max(seriesMax, thresholdMaxValue)
      : seriesMax;

    const roundedMax = Math.round(combinedMax);

    // Add padding to the bounds
    const padding = roundedMax * 0.1;
    return roundedMax + padding;
  }, [series, thresholdMaxValue]);

  const additionalSeries = useMemo(() => {
    const baseSeries = [...thresholdAdditionalSeries];

    // Line series not working well with the custom series type
    baseSeries.push(openPeriodMarkerResult.incidentMarkerSeries as any);

    return baseSeries;
  }, [thresholdAdditionalSeries, openPeriodMarkerResult.incidentMarkerSeries]);

  const yAxes = useMemo(() => {
    const {formatYAxisLabel} = getDetectorChartFormatters({
      detectionType,
      aggregate: snubaQuery.aggregate,
    });

    const mainYAxis: YAXisComponentOption = {
      max: maxValue > 0 ? maxValue : undefined,
      min: 0,
      axisLabel: {
        // Hide the maximum y-axis label to avoid showing arbitrary threshold values
        showMaxLabel: false,
        formatter: (value: number) => formatYAxisLabel(value),
      },
      // Disable the y-axis grid lines
      splitLine: {show: false},
    };

    const axes: YAXisComponentOption[] = [mainYAxis];

    if (openPeriodMarkerResult.incidentMarkerYAxis) {
      axes.push(openPeriodMarkerResult.incidentMarkerYAxis);
    }

    return axes;
  }, [
    maxValue,
    openPeriodMarkerResult.incidentMarkerYAxis,
    detectionType,
    snubaQuery.aggregate,
  ]);

  const grid = useMemo(() => {
    return {
      left: space(0.25),
      right: space(0.25),
      top: space(1.5),
      bottom: space(1),
      ...openPeriodMarkerResult.incidentMarkerGrid,
    };
  }, [openPeriodMarkerResult.incidentMarkerGrid]);

  if (isLoading) {
    return (
      <Flex height={CHART_HEIGHT} justify="center" align="center">
        <Placeholder height={`${CHART_HEIGHT}px`} />
      </Flex>
    );
  }

  if (error) {
    return (
      <Flex height={CHART_HEIGHT} justify="center" align="center">
        <ErrorPanel>
          <IconWarning color="gray300" size="lg" />
          <div>{t('Error loading chart data')}</div>
        </ErrorPanel>
      </Flex>
    );
  }

  return (
    <AreaChart
      showTimeInTooltip
      height={CHART_HEIGHT}
      stacked={false}
      series={series}
      additionalSeries={additionalSeries}
      yAxes={yAxes.length > 1 ? yAxes : undefined}
      yAxis={yAxes.length === 1 ? yAxes[0] : undefined}
      grid={grid}
      xAxis={openPeriodMarkerResult.incidentMarkerXAxis}
      tooltip={{
        valueFormatter: getDetectorChartFormatters({
          detectionType,
          aggregate: snubaQuery.aggregate,
        }).formatTooltipValue,
      }}
      {...chartZoomProps}
      onChartReady={chart => {
        chartZoomProps.onChartReady(chart);
        openPeriodMarkerResult.onChartReady(chart);
      }}
    />
  );
}

export function MetricDetectorDetailsChart({
  detector,
  snubaQuery,
}: MetricDetectorDetailsChartProps) {
  const location = useLocation();
  const statsPeriod = location.query?.statsPeriod as string | undefined;
  const start = location.query?.start as string | undefined;
  const end = location.query?.end as string | undefined;
  const detectorDataset = getDetectorDataset(snubaQuery.dataset, snubaQuery.eventTypes);
  const dateParams = useDetectorDateParams({
    dataset: detectorDataset,
    intervalSeconds: snubaQuery.timeWindow,
    start,
    end,
    urlStatsPeriod: statsPeriod,
  });

  return (
    <ChartContainer>
      <ChartContainerBody>
        <MetricDetectorChart
          detector={detector}
          // Pass snubaQuery separately to avoid checking null in all places
          snubaQuery={snubaQuery}
          {...dateParams}
        />
      </ChartContainerBody>
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const ChartContainerBody = styled('div')`
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.lg} ${p => p.theme.space.xs};
`;
