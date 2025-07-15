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
import type {DetectorDataset} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {useMetricDetectorSeries} from 'sentry/views/detectors/hooks/useMetricDetectorSeries';
import {useMetricDetectorThresholdSeries} from 'sentry/views/detectors/hooks/useMetricDetectorThresholdSeries';

const CHART_HEIGHT = 165;

interface MetricDetectorChartProps {
  /**
   * The aggregate function to use (e.g., "avg(span.duration)")
   */
  aggregate: string;
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
}: MetricDetectorChartProps) {
  const {series, isPending, isError} = useMetricDetectorSeries({
    dataset,
    aggregate,
    interval,
    query,
    environment,
    projectId,
  });

  const {series: thresholdSeries, maxValue: thresholdMaxValue} =
    useMetricDetectorThresholdSeries({
      conditions,
      detectionType,
    });

  // Calculate y-axis bounds to ensure all thresholds are visible
  const yAxisBounds = useMemo((): {max: number | undefined; min: number | undefined} => {
    if (thresholdMaxValue === undefined) {
      return {min: undefined, max: undefined};
    }
    // Get series data bounds
    const seriesData = series[0]?.data || [];
    const seriesValues = seriesData.map(point => point.value).filter(val => !isNaN(val));

    // Calculate bounds including thresholds
    const allValues = [...seriesValues, thresholdMaxValue];
    const min = allValues.length > 0 ? Math.min(...allValues) : 0;
    const max = allValues.length > 0 ? Math.max(...allValues) : 0;

    // Add some padding to the bounds
    const padding = (max - min) * 0.1;
    const paddedMin = Math.max(0, min - padding);
    const paddedMax = max + padding;

    return {
      min: Math.round(paddedMin),
      max: Math.round(paddedMax),
    };
  }, [series, thresholdMaxValue]);

  const mergedSeries = useMemo(() => {
    return [...series, ...thresholdSeries];
  }, [series, thresholdSeries]);

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
      series={mergedSeries}
      yAxis={{
        min: yAxisBounds.min,
        max: yAxisBounds.max,
        axisLabel: {
          // Hide the maximum y-axis label to avoid showing arbitrary threshold values
          showMaxLabel: false,
        },
      }}
      grid={{
        left: space(0.25),
        right: space(0.5),
        top: space(0.5),
        bottom: space(1),
      }}
    />
  );
}
