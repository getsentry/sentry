import {useMemo} from 'react';
import styled from '@emotion/styled';
import type {YAXisComponentOption} from 'echarts';

import {AreaChart} from 'sentry/components/charts/areaChart';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {Flex} from 'sentry/components/core/layout';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import type {
  MetricDetector,
  MetricDetectorConfig,
} from 'sentry/types/workflowEngine/detectors';
import type {TimePeriod} from 'sentry/views/alerts/rules/metric/types';
import {
  DetectorDataset,
  getDetectorDataset,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {useIncidentMarkers} from 'sentry/views/detectors/hooks/useIncidentMarkers';
import {useMetricDetectorSeries} from 'sentry/views/detectors/hooks/useMetricDetectorSeries';
import {useMetricDetectorThresholdSeries} from 'sentry/views/detectors/hooks/useMetricDetectorThresholdSeries';

interface MetricDetectorDetailsChartProps {
  detector: MetricDetector;
  statsPeriod: TimePeriod;
}
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
   * The time period for the chart data (optional, defaults to 7d)
   */
  statsPeriod: TimePeriod;
}

function MetricDetectorChart({
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

  // TODO: Fetch open periodos and transform them into the right format
  const openPeriods: any[] = [];
  const openPeriodMarkerResult = useIncidentMarkers({
    incidents: openPeriods,
    seriesName: t('Open Periods'),
    seriesId: '__incident_marker__',
    yAxisIndex: 1, // Use index 1 to avoid conflict with main chart axis
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

    // Add anomaly bubble Y-axis if available
    if (openPeriodMarkerResult.incidentMarkerYAxis) {
      axes.push(openPeriodMarkerResult.incidentMarkerYAxis);
    }

    return axes;
  }, [maxValue, openPeriodMarkerResult.incidentMarkerYAxis]);

  // Prepare grid with anomaly bubble adjustments
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
      <Flex style={{height: CHART_HEIGHT}} justify="center" align="center">
        <Placeholder height={`${CHART_HEIGHT - 20}px`} />
      </Flex>
    );
  }

  if (isError) {
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
      xAxis={openPeriodMarkerResult.incidentMarkerXAxis}
      ref={openPeriodMarkerResult.connectIncidentMarkerChartRef}
    />
  );
}

export function MetricDetectorDetailsChart({
  detector,
  statsPeriod,
}: MetricDetectorDetailsChartProps) {
  const dataSource = detector.dataSources[0];
  const snubaQuery = dataSource.queryObj?.snubaQuery;

  if (!snubaQuery) {
    // Unlikely, helps narrow types
    return null;
  }

  const dataset = getDetectorDataset(snubaQuery.dataset, snubaQuery.eventTypes);
  const aggregate = snubaQuery.aggregate;
  const query = snubaQuery.query;
  const environment = snubaQuery.environment;
  const interval = snubaQuery.timeWindow;
  const conditions = detector.conditionGroup?.conditions || [];
  const detectionType = detector.config.detectionType;
  const comparisonDelta =
    detectionType === 'percent' ? detector.config.comparisonDelta : undefined;

  return (
    <ChartContainer>
      <ChartContainerBody>
        <MetricDetectorChart
          dataset={dataset}
          aggregate={aggregate}
          interval={interval}
          query={query}
          environment={environment}
          projectId={detector.projectId}
          conditions={conditions}
          detectionType={detectionType}
          statsPeriod={statsPeriod}
          comparisonDelta={comparisonDelta}
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
