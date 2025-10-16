import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {
  axisLabelFormatterUsingAggregateOutputType,
  tooltipFormatterUsingAggregateOutputType,
} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {getMetricDetectorSuffix} from 'sentry/views/detectors/utils/metricDetectorSuffix';

type DetectionType = MetricDetector['config']['detectionType'];

interface DetectorChartFormatterOptions {
  aggregate: string;
  detectionType: DetectionType;
}

export function getDetectorChartFormatters({
  detectionType,
  aggregate,
}: DetectorChartFormatterOptions) {
  const outputType =
    detectionType === 'percent' ? 'percentage' : aggregateOutputType(aggregate);
  const unitSuffix = getMetricDetectorSuffix(detectionType, aggregate);

  const formatYAxisLabel = (value: number): string => {
    const base = axisLabelFormatterUsingAggregateOutputType(value, outputType, true);
    return outputType === 'number' || outputType === 'integer'
      ? `${base}${unitSuffix}`
      : base;
  };

  const formatTooltipValue = (value: number): string => {
    const base = tooltipFormatterUsingAggregateOutputType(value, outputType);
    return outputType === 'number' || outputType === 'integer'
      ? `${base}${unitSuffix}`
      : base;
  };

  return {
    outputType,
    unitSuffix,
    formatYAxisLabel,
    formatTooltipValue,
  };
}
