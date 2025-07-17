import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {unreachable} from 'sentry/utils/unreachable';

export function getStaticDetectorThresholdSuffix(aggregate: string) {
  const type = aggregateOutputType(aggregate);
  switch (type) {
    case 'integer':
    case 'number':
    case 'string':
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

export function getMetricDetectorSuffix(detector: MetricDetector) {
  switch (detector.config.detectionType) {
    case 'static':
    case 'dynamic':
      if (
        detector.dataSources?.[0]?.type === 'snuba_query_subscription' &&
        detector.dataSources[0].queryObj?.snubaQuery?.aggregate
      ) {
        return getStaticDetectorThresholdSuffix(
          detector.dataSources[0].queryObj.snubaQuery.aggregate
        );
      }
      return 'ms';
    case 'percent':
      return '%';
    default:
      return '';
  }
}
