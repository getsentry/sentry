import {useMemo} from 'react';

import {AreaChart} from 'sentry/components/charts/areaChart';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {Flex} from 'sentry/components/core/layout';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import type {MetricDetectorConfig} from 'sentry/types/workflowEngine/detectors';
import {TimePeriod} from 'sentry/views/alerts/rules/metric/types';
import type {DetectorDataset} from 'sentry/views/detectors/components/forms/metric/metricFormData';
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
   * The time period for the chart data (optional, defaults to 7d)
   */
  statsPeriod: TimePeriod;
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
}: MetricDetectorChartProps) {
  const {series, comparisonSeries, isPending, isError} = useMetricDetectorSeries({
    dataset,
    aggregate,
    interval,
    query,
    environment,
    projectId,
    statsPeriod,
    comparisonDelta,
  });

  const {maxValue: thresholdMaxValue, additionalSeries} =
    useMetricDetectorThresholdSeries({
      conditions,
      detectionType,
      comparisonSeries,
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

  if (isPending) {
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
      yAxis={{
        max: maxValue > 0 ? maxValue : undefined,
        min: 0,
        axisLabel: {
          // Hide the maximum y-axis label to avoid showing arbitrary threshold values
          showMaxLabel: false,
        },
        // Disable the y-axis grid lines
        splitLine: {show: false},
      }}
      grid={{
        left: space(0.25),
        right: space(0.25),
        top: space(1.5),
        bottom: space(1),
      }}
    />
  );
}
