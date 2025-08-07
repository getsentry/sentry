import {useMemo} from 'react';
import type {YAXisComponentOption} from 'echarts';

import {AreaChart} from 'sentry/components/charts/areaChart';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {Flex} from 'sentry/components/core/layout';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import type {MetricDetectorConfig} from 'sentry/types/workflowEngine/detectors';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
  TimePeriod,
} from 'sentry/views/alerts/rules/metric/types';
import type {DetectorDataset} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {useIncidentMarkers} from 'sentry/views/detectors/hooks/useIncidentMarkers';
import {useMetricDetectorAnomalyPeriods} from 'sentry/views/detectors/hooks/useMetricDetectorAnomalyPeriods';
import {useMetricDetectorSeries} from 'sentry/views/detectors/hooks/useMetricDetectorSeries';
import {useMetricDetectorThresholdSeries} from 'sentry/views/detectors/hooks/useMetricDetectorThresholdSeries';

const CHART_HEIGHT = 180;

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
  conditions: Array<Omit<DataCondition, 'id'>>;
  /**
   * The dataset to use for the chart
   */
  dataset: DetectorDataset;
  detectionType: MetricDetectorConfig['detectionType'];
  /**
   * The environment filter
   */
  environment: string | undefined;
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
   * The time period for the chart data (optional, defaults to 7d)
   */
  statsPeriod: TimePeriod;
  /**
   * Used in anomaly detection
   */
  thresholdType: AlertRuleThresholdType | undefined;
}

export function MetricDetectorChart({
  dataset,
  aggregate,
  interval,
  query,
  environment,
  projectId,
  conditions,
  detectionType,
  statsPeriod,
  comparisonDelta,
  sensitivity,
  thresholdType,
}: MetricDetectorChartProps) {
  const {series, comparisonSeries, isLoading, isError} = useMetricDetectorSeries({
    dataset,
    aggregate,
    interval,
    query,
    environment,
    projectId,
    statsPeriod,
    comparisonDelta,
  });

  const {maxValue: thresholdMaxValue, additionalSeries: thresholdAdditionalSeries} =
    useMetricDetectorThresholdSeries({
      conditions,
      detectionType,
      comparisonSeries,
    });

  const isAnomalyDetection = detectionType === 'dynamic';
  const shouldFetchAnomalies =
    isAnomalyDetection && !isLoading && !isError && series.length > 0;

  // Fetch anomaly data when detection type is dynamic and series data is ready
  const {
    anomalyPeriods,
    isLoading: isLoadingAnomalies,
    error: anomalyErrorObject,
  } = useMetricDetectorAnomalyPeriods({
    series: shouldFetchAnomalies ? series : [],
    dataset,
    aggregate,
    query,
    environment,
    projectId,
    statsPeriod,
    timePeriod: interval,
    thresholdType,
    sensitivity,
    enabled: shouldFetchAnomalies,
  });

  // Create anomaly marker rendering from pre-grouped anomaly periods
  const anomalyMarkerResult = useIncidentMarkers({
    incidents: anomalyPeriods,
    seriesName: t('Anomalies'),
    seriesId: '__anomaly_marker__',
    yAxisIndex: 1, // Use index 1 to avoid conflict with main chart axis
  });

  const anomalyLoading = shouldFetchAnomalies ? isLoadingAnomalies : false;
  const anomalyError = shouldFetchAnomalies ? anomalyErrorObject : null;

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

    if (isAnomalyDetection && anomalyMarkerResult.incidentMarkerSeries) {
      // Line series not working well with the custom series type
      baseSeries.push(anomalyMarkerResult.incidentMarkerSeries as any);
    }

    return baseSeries;
  }, [
    isAnomalyDetection,
    thresholdAdditionalSeries,
    anomalyMarkerResult.incidentMarkerSeries,
  ]);

  const yAxes = useMemo(() => {
    const mainYAxis: YAXisComponentOption = {
      max: maxValue > 0 ? maxValue : undefined,
      min: 0,
      axisLabel: {
        // Hide the maximum y-axis label to avoid showing arbitrary threshold values
        showMaxLabel: false,
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
  }, [maxValue, isAnomalyDetection, anomalyMarkerResult.incidentMarkerYAxis]);

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

  if (isLoading || anomalyLoading) {
    return (
      <Flex style={{height: CHART_HEIGHT}} justify="center" align="center">
        <Placeholder height={`${CHART_HEIGHT - 20}px`} />
      </Flex>
    );
  }

  if (isError || anomalyError) {
    return (
      <Flex style={{height: CHART_HEIGHT}} justify="center" align="center">
        <ErrorPanel>
          <IconWarning color="gray300" size="lg" />
          <div>{t('Error loading chart data')}</div>
        </ErrorPanel>
      </Flex>
    );
  }

  return (
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
      ref={
        isAnomalyDetection ? anomalyMarkerResult.connectIncidentMarkerChartRef : undefined
      }
    />
  );
}
