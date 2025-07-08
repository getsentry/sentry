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
import {
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {DETECTOR_DATASET_TO_DISCOVER_DATASET_MAP} from 'sentry/views/detectors/datasetConfig/utils/discoverDatasetMap';

const CHART_HEIGHT = 150;

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

export function MetricDetectorPreviewChart() {
  const theme = useTheme();
  const organization = useOrganization();
  const dataset = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.dataset);
  const aggregate = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.aggregateFunction
  );
  const interval = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.interval);
  const query = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.query);
  const environment = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.environment);
  const projectId = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.projectId);

  // Threshold-related form fields
  const conditionValue = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionValue
  );
  const conditionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionType
  );
  const highThreshold = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.highThreshold
  );
  const mediumThreshold = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.mediumThreshold
  );
  const initialPriorityLevel = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.initialPriorityLevel
  );

  const datasetConfig = useMemo(() => getDatasetConfig(dataset), [dataset]);
  const seriesQueryOptions = datasetConfig.getSeriesQueryOptions({
    organization,
    aggregate,
    interval,
    query,
    environment,
    projectId: Number(projectId),
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

  // Calculate y-axis bounds to ensure all thresholds are visible
  const yAxisBounds = useMemo(() => {
    const thresholds: number[] = [];

    // Collect all valid thresholds
    if (conditionValue && conditionValue !== '') {
      const threshold = parseFloat(conditionValue);
      if (!isNaN(threshold)) {
        thresholds.push(threshold);
      }
    }
    if (highThreshold && highThreshold !== '' && highThreshold !== conditionValue) {
      const threshold = parseFloat(highThreshold);
      if (!isNaN(threshold)) {
        thresholds.push(threshold);
      }
    }
    if (mediumThreshold && mediumThreshold !== '' && mediumThreshold !== conditionValue) {
      const threshold = parseFloat(mediumThreshold);
      if (!isNaN(threshold)) {
        thresholds.push(threshold);
      }
    }

    // Get series data bounds
    const seriesData = series[0]?.data || [];
    const seriesValues = seriesData.map(point => point.value).filter(val => !isNaN(val));

    // Calculate bounds including thresholds
    const allValues = [...seriesValues, ...thresholds];
    const min = allValues.length > 0 ? Math.min(...allValues) : 0;
    const max = allValues.length > 0 ? Math.max(...allValues) : 0;

    // Add some padding to the bounds
    const padding = (max - min) * 0.1;
    const paddedMin = Math.max(0, min - padding);
    const paddedMax = max + padding;

    return {
      min: Math.round(paddedMin),
      max: Math.round(paddedMax),
      hasThresholds: thresholds.length > 0,
    };
  }, [series, conditionValue, highThreshold, mediumThreshold]);

  // Create threshold series
  const thresholdSeries = useMemo(() => {
    const additionalSeries: AreaChartSeries[] = [];

    // Add medium threshold first (lowest priority - rendered at bottom)
    if (mediumThreshold && mediumThreshold !== '' && mediumThreshold !== conditionValue) {
      const threshold = parseFloat(mediumThreshold);
      if (!isNaN(threshold)) {
        const isAbove = conditionType === DataConditionType.GREATER;
        const lineColor = theme.yellow300;
        const areaColor = theme.yellow300;

        // Add threshold line
        additionalSeries.push(createThresholdSeries(lineColor, threshold));

        // Add threshold area - highlight the area that triggers the alert
        additionalSeries.push(createThresholdAreaSeries(areaColor, threshold, isAbove));
      }
    }

    // Add main condition threshold (medium priority)
    if (conditionValue && conditionValue !== '') {
      const threshold = parseFloat(conditionValue);
      if (!isNaN(threshold)) {
        const isAbove = conditionType === DataConditionType.GREATER;
        // Main threshold color depends on initial priority level
        const lineColor =
          initialPriorityLevel === DetectorPriorityLevel.HIGH
            ? theme.red300
            : theme.yellow300;
        const areaColor = lineColor;

        // Add threshold line
        additionalSeries.push(createThresholdSeries(lineColor, threshold));

        // Add threshold area - highlight the area that triggers the alert
        additionalSeries.push(createThresholdAreaSeries(areaColor, threshold, isAbove));
      }
    }

    // Add high threshold last (highest priority - rendered on top)
    if (highThreshold && highThreshold !== '' && highThreshold !== conditionValue) {
      const threshold = parseFloat(highThreshold);
      if (!isNaN(threshold)) {
        const isAbove = conditionType === DataConditionType.GREATER;
        const lineColor = theme.red300;
        const areaColor = theme.red300;

        // Add threshold line
        additionalSeries.push(createThresholdSeries(lineColor, threshold));

        // Add threshold area - highlight the area that triggers the alert
        additionalSeries.push(createThresholdAreaSeries(areaColor, threshold, isAbove));
      }
    }

    return additionalSeries;
  }, [
    conditionValue,
    conditionType,
    highThreshold,
    mediumThreshold,
    initialPriorityLevel,
    theme,
  ]);

  if (isPending) {
    return (
      <PreviewChartContainer>
        <Flex style={{height: CHART_HEIGHT}} justify="center" align="center">
          <Placeholder height={`${CHART_HEIGHT - 20}px`} />
        </Flex>
      </PreviewChartContainer>
    );
  }

  if (isError) {
    return (
      <PreviewChartContainer>
        <Flex style={{height: CHART_HEIGHT}} justify="center" align="center">
          <ErrorPanel>
            <IconWarning color="gray300" size="lg" />
            <div>{t('Error loading chart data')}</div>
          </ErrorPanel>
        </Flex>
      </PreviewChartContainer>
    );
  }

  return (
    <PreviewChartContainer>
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
    </PreviewChartContainer>
  );
}

const PreviewChartContainer = styled('div')`
  max-width: 1440px;
  border-top: 1px solid ${p => p.theme.border};
`;
