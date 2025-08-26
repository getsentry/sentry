import {useMemo} from 'react';
import styled from '@emotion/styled';
import type {YAXisComponentOption} from 'echarts';

import {AreaChart} from 'sentry/components/charts/areaChart';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {useChartZoom} from 'sentry/components/charts/useChartZoom';
import {Flex} from 'sentry/components/core/layout';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricDetector, SnubaQuery} from 'sentry/types/workflowEngine/detectors';
import {useLocation} from 'sentry/utils/useLocation';
import {getDetectorDataset} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {useIncidentMarkers} from 'sentry/views/detectors/hooks/useIncidentMarkers';
import {useMetricDetectorSeries} from 'sentry/views/detectors/hooks/useMetricDetectorSeries';
import {useMetricDetectorThresholdSeries} from 'sentry/views/detectors/hooks/useMetricDetectorThresholdSeries';

interface MetricDetectorDetailsChartProps {
  detector: MetricDetector;
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
  const detectionType = detector.config.detectionType;
  const comparisonDelta =
    detectionType === 'percent' ? detector.config.comparisonDelta : undefined;
  const dataset = getDetectorDataset(snubaQuery.dataset, snubaQuery.eventTypes);
  const datasetConfig = getDatasetConfig(dataset);
  const {series, comparisonSeries, isLoading, error} = useMetricDetectorSeries({
    dataset,
    aggregate: snubaQuery.aggregate,
    interval: snubaQuery.timeWindow,
    query: datasetConfig.toSnubaQueryString(snubaQuery),
    environment: snubaQuery.environment,
    projectId: detector.projectId,
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

  // TODO: Fetch open periods and transform them into the right format
  const openPeriods: any[] = [];
  const openPeriodMarkerResult = useIncidentMarkers({
    incidents: openPeriods,
    seriesName: t('Open Periods'),
    seriesId: '__incident_marker__',
    yAxisIndex: 1, // Use index 1 to avoid conflict with main chart axis
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

    if (openPeriodMarkerResult.incidentMarkerYAxis) {
      axes.push(openPeriodMarkerResult.incidentMarkerYAxis);
    }

    return axes;
  }, [maxValue, openPeriodMarkerResult.incidentMarkerYAxis]);

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

  if (error) {
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
      {...chartZoomProps}
    />
  );
}

export function MetricDetectorDetailsChart({detector}: MetricDetectorDetailsChartProps) {
  const dataSource = detector.dataSources[0];
  const snubaQuery = dataSource.queryObj?.snubaQuery;
  const location = useLocation();
  const statsPeriod = location.query?.statsPeriod as string | undefined;
  const start = location.query?.start as string | undefined;
  const end = location.query?.end as string | undefined;
  const dateParams =
    start && end ? {start, end} : statsPeriod ? {statsPeriod} : {statsPeriod: '7d'};

  if (!snubaQuery) {
    // Unlikely, helps narrow types
    return null;
  }

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
