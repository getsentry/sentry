import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {
  axisLabelFormatterUsingAggregateOutputType,
  tooltipFormatterUsingAggregateOutputType,
} from 'sentry/utils/discover/charts';
import {
  aggregateOutputType,
  type AggregationOutputType,
  type DataUnit,
} from 'sentry/utils/discover/fields';
import {isARateUnit} from 'sentry/views/dashboards/widgets/common/typePredicates';
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
        value,
        outputType,
        true,
        undefined,
        outputType === 'rate' && isARateUnit(unit) ? unit : undefined,
        undefined,
        unit as DataUnit
      );
    }
    const base = axisLabelFormatterUsingAggregateOutputType(value, outputType, true);
    return shouldAppendSuffix ? `${base}${unitSuffix}` : base;
  };

  const formatTooltipValue = (value: number): string => {
    if (unit) {
      return tooltipFormatterUsingAggregateOutputType(
        value,
        outputType,
        unit as DataUnit
      );
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
