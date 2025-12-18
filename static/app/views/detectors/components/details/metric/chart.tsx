import {useMemo} from 'react';
import {type Theme} from '@emotion/react';
import type {YAXisComponentOption} from 'echarts';

import Feature from 'sentry/components/acl/feature';
import {AreaChart, type AreaChartProps} from 'sentry/components/charts/areaChart';
import {defaultFormatAxisLabel} from 'sentry/components/charts/components/tooltip';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {useChartZoom} from 'sentry/components/charts/useChartZoom';
import {Alert} from 'sentry/components/core/alert';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex} from 'sentry/components/core/layout';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {GroupOpenPeriod} from 'sentry/types/group';
import type {MetricDetector, SnubaQuery} from 'sentry/types/workflowEngine/detectors';
import {decodeScalar} from 'sentry/utils/queryString';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {
  buildDetectorZoomQuery,
  computeZoomRangeMs,
} from 'sentry/views/detectors/components/details/common/buildDetectorZoomQuery';
import {getDetectorOpenInDestination} from 'sentry/views/detectors/components/details/metric/getDetectorOpenInDestination';
import {useDetectorChartAxisBounds} from 'sentry/views/detectors/components/details/metric/utils/useDetectorChartAxisBounds';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {getDetectorDataset} from 'sentry/views/detectors/datasetConfig/getDetectorDataset';
import {useFilteredAnomalyThresholdSeries} from 'sentry/views/detectors/hooks/useFilteredAnomalyThresholdSeries';
import {
  useIncidentMarkers,
  type IncidentPeriod,
} from 'sentry/views/detectors/hooks/useIncidentMarkers';
import {useMetricDetectorAnomalyThresholds} from 'sentry/views/detectors/hooks/useMetricDetectorAnomalyThresholds';
import {useMetricDetectorSeries} from 'sentry/views/detectors/hooks/useMetricDetectorSeries';
import {useMetricDetectorThresholdSeries} from 'sentry/views/detectors/hooks/useMetricDetectorThresholdSeries';
import {useMetricTimestamps} from 'sentry/views/detectors/hooks/useMetricTimestamps';
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
  const color =
    ctx.period.priority === 'high' ? ctx.theme.colors.red400 : ctx.theme.colors.yellow400;
  const priorityLabel = ctx.period.priority === 'high' ? t('Critical') : t('Warning');

  const priorityDot = `<span style="display:inline-block;width:10px;height:8px;border-radius:100%;background:${color};margin-right:6px;vertical-align:middle;"></span>`;
  return [
    '<div class="tooltip-series">',
    `<div><span class="tooltip-label"><strong>#${ctx.period.id}</strong></span></div>`,
    `<div><span class="tooltip-label">${t('Started')}</span> ${startTime}</div>`,
    `<div><span class="tooltip-label">${t('Ended')}</span> ${endTime}</div>`,
    `<div><span class="tooltip-label">${t('Priority')}</span> ${priorityDot} ${priorityLabel}</div>`,
    '</div>',
    '<div class="tooltip-arrow arrow-top"></div>',
  ].join('');
}

