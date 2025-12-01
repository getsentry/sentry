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
  const outputType = aggregateOutputType(aggregate);
  const unitSuffix = getMetricDetectorSuffix(detectionType, aggregate);

  // For % change detection, the primary series shows actual metric values (counts, durations, etc.)
  // The % suffix is only for threshold display, not for y-axis/tooltip formatting
  const shouldAppendSuffix =
    detectionType !== 'percent' && (outputType === 'number' || outputType === 'integer');

  const formatYAxisLabel = (value: number): string => {
    const base = axisLabelFormatterUsingAggregateOutputType(value, outputType, true);
    return shouldAppendSuffix ? `${base}${unitSuffix}` : base;
  };

  const formatTooltipValue = (value: number): string => {
    const base = tooltipFormatterUsingAggregateOutputType(value, outputType);
    return shouldAppendSuffix ? `${base}${unitSuffix}` : base;
  };

  return {
    outputType,
    unitSuffix,
    formatYAxisLabel,
    formatTooltipValue,
  };
}
