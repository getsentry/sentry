import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import color from 'color';

import type {AreaChartSeries} from 'sentry/components/charts/areaChart';
import {AreaChart} from 'sentry/components/charts/areaChart';
import MarkArea from 'sentry/components/charts/components/markArea';
import MarkLine from 'sentry/components/charts/components/markLine';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {Flex} from 'sentry/components/core/layout';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCondition} from 'sentry/types/workflowEngine/dataConditions';
import {
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {DetectorDataset} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {DETECTOR_DATASET_TO_DISCOVER_DATASET_MAP} from 'sentry/views/detectors/datasetConfig/utils/discoverDatasetMap';

const CHART_HEIGHT = 150;

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

function createThresholdSeries(lineColor: string, threshold: number): AreaChartSeries {
  return {
    seriesName: 'Threshold Line',
    type: 'line',
    markLine: MarkLine({
      silent: true,
      lineStyle: {color: lineColor, type: 'dashed', width: 1},
      data: [{yAxis: threshold}],
      label: {
        show: false,
      },
    }),
    data: [],
  };
}

function createThresholdAreaSeries(
  areaColor: string,
  threshold: number,
  isAbove: boolean
): AreaChartSeries {
  // Highlight the "safe" area - opposite of the alert condition
  const yAxis = isAbove
    ? [{yAxis: 'min'}, {yAxis: threshold}]
    : [{yAxis: threshold}, {yAxis: 'max'}];

  return {
    seriesName: 'Threshold Area',
    type: 'line',
    markArea: MarkArea({
      silent: true,
      itemStyle: {
        color: color(areaColor).alpha(0.1).rgb().string(),
      },
      data: [yAxis as any],
    }),
    data: [],
  };
}

/**
 * Extracts threshold information from condition group
 */
function extractThresholdsFromConditions(conditions: Array<Omit<DataCondition, 'id'>>): {
  thresholds: Array<{
    priority: DetectorPriorityLevel;
    type: DataConditionType;
    value: number;
  }>;
} {
  const thresholds = conditions
    .filter(condition => condition.conditionResult !== DetectorPriorityLevel.OK)
    .map(condition => ({
      value: condition.comparison,
      priority: condition.conditionResult || DetectorPriorityLevel.MEDIUM,
      type: condition.type,
    }))
    .sort((a, b) => a.value - b.value); // Sort by threshold value

  return {thresholds};
}

type UseMetricDetectorSeriesProps = Pick<
  MetricDetectorChartProps,
  'dataset' | 'aggregate' | 'interval' | 'query' | 'environment' | 'projectId'
>;

function useMetricDetectorSeries({
  dataset,
  aggregate,
  interval,
  query,
  environment,
  projectId,
}: UseMetricDetectorSeriesProps) {
  const organization = useOrganization();
  const datasetConfig = useMemo(() => getDatasetConfig(dataset), [dataset]);
  const seriesQueryOptions = datasetConfig.getSeriesQueryOptions({
    organization,
    aggregate,
    interval,
    query,
    environment: environment || '',
    projectId,
    dataset: DETECTOR_DATASET_TO_DISCOVER_DATASET_MAP[dataset],
  });

  const {data, isPending, isError} = useApiQuery<
    Parameters<typeof datasetConfig.transformSeriesQueryData>[0]
  >(seriesQueryOptions, {
    // 5 minutes
    staleTime: 5 * 60 * 1000,
  });

  const series = useMemo(() => {
    // TypeScript can't infer that each dataset config expects its own specific response type
    return datasetConfig.transformSeriesQueryData(data as any, aggregate);
  }, [datasetConfig, data, aggregate]);

  return {series, isPending, isError};
}

export function MetricDetectorChart({
  dataset,
  aggregate,
  interval,
  query,
  environment,
  projectId,
  conditions,
}: MetricDetectorChartProps) {
  const theme = useTheme();

  const {series, isPending, isError} = useMetricDetectorSeries({
    dataset,
    aggregate,
    interval,
    query,
    environment,
    projectId,
  });

  // Extract thresholds from condition group
  const {thresholds} = extractThresholdsFromConditions(conditions);

  // Calculate y-axis bounds to ensure all thresholds are visible
  const yAxisBounds = useMemo(() => {
    const thresholdValues = thresholds.map(threshold => threshold.value);

    // Get series data bounds
    const seriesData = series[0]?.data || [];
    const seriesValues = seriesData.map(point => point.value).filter(val => !isNaN(val));

    // Calculate bounds including thresholds
    const allValues = [...seriesValues, ...thresholdValues];
    const min = allValues.length > 0 ? Math.min(...allValues) : 0;
    const max = allValues.length > 0 ? Math.max(...allValues) : 0;

    // Add some padding to the bounds
    const padding = (max - min) * 0.1;
    const paddedMin = Math.max(0, min - padding);
    const paddedMax = max + padding;

    return {
      min: Math.round(paddedMin),
      max: Math.round(paddedMax),
      hasThresholds: thresholdValues.length > 0,
    };
  }, [series, thresholds]);

  // Create threshold series
  const thresholdSeries = useMemo(() => {
    const additionalSeries: AreaChartSeries[] = [];

    thresholds.forEach(threshold => {
      const isAbove = threshold.type === DataConditionType.GREATER;

      // Determine color based on priority level
      const lineColor =
        threshold.priority === DetectorPriorityLevel.HIGH
          ? theme.red300
          : theme.yellow300;
      const areaColor = lineColor;

      // Add threshold line
      additionalSeries.push(createThresholdSeries(lineColor, threshold.value));

      // Add threshold area - highlight the area that triggers the alert
      additionalSeries.push(
        createThresholdAreaSeries(areaColor, threshold.value, isAbove)
      );
    });

    return additionalSeries;
  }, [thresholds, theme]);

  if (isPending) {
    return (
      <ChartContainer>
        <Flex style={{height: CHART_HEIGHT}} justify="center" align="center">
          <Placeholder height={`${CHART_HEIGHT - 20}px`} />
        </Flex>
      </ChartContainer>
    );
  }

  if (isError) {
    return (
      <ChartContainer>
        <Flex style={{height: CHART_HEIGHT}} justify="center" align="center">
          <ErrorPanel>
            <IconWarning color="gray300" size="lg" />
            <div>{t('Error loading chart data')}</div>
          </ErrorPanel>
        </Flex>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer>
      <AreaChart
        series={[...series, ...thresholdSeries]}
        height={CHART_HEIGHT}
        stacked={false}
        isGroupedByDate
        showTimeInTooltip
        yAxis={{
          min: yAxisBounds.hasThresholds ? yAxisBounds.min : undefined,
          max: yAxisBounds.hasThresholds ? yAxisBounds.max : undefined,
          axisLabel: {
            // Hide the maximum y-axis label to avoid showing arbitrary threshold values
            showMaxLabel: false,
          },
        }}
        grid={{
          left: space(0.25),
          right: space(0.5),
          top: space(1),
          bottom: space(1),
        }}
      />
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  max-width: 1440px;
  border-top: 1px solid ${p => p.theme.border};
`;
