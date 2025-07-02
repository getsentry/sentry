import type {Detector} from 'sentry/types/workflowEngine/detectors';
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

export function getMetricDetectorSuffix(detector: Detector) {
  // TODO: Use a MetricDetector type to avoid checking for this
  if (!('detection_type' in detector.config)) {
    return '';
  }

  switch (detector.config.detection_type) {
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