function incidentMarklineTooltip(ctx: IncidentTooltipContext) {
  const time = defaultFormatAxisLabel(ctx.period.start, true, false, true, false);
  const color =
    ctx.period.priority === 'high' ? ctx.theme.colors.red400 : ctx.theme.colors.yellow400;
  const priorityLabel = ctx.period.priority === 'high' ? t('Critical') : t('Warning');
  const priorityDot = `<span style="display:inline-block;width:10px;height:8px;border-radius:100%;background:${color};margin-right:6px;vertical-align:middle;"></span>`;
  return [
    '<div class="tooltip-series">',
    `<div><span class="tooltip-label"><strong>${t('#%s Triggered', ctx.period.id)}</strong></span></div>`,
    `<div><span class="tooltip-label">${t('Started')}</span> ${time}</div>`,
    `<div><span class="tooltip-label">${t('Priority')}</span> ${priorityDot} ${priorityLabel}</div>`,
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

interface UseMetricDetectorChartProps {
  detector: MetricDetector;
  openPeriods: GroupOpenPeriod[];
  /**
   * Relative time period (e.g., '7d'). Use either statsPeriod or absolute start/end.
   */
  end?: string | null;
  height?: number;
  start?: string | null;
  statsPeriod?: string | null;
}

function createTriggerIntervalMarkerData({
  period,
  intervalMs,
}: {
  intervalMs: number;
  period: GroupOpenPeriod;
}): IncidentPeriod {
  return {
    id: period.id,
    end: new Date(period.start).getTime(),
    priority: period.activities[0]?.value ?? 'high',
    start: new Date(period.start).getTime() - intervalMs,
    type: 'trigger-interval',
  };
}

function createOpenPeriodMarkerData({
  period,
}: {
  period: GroupOpenPeriod;
}): IncidentPeriod[] {
  const endDate = period.end ? new Date(period.end).getTime() : Date.now();

  const segments = period.activities
    .filter(activity => activity.type !== 'closed')
    .map((activity, i) => {
      const activityEndTime = new Date(
        period.activities[i + 1]?.dateCreated ?? period.end ?? endDate
      ).getTime();

      return {
        priority: activity.value,
        end: activityEndTime,
        start: new Date(activity.dateCreated).getTime(),
      };
    });

  return segments.map((segment, i) => ({
    type: i === 0 ? 'open-period-start' : 'open-period-transition',
    end: segment.end,
    id: period.id,
    name: t('Open Periods'),
    priority: segment.priority ?? 'high',
    start: segment.start,
  }));
}

type UseMetricDetectorChartResult =
  | {chartProps: AreaChartProps; error: null; isLoading: false}
  | {chartProps: null; error: null; isLoading: true}
  | {chartProps: null; error: RequestError; isLoading: false};

export function useMetricDetectorChart({
  statsPeriod,
  start,
  end,
  detector,
  openPeriods,
  height = CHART_HEIGHT,
}: UseMetricDetectorChartProps): UseMetricDetectorChartResult {
  const navigate = useNavigate();
  const location = useLocation();

  const detectionType = detector.config.detectionType;
  const comparisonDelta =
    detectionType === 'percent' ? detector.config.comparisonDelta : undefined;
  const snubaQuery = detector.dataSources[0].queryObj.snubaQuery;
  const dataset = getDetectorDataset(snubaQuery.dataset, snubaQuery.eventTypes);
  const datasetConfig = getDatasetConfig(dataset);
  const aggregate = datasetConfig.fromApiAggregate(snubaQuery.aggregate);
  const {series, comparisonSeries, isLoading, error} = useMetricDetectorSeries({
    detectorDataset: dataset,
    dataset: snubaQuery.dataset,
    extrapolationMode: snubaQuery.extrapolationMode,
    aggregate,
    interval: snubaQuery.timeWindow,
    query: datasetConfig.toSnubaQueryString(snubaQuery),
    environment: snubaQuery.environment,
    projectId: detector.projectId,
    eventTypes: snubaQuery.eventTypes,
    comparisonDelta,
    statsPeriod,
    start,
    end,
  });

  const metricTimestamps = useMetricTimestamps(series);

  const {maxValue: thresholdMaxValue, additionalSeries: thresholdAdditionalSeries} =
    useMetricDetectorThresholdSeries({
      conditions: detector.conditionGroup?.conditions,
      detectionType,
      aggregate,
      comparisonSeries,
    });

  const {anomalyThresholdSeries} = useMetricDetectorAnomalyThresholds({
    detectorId: detector.id,
    detectionType,
    startTimestamp: metricTimestamps.start,
    endTimestamp: metricTimestamps.end,
    series,
  });

  const filteredAnomalyThresholdSeries = useFilteredAnomalyThresholdSeries({
    anomalyThresholdSeries,
    detector,
  });

  const incidentPeriods = useMemo(() => {
    return openPeriods.flatMap<IncidentPeriod>(period => [
      createTriggerIntervalMarkerData({
        period,
        intervalMs: snubaQuery.timeWindow * 1000,
      }),
      ...createOpenPeriodMarkerData({period}),
    ]);
  }, [openPeriods, snubaQuery.timeWindow]);

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

  const {maxValue, minValue} = useDetectorChartAxisBounds({series, thresholdMaxValue});

  const additionalSeries = useMemo(() => {
    const baseSeries = [...thresholdAdditionalSeries, ...filteredAnomalyThresholdSeries];

    // Line series not working well with the custom series type
    baseSeries.push(openPeriodMarkerResult.incidentMarkerSeries as any);

    return baseSeries;
  }, [
    thresholdAdditionalSeries,
    filteredAnomalyThresholdSeries,
    openPeriodMarkerResult.incidentMarkerSeries,
  ]);

  const yAxes = useMemo(() => {
    const {formatYAxisLabel, outputType} = getDetectorChartFormatters({
      detectionType,
      aggregate,
    });

    const isPercentage = outputType === 'percentage';
    // For percentage aggregates, use fixed max of 1 (100%) and calculated min
    const yAxisMax = isPercentage ? 1 : maxValue > 0 ? maxValue : undefined;
    // Start charts at 0 for non-percentage aggregates
    const yAxisMin = isPercentage ? minValue : 0;

    const mainYAxis: YAXisComponentOption = {
      max: yAxisMax,
      min: yAxisMin,
      axisLabel: {
        // Show max label for percentage (100%) but hide for other types to avoid arbitrary values
        showMaxLabel: isPercentage,
        // Format the axis labels with units
        formatter: formatYAxisLabel,
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
    detectionType,
    aggregate,
    maxValue,
    minValue,
    openPeriodMarkerResult.incidentMarkerYAxis,
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

  const chartProps = useMemo<AreaChartProps | null>(() => {
    if (isLoading || error) {
      return null;
    }
    return {
      showTimeInTooltip: true,
      height,
      stacked: false,
      series,
      additionalSeries,
      yAxes: yAxes.length > 1 ? yAxes : undefined,
      yAxis: yAxes.length === 1 ? yAxes[0] : undefined,
      grid,
      xAxis: openPeriodMarkerResult.incidentMarkerXAxis,
      tooltip: {
        valueFormatter: getDetectorChartFormatters({
          detectionType,
          aggregate,
        }).formatTooltipValue,
      },
      ...chartZoomProps,
      onChartReady: chart => {
        chartZoomProps.onChartReady(chart);
        openPeriodMarkerResult.onChartReady(chart);
      },
    };
  }, [
    additionalSeries,
    aggregate,
    chartZoomProps,
    detectionType,
    error,
    grid,
    height,
    isLoading,
    openPeriodMarkerResult,
    series,
    yAxes,
  ]);

  if (chartProps) {
    return {
      chartProps,
      error: null,
      isLoading: false,
    };
  }

  if (error) {
    return {
      chartProps: null,
      error,
      isLoading: false,
    };
  }

  return {
    isLoading: true,
    error: null,
    chartProps: null,
  };
}

interface OpenInButtonProps {
  detector: MetricDetector;
}

function OpenInButton({detector}: OpenInButtonProps) {
  const organization = useOrganization();
  const location = useLocation();
  const snubaQuery = detector.dataSources[0]?.queryObj?.snubaQuery;

  if (!snubaQuery) {
    return null;
  }

  const destination = getDetectorOpenInDestination({
    detectorName: detector.name,
    organization,
    projectId: detector.projectId,
    snubaQuery,
    statsPeriod: decodeScalar(location.query.statsPeriod),
    start: decodeScalar(location.query.start),
    end: decodeScalar(location.query.end),
  });

  if (!destination?.to) {
    return null;
  }

  return (
    <Feature features="visibility-explore-view">
      <LinkButton size="xs" to={destination.to}>
        {destination.buttonText}
      </LinkButton>
    </Feature>
  );
}

function ChartContainer({
  children,
  overflow,
}: {
  children: React.ReactNode;
  overflow?: 'hidden';
}) {
  return (
    <Container border="muted" radius="md" overflow={overflow}>
      {children}
    </Container>
  );
}

function ChartBody({children}: {children: React.ReactNode}) {
  return <Container padding="lg">{children}</Container>;
}

function ChartFooter({detector}: {detector: MetricDetector}) {
  return (
    <Flex justify="end" padding="lg" borderTop="muted">
      <OpenInButton detector={detector} />
    </Flex>
  );
}

export function MetricDetectorDetailsChart({detector}: MetricDetectorDetailsChartProps) {
  const location = useLocation();
  const organization = useOrganization();
  const dateParams = normalizeDateTimeParams(location.query);
  const snubaQuery = detector.dataSources[0]?.queryObj?.snubaQuery;

  const destination =
    snubaQuery &&
    getDetectorOpenInDestination({
      detectorName: detector.name,
      organization,
      projectId: detector.projectId,
      snubaQuery,
      statsPeriod: decodeScalar(location.query.statsPeriod),
      start: decodeScalar(location.query.start),
      end: decodeScalar(location.query.end),
    });

  const {data: openPeriods = []} = useOpenPeriods({
    detectorId: detector.id,
    ...dateParams,
  });

  const {chartProps, isLoading, error} = useMetricDetectorChart({
    detector,
    openPeriods,
    height: CHART_HEIGHT,
    ...dateParams,
  });

  if (isLoading) {
    return (
      <ChartContainer>
        <ChartBody>
          <Flex height={CHART_HEIGHT} justify="center" align="center">
            <Placeholder height={`${CHART_HEIGHT}px`} />
          </Flex>
        </ChartBody>
        {destination && <ChartFooter detector={detector} />}
      </ChartContainer>
    );
  }
  if (error || !chartProps) {
    const errorMessage =
      typeof error?.responseJSON?.detail === 'string' ? error.responseJSON.detail : null;
    return (
      <ChartContainer overflow="hidden">
        {errorMessage && (
          <Alert system type="error">
            {errorMessage}
          </Alert>
        )}
        <ChartBody>
          <Flex justify="center" align="center">
            <ErrorPanel height={`${CHART_HEIGHT - 45}px`}>
              <IconWarning color="gray300" size="lg" />
              <div>{t('Error loading chart data')}</div>
            </ErrorPanel>
          </Flex>
        </ChartBody>
        {destination && <ChartFooter detector={detector} />}
      </ChartContainer>
    );
  }

  return (
    <ChartContainer>
      <ChartBody>
        <AreaChart {...chartProps} />
      </ChartBody>
      {destination && <ChartFooter detector={detector} />}
    </ChartContainer>
  );
}
