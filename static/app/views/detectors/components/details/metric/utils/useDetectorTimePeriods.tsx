import {useMemo} from 'react';

import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import type {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';
import {
  getTimePeriodLabel,
  MetricDetectorInterval,
  MetricDetectorTimePeriod,
} from 'sentry/views/detectors/datasetConfig/utils/timePeriods';

/** Map a detector interval in seconds to a MetricDetectorInterval (minutes). */
function mapIntervalSecondsToMetricInterval(
  intervalSeconds: number
): MetricDetectorInterval | undefined {
  const intervalMinutes = Math.floor(intervalSeconds / 60);
  const validIntervals = Object.values(MetricDetectorInterval)
    .filter(value => typeof value === 'number')
    .sort((a, b) => a - b);
  if (validIntervals.includes(intervalMinutes)) {
    return intervalMinutes;
  }
  return undefined;
}

/** Resolve a valid statsPeriod for a detector based on dataset and interval. */
function resolveStatsPeriodForDetector({
  dataset,
  intervalSeconds,
  urlStatsPeriod,
}: {
  dataset: DetectorDataset;
  intervalSeconds: number | undefined;
  urlStatsPeriod?: string;
}): MetricDetectorTimePeriod {
  if (!intervalSeconds) {
    return MetricDetectorTimePeriod.SEVEN_DAYS;
  }

  const metricInterval = mapIntervalSecondsToMetricInterval(intervalSeconds);
  if (!metricInterval) {
    return (
      (urlStatsPeriod as MetricDetectorTimePeriod) ?? MetricDetectorTimePeriod.SEVEN_DAYS
    );
  }
  const datasetConfig = getDatasetConfig(dataset);
  const allowed = datasetConfig.getTimePeriods(metricInterval);
  if (urlStatsPeriod && allowed.includes(urlStatsPeriod as MetricDetectorTimePeriod)) {
    return urlStatsPeriod as MetricDetectorTimePeriod;
  }
  const largest = allowed[allowed.length - 1];
  return largest ?? MetricDetectorTimePeriod.SEVEN_DAYS;
}

type DetectorTimePeriodOption = {
  label: React.ReactNode;
  value: MetricDetectorTimePeriod;
};

export function useDetectorTimePeriodOptions(params: {
  dataset: DetectorDataset | undefined;
  intervalSeconds: number | undefined;
}): DetectorTimePeriodOption[] {
  const {dataset, intervalSeconds} = params;

  return useMemo(() => {
    if (!dataset || !intervalSeconds) {
      return [];
    }
    const metricInterval = mapIntervalSecondsToMetricInterval(intervalSeconds);
    if (!metricInterval) {
      return [];
    }
    const datasetConfig = getDatasetConfig(dataset);
    const timePeriods = datasetConfig.getTimePeriods(metricInterval);
    return timePeriods.map(period => ({
      value: period,
      label: getTimePeriodLabel(period),
    }));
  }, [dataset, intervalSeconds]);
}

export function useDetectorResolvedStatsPeriod(params: {
  dataset: DetectorDataset | undefined;
  intervalSeconds: number | undefined;
  urlStatsPeriod?: string;
}): MetricDetectorTimePeriod {
  const {dataset, intervalSeconds, urlStatsPeriod} = params;

  return useMemo(() => {
    if (!dataset) {
      return MetricDetectorTimePeriod.SEVEN_DAYS;
    }
    return resolveStatsPeriodForDetector({
      dataset,
      intervalSeconds,
      urlStatsPeriod,
    });
  }, [dataset, intervalSeconds, urlStatsPeriod]);
}

export function useDetectorDateParams(params: {
  dataset: DetectorDataset | undefined;
  intervalSeconds: number | undefined;
  end?: string;
  start?: string;
  urlStatsPeriod?: string;
}): {end?: string; start?: string; statsPeriod?: MetricDetectorTimePeriod} {
  const {dataset, intervalSeconds, start, end, urlStatsPeriod} = params;

  return useMemo(() => {
    if (start && end) {
      return {start, end};
    }
    if (!dataset) {
      return {};
    }
    const resolved = resolveStatsPeriodForDetector({
      dataset,
      intervalSeconds,
      urlStatsPeriod,
    });
    return {statsPeriod: resolved};
  }, [dataset, intervalSeconds, start, end, urlStatsPeriod]);
}
