type MetricType = 'install_size' | 'download_size';

type MeasurementType = 'absolute' | 'absolute_diff' | 'relative_diff';

type UnitType = 'MB' | '%';

export interface StatusCheckFilter {
  key: string;
  value: string;
  negated?: boolean;
}

export interface StatusCheckRule {
  id: string;
  measurement: MeasurementType;
  metric: MetricType;
  unit: UnitType;
  value: number;
  filterQuery?: string;
}

export const METRIC_OPTIONS: Array<{label: string; value: MetricType}> = [
  {label: 'Install/Uncompressed Size', value: 'install_size'},
  {label: 'Download Size', value: 'download_size'},
];

export const MEASUREMENT_OPTIONS: Array<{label: string; value: MeasurementType}> = [
  {label: 'Absolute Size', value: 'absolute'},
  {label: 'Absolute Diff', value: 'absolute_diff'},
  {label: 'Relative Diff', value: 'relative_diff'},
];

export function getMetricLabel(metric: MetricType): string {
  return METRIC_OPTIONS.find(o => o.value === metric)?.label ?? metric;
}

export function getMeasurementLabel(measurement: MeasurementType): string {
  return MEASUREMENT_OPTIONS.find(o => o.value === measurement)?.label ?? measurement;
}

export function getUnitForMeasurement(measurement: MeasurementType): UnitType {
  return measurement === 'relative_diff' ? '%' : 'MB';
}
