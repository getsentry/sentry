import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {unreachable} from 'sentry/utils/unreachable';
import {SESSIONS_OPERATIONS} from 'sentry/views/dashboards/widgetBuilder/releaseWidget/fields';

/**
 * Checks if an aggregate function is a SESSIONS_OPERATION with percentage output type.
 * Session operations like crash_free_rate store as percentage (5 for 5%)
 * Other operations like failure_rate store as decimal (0.05 for 5%)
 */
export function isSessionPercentageOperation(aggregate: string): boolean {
  // Extract function name from aggregate (e.g., "crash_free_rate" from "crash_free_rate(session)")
  const match = aggregate.match(/^([^(]+)/);
  const functionName = match?.[1];

  if (!functionName) {
    return false;
  }

  const sessionOp = SESSIONS_OPERATIONS[functionName as keyof typeof SESSIONS_OPERATIONS];
  return sessionOp?.outputType === 'percentage';
}

export function getStaticDetectorThresholdSuffix(aggregate: string) {
  const type = aggregateOutputType(aggregate);
  switch (type) {
    case 'integer':
    case 'number':
    case 'string':
    case 'score':
      return '';
    case 'percentage':
      // Session operations like crash_free_rate store as percentage (5 for 5%)
      // Other operations like failure_rate store as decimal (0.05 for 5%)
      // Only show % suffix for session operations that store as percentage
      return isSessionPercentageOperation(aggregate) ? '%' : '';
    case 'duration':
      return 'ms';
    case 'size':
      return 'B';
    case 'rate':
      return '1/s';
    case 'date':
      return 'ms';
    default:
      unreachable(type);
      return '';
  }
}

export function getMetricDetectorSuffix(
  detectorType: MetricDetector['config']['detectionType'],
  aggregate: string
) {
  switch (detectorType) {
    case 'static':
    case 'dynamic':
      return getStaticDetectorThresholdSuffix(aggregate);
    case 'percent':
      return '%';
    default:
      return '';
  }
}

/**
 * Gets an appropriate placeholder value for threshold input fields.
 * Session operations like crash_free_rate store as percentage (5 for 5%)
 * Other operations like failure_rate store as decimal (0.05 for 5%)
 */
export function getStaticDetectorThresholdPlaceholder(aggregate: string): string {
  const type = aggregateOutputType(aggregate);
  if (type === 'percentage') {
    return isSessionPercentageOperation(aggregate) ? '5' : '0.05';
  }
  return '0';
}
