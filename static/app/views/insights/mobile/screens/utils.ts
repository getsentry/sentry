import {DURATION_UNITS} from 'sentry/utils/discover/fieldRenderers';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {VitalState} from 'sentry/views/performance/vitalDetail/utils';

// maps to PERFORMANCE_SCORE_COLORS keys
export enum PerformanceScore {
  GOOD = 'good',
  NEEDS_IMPROVEMENT = 'needsImprovement',
  BAD = 'bad',
  NONE = 'none',
}

export type VitalStatus = {
  description: string | undefined;
  score: PerformanceScore;
};

export type VitalItem = {
  dataset: DiscoverDatasets;
  description: string;
  field: string;
  getStatus: (value: MetricValue) => VitalStatus;
  title: string;
};

export type MetricValue = {
  // the field type if defined, e.g. duration
  type: string | undefined;

  // the unit of the value, e.g. milliseconds
  unit: string | undefined;

  // the actual value
  value: string | number | undefined;
};

export const STATUS_UNKNOWN: VitalStatus = {
  description: undefined,
  score: PerformanceScore.NONE,
};

export function getColdAppStartPerformance(metric: MetricValue) {
  let description = '';
  let status = PerformanceScore.NONE;

  if (typeof metric.value === 'number' && metric.unit) {
    const durationMs = metric.value * DURATION_UNITS[metric.unit];

    // TODO should be platform dependant
    if (durationMs > 5000) {
      status = PerformanceScore.BAD;
      description = VitalState.POOR;
    } else if (durationMs > 3000) {
      status = PerformanceScore.NEEDS_IMPROVEMENT;
      description = VitalState.MEH;
    } else if (durationMs > 0) {
      status = PerformanceScore.GOOD;
      description = VitalState.GOOD;
    }
  }
  return {
    score: status,
    description: description,
  };
}

export function getWarmAppStartPerformance(metric: MetricValue) {
  let description = '';
  let status = PerformanceScore.NONE;

  if (typeof metric.value === 'number' && metric.unit) {
    const durationMs = metric.value * DURATION_UNITS[metric.unit];

    // TODO should be platform dependant
    if (durationMs > 2000) {
      status = PerformanceScore.BAD;
      description = VitalState.POOR;
    } else if (durationMs > 1000) {
      status = PerformanceScore.NEEDS_IMPROVEMENT;
      description = VitalState.MEH;
    } else if (durationMs > 0) {
      status = PerformanceScore.GOOD;
      description = VitalState.GOOD;
    }
  }
  return {
    score: status,
    description: description,
  };
}

export function getDefaultMetricPerformance(_: MetricValue) {
  return STATUS_UNKNOWN;
}
