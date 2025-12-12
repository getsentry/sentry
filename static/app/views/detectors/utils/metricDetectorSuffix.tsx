import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {unreachable} from 'sentry/utils/unreachable';

export function getStaticDetectorThresholdSuffix(aggregate: string) {
  const type = aggregateOutputType(aggregate);
  switch (type) {
    case 'integer':
    case 'number':
    case 'string':
    case 'score':
      return '';
    case 'percentage':
      return '%';
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
