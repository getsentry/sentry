export type MetricType = 'install_size' | 'download_size';

export type MeasurementType = 'absolute' | 'absolute_diff' | 'relative_diff';

export interface StatusCheckFilter {
  key: string;
  value: string;
  negated?: boolean;
}

export interface StatusCheckRule {
  id: string;
  measurement: MeasurementType;
  metric: MetricType;
  value: number;
  filterQuery?: string;
}

export const METRIC_OPTIONS: Array<{label: string; value: MetricType}> = [
  {label: 'Install/Uncompressed Size', value: 'install_size'},
  {label: 'Download Size', value: 'download_size'},
];

export const MEASUREMENT_OPTIONS: Array<{
  description: string;
  label: string;
  value: MeasurementType;
}> = [
  {
    label: 'Absolute Size',
    value: 'absolute',
    description: 'Thresholds based on configured size metric.',
  },
  {
    label: 'Absolute Diff',
    value: 'absolute_diff',
    description: 'Absolute diff based on configured size metric, e.g. +10 MB',
  },
  {
    label: 'Relative Diff',
    value: 'relative_diff',
    description: 'Relative diff based on configured size metric, e.g. +10%',
  },
];

export function getMetricLabel(metric: MetricType): string {
  return METRIC_OPTIONS.find(o => o.value === metric)?.label ?? metric;
}

export function getMeasurementLabel(measurement: MeasurementType): string {
  return MEASUREMENT_OPTIONS.find(o => o.value === measurement)?.label ?? measurement;
}

export function getDisplayUnit(measurement: MeasurementType): string {
  return measurement === 'relative_diff' ? '%' : 'MB';
}

export function bytesToMB(bytes: number): number {
  return bytes / (1000 * 1000);
}

export function mbToBytes(mb: number): number {
  return mb * 1000 * 1000;
}
