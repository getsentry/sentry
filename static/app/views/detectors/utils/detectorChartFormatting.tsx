import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {
  axisLabelFormatterUsingAggregateOutputType,
  tooltipFormatterUsingAggregateOutputType,
} from 'sentry/utils/discover/charts';
import {
  aggregateOutputType,
  DURATION_UNIT_MULTIPLIERS,
  SizeUnit,
  type AggregationOutputType,
  type DataUnit,
  type DurationUnit,
  type RateUnit,
} from 'sentry/utils/discover/fields';
import {getMetricDetectorSuffix} from 'sentry/views/detectors/utils/metricDetectorSuffix';

type DetectionType = MetricDetector['config']['detectionType'];

interface DetectorChartFormatterOptions {
  aggregate: string;
  detectionType: DetectionType;
  serverOutputType?: AggregationOutputType;
  unit?: string | null;
}

export function getDetectorChartFormatters({
  detectionType,
  aggregate,
  unit,
  serverOutputType,
}: DetectorChartFormatterOptions) {
  const clientOutputType = aggregateOutputType(aggregate);
  // Prefer the server-reported output type over client inference, since the
  // server reported type is more accurate.
  const outputType = serverOutputType ?? clientOutputType;
  const unitSuffix = getMetricDetectorSuffix(detectionType, aggregate);

  // For % change detection, the primary series shows actual metric values (counts, durations, etc.)
  // The % suffix is only for threshold display, not for y-axis/tooltip formatting
  const shouldAppendSuffix =
    detectionType !== 'percent' && (outputType === 'number' || outputType === 'integer');

  const formatYAxisLabel = (value: number): string => {
    if (unit) {
      return axisLabelFormatterUsingAggregateOutputType(
        outputType === 'duration'
          ? value * (DURATION_UNIT_MULTIPLIERS[unit as DurationUnit] ?? 1)
          : value,
        outputType,
        true,
        outputType === 'duration'
          ? DURATION_UNIT_MULTIPLIERS[unit as DurationUnit]
          : undefined,
        outputType === 'rate' ? (unit as RateUnit) : undefined,
        undefined,
        outputType === 'size' ? (unit as SizeUnit) : undefined
      );
    }
    const base = axisLabelFormatterUsingAggregateOutputType(value, outputType, true);
    return shouldAppendSuffix ? `${base}${unitSuffix}` : base;
  };

  const formatTooltipValue = (value: number): string => {
    if (unit) {
      if (outputType === 'size' || outputType === 'rate') {
        return tooltipFormatterUsingAggregateOutputType(
          value,
          outputType,
          unit as DataUnit
        );
      }
      if (outputType === 'duration') {
        // Convert value from the API's duration unit to milliseconds,
        // since the formatter expects ms input
        const msPerUnit = DURATION_UNIT_MULTIPLIERS[unit as DurationUnit] ?? 1;
        const valueInMs = value * msPerUnit;
        return tooltipFormatterUsingAggregateOutputType(valueInMs, outputType);
      }
    }
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
