import {DURATION_UNITS} from 'sentry/utils/discover/fieldRenderers';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import getDuration from 'sentry/utils/duration/getDuration';
import {VitalState} from 'sentry/views/performance/vitalDetail/utils';

const formatMetricValue = (metric: MetricValue): string => {
  if (typeof metric.value === 'number' && metric.type === 'duration' && metric.unit) {
    const seconds =
      (metric.value * ((metric.unit && DURATION_UNITS[metric.unit]) ?? 1)) / 1000;
    return getDuration(seconds, 2, true);
  }

  if (typeof metric.value === 'number' && metric.type === 'number') {
    return metric.value.toFixed(2);
  }

  return String(metric.value);
};

// maps to PERFORMANCE_SCORE_COLORS keys
export enum PerformanceScore {
  GOOD = 'good',
  NEEDS_IMPROVEMENT = 'needsImprovement',
  BAD = 'bad',
  NONE = 'none',
}

export type VitalStatus = {
  description: string | undefined;
  formattedValue: string | undefined;
  score: PerformanceScore;
  value: MetricValue | undefined;
};

export type VitalItem = {
  dataset: DiscoverDatasets;
  description: string;
  docs: React.ReactNode;
  field: string;
  getStatus: (value: MetricValue) => VitalStatus;
  platformDocLinks: Record<string, string>;
  sdkDocLinks: Record<string, string>;
  setup: React.ReactNode | undefined;
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
  formattedValue: undefined,
  value: undefined,
  score: PerformanceScore.NONE,
};

export function getColdAppStartPerformance(metric: MetricValue): VitalStatus {
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
    value: metric,
    formattedValue: formatMetricValue(metric),
    score: status,
    description: description,
  };
}

export function getWarmAppStartPerformance(metric: MetricValue): VitalStatus {
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
    value: metric,
    formattedValue: formatMetricValue(metric),
    score: status,
    description: description,
  };
}

export function getDefaultMetricPerformance(metric: MetricValue): VitalStatus {
  return {
    description: undefined,
    formattedValue: formatMetricValue(metric),
    value: metric,
    score: PerformanceScore.NONE,
  };
}
