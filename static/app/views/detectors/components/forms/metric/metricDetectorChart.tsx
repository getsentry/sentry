import {Fragment, useMemo} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {YAXisComponentOption} from 'echarts';

import {AreaChart} from 'sentry/components/charts/areaChart';
import {defaultFormatAxisLabel} from 'sentry/components/charts/components/tooltip';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  MetricCondition,
  MetricDetectorConfig,
} from 'sentry/types/workflowEngine/detectors';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
  Dataset,
  EventTypes,
  ExtrapolationMode,
} from 'sentry/views/alerts/rules/metric/types';
import {useDetectorChartAxisBounds} from 'sentry/views/detectors/components/details/metric/utils/useDetectorChartAxisBounds';
import {useIsMigratedExtrapolation} from 'sentry/views/detectors/components/details/metric/utils/useIsMigratedExtrapolation';
import {getBackendDataset} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import type {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';
import {useFilteredAnomalyThresholdSeries} from 'sentry/views/detectors/hooks/useFilteredAnomalyThresholdSeries';
import {useIncidentMarkers} from 'sentry/views/detectors/hooks/useIncidentMarkers';
import type {IncidentPeriod} from 'sentry/views/detectors/hooks/useIncidentMarkers';
import {useMetricDetectorAnomalyPeriods} from 'sentry/views/detectors/hooks/useMetricDetectorAnomalyPeriods';
import {useMetricDetectorAnomalyThresholds} from 'sentry/views/detectors/hooks/useMetricDetectorAnomalyThresholds';
import {useMetricDetectorSeries} from 'sentry/views/detectors/hooks/useMetricDetectorSeries';
import {useMetricDetectorThresholdSeries} from 'sentry/views/detectors/hooks/useMetricDetectorThresholdSeries';
import {useMetricTimestamps} from 'sentry/views/detectors/hooks/useMetricTimestamps';
import {useTimePeriodSelection} from 'sentry/views/detectors/hooks/useTimePeriodSelection';
import {getDetectorChartFormatters} from 'sentry/views/detectors/utils/detectorChartFormatting';

const CHART_HEIGHT = 180;

interface AnomalyTooltipContext {
  period: IncidentPeriod;
  theme: Theme;
}

function anomalySeriesTooltip(ctx: AnomalyTooltipContext) {
  const startTime = defaultFormatAxisLabel(ctx.period.start, true, false, true, false);
  const endTime = ctx.period.end
    ? defaultFormatAxisLabel(ctx.period.end, true, false, true, false)
    : '-';
  return [
    '<div class="tooltip-series">',
    `<div><span class="tooltip-label"><strong>${t('Anomaly')}</strong></span></div>`,
    `<div><span class="tooltip-label">${t('Started')}</span> ${startTime}</div>`,
    `<div><span class="tooltip-label">${t('Ended')}</span> ${endTime}</div>`,
    '</div>',
    '<div class="tooltip-arrow arrow-top"></div>',
  ].join('');
}

function anomalyMarklineTooltip(ctx: AnomalyTooltipContext) {
  const time = defaultFormatAxisLabel(ctx.period.start, true, false, true, false);
  return [
    '<div class="tooltip-series">',
    `<div><span class="tooltip-label"><strong>${t('Anomaly Detected')}</strong></span></div>`,
    `<div><span class="tooltip-label">${t('Started')}</span> ${time}</div>`,
    '</div>',
    '<div class="tooltip-arrow arrow-top"></div>',
  ].join('');
}

function ChartError() {
  return (
    <Flex justify="center" align="center" height={CHART_HEIGHT}>
      <ErrorPanel>
        <IconWarning variant="muted" size="lg" />
        <div>{t('Error loading chart data')}</div>
      </ErrorPanel>
    </Flex>
  );
}

function ChartLoading() {
  return (
    <Flex justify="center" align="center" height={CHART_HEIGHT}>
      <Placeholder height={`${CHART_HEIGHT - 20}px`} />
    </Flex>
  );
}

interface MetricDetectorChartProps {
  /**
   * The aggregate function to use (e.g., "avg(span.duration)")
   */
  aggregate: string;
  /**
   * Comparison delta in seconds for % change alerts
   */
  comparisonDelta: number | undefined;
  /**
   * The condition group containing threshold conditions
   */
  conditions: Array<Omit<MetricCondition, 'id'>>;
  dataset: Dataset;
  detectionType: MetricDetectorConfig['detectionType'];
  /**
   * The dataset to use for the chart
   */
  detectorDataset: DetectorDataset;
  /**
   * The environment filter
   */
  environment: string | undefined;
  /**
   * The event types to use for the query
   */
  eventTypes: EventTypes[];
  /**
   * The time interval in seconds
   */
  interval: number;
  /**
   * The project ID
   */
  projectId: string;
  /**
   * The query filter string
   */
  query: string;
  /**
   * Used in anomaly detection
   */
  sensitivity: AlertRuleSensitivity | undefined;
  /**
   * Used in anomaly detection
   */
  thresholdType: AlertRuleThresholdType | undefined;
  /**
   * Detector ID - only available when editing an existing detector
   */
  detectorId?: string;
  extrapolationMode?: ExtrapolationMode | undefined;
}

export function MetricDetectorChart({
  detectorDataset,
  dataset,
  aggregate,
  interval,
  query,
  eventTypes,
  environment,
  projectId,
  conditions,
  detectionType,
  comparisonDelta,
  sensitivity,
  thresholdType,
  extrapolationMode,
  detectorId,
}: MetricDetectorChartProps) {
  const {selectedTimePeriod, setSelectedTimePeriod, timePeriodOptions} =
    useTimePeriodSelection({
      dataset: getBackendDataset(detectorDataset),
      interval,
    });

  const shouldAlterExtrapolationMode = useIsMigratedExtrapolation({
    dataset: detectorDataset,
    extrapolationMode,
  });

  const adjustedExtrapolationMode = shouldAlterExtrapolationMode
    ? ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED
    : extrapolationMode;

  const {series, comparisonSeries, isLoading, error} = useMetricDetectorSeries({
    detectorDataset,
    dataset,
    aggregate,
    interval,
    query,
    environment,
    projectId,
    statsPeriod: selectedTimePeriod,
    comparisonDelta,
    eventTypes,
    extrapolationMode: adjustedExtrapolationMode,
  });

  const {maxValue: thresholdMaxValue, additionalSeries: thresholdAdditionalSeries} =
    useMetricDetectorThresholdSeries({
      conditions,
      detectionType,
      aggregate,
      comparisonSeries,
    });

  const isAnomalyDetection = detectionType === 'dynamic';
  const shouldFetchAnomalies =
    isAnomalyDetection && !isLoading && !error && series.length > 0;

  // Fetch anomaly data when detection type is dynamic and series data is ready
  const {
    anomalyPeriods,
    isLoading: isLoadingAnomalies,
    error: anomalyError,
  } = useMetricDetectorAnomalyPeriods({
    series: shouldFetchAnomalies ? series : [],
    isLoadingSeries: isLoading,
    detectorDataset,
    dataset,
    aggregate,
    query,
    eventTypes,
    environment,
    projectId,
    statsPeriod: selectedTimePeriod,
    interval,
    thresholdType,
    sensitivity,
    enabled: isAnomalyDetection,
  });

  // Create anomaly marker rendering from pre-grouped anomaly periods
  const anomalyMarkerResult = useIncidentMarkers({
    incidents: anomalyPeriods,
    seriesName: t('Anomalies'),
    seriesId: '__anomaly_marker__',
    yAxisIndex: 1, // Use index 1 to avoid conflict with main chart axis
    seriesTooltip: anomalySeriesTooltip,
    markLineTooltip: anomalyMarklineTooltip,
  });

  const metricTimestamps = useMetricTimestamps(series);

  const shouldFetchThresholds = Boolean(detectorId && isAnomalyDetection);
  const {anomalyThresholdSeries} = useMetricDetectorAnomalyThresholds({
    detectorId: detectorId ?? '',
    detectionType,
    startTimestamp: metricTimestamps.start,
    endTimestamp: metricTimestamps.end,
    series: shouldFetchThresholds ? series : [],
  });

  const filteredAnomalyThresholdSeries = useFilteredAnomalyThresholdSeries({
    anomalyThresholdSeries: detectorId ? anomalyThresholdSeries : [],
    isAnomalyDetection,
    thresholdType,
  });

  const {maxValue, minValue} = useDetectorChartAxisBounds({series, thresholdMaxValue});

  const additionalSeries = useMemo(() => {
    const baseSeries = [...thresholdAdditionalSeries, ...filteredAnomalyThresholdSeries];

    if (isAnomalyDetection && anomalyMarkerResult.incidentMarkerSeries) {
      // Line series not working well with the custom series type
      baseSeries.push(anomalyMarkerResult.incidentMarkerSeries as any);
    }

    return baseSeries;
  }, [
    isAnomalyDetection,
    thresholdAdditionalSeries,
    filteredAnomalyThresholdSeries,
    anomalyMarkerResult.incidentMarkerSeries,
  ]);

  const yAxes = useMemo(() => {
    const {formatYAxisLabel, outputType} = getDetectorChartFormatters({
      detectionType,
      aggregate,
    });

    const isPercentage = outputType === 'percentage';
    // For percentage aggregates, use fixed max of 1 (100%) and calculated min
    const yAxisMax = isPercentage ? 1 : maxValue > 0 ? maxValue : undefined;
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

    // Add anomaly marker Y-axis if available
    if (isAnomalyDetection && anomalyMarkerResult.incidentMarkerYAxis) {
      axes.push(anomalyMarkerResult.incidentMarkerYAxis);
    }

    return axes;
  }, [
    maxValue,
    minValue,
    isAnomalyDetection,
    anomalyMarkerResult.incidentMarkerYAxis,
    detectionType,
    aggregate,
  ]);

  // Prepare grid with anomaly marker adjustments
  const grid = useMemo(() => {
    const baseGrid = {
      left: space(0.25),
      right: space(0.25),
      top: space(1.5),
      bottom: space(1),
    };

    // Apply anomaly marker grid adjustments if available
    if (isAnomalyDetection && anomalyMarkerResult.incidentMarkerGrid) {
      return {
        ...baseGrid,
        ...anomalyMarkerResult.incidentMarkerGrid,
      };
    }

    return baseGrid;
  }, [isAnomalyDetection, anomalyMarkerResult.incidentMarkerGrid]);

  return (
    <ChartContainer>
      {isLoading ? (
        <ChartLoading />
      ) : error ? (
        <ChartError />
      ) : (
        <AreaChart
          isGroupedByDate
          showTimeInTooltip
          height={CHART_HEIGHT}
          stacked={false}
          series={series}
          additionalSeries={additionalSeries}
          yAxes={yAxes.length > 1 ? yAxes : undefined}
          yAxis={yAxes.length === 1 ? yAxes[0] : undefined}
          grid={grid}
          xAxis={isAnomalyDetection ? anomalyMarkerResult.incidentMarkerXAxis : undefined}
          onChartReady={isAnomalyDetection ? anomalyMarkerResult.onChartReady : undefined}
          tooltip={{
            valueFormatter: getDetectorChartFormatters({detectionType, aggregate})
              .formatTooltipValue,
          }}
        />
      )}
      <ChartFooter>
        {shouldFetchAnomalies ? (
          <Flex align="center" gap="sm">
            {isLoadingAnomalies ? (
              <Fragment>
                <AnomalyLoadingIndicator size={18} />
                <Text variant="muted">{t('Loading anomalies...')}</Text>
              </Fragment>
            ) : anomalyError ? (
              <Text variant="muted">{t('Error loading anomalies')}</Text>
            ) : anomalyPeriods.length === 0 ? (
              <Text variant="muted">{t('No anomalies found for this time period')}</Text>
            ) : (
              <Text variant="muted">
                {tn('Found %s anomaly', 'Found %s anomalies', anomalyPeriods.length)}
              </Text>
            )}
          </Flex>
        ) : (
          <div />
        )}
        <CompactSelect
          size="sm"
          options={timePeriodOptions}
          value={selectedTimePeriod}
          onChange={opt => setSelectedTimePeriod(opt.value)}
          triggerProps={{
            borderless: true,
            prefix: t('Display'),
          }}
        />
      </ChartFooter>
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  max-width: 1440px;
  border-top: 1px solid ${p => p.theme.border};
`;

const ChartFooter = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${p => `${p.theme.space.sm} 0 ${p.theme.space.sm} ${p.theme.space.lg}`};
  border-top: 1px solid ${p => p.theme.border};
`;

const AnomalyLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;
