type MetricType = 'install_size' | 'download_size';

type MeasurementType = 'absolute' | 'absolute_diff' | 'relative_diff';

export type ArtifactType =
  | 'main_artifact'
  | 'watch_artifact'
  | 'android_dynamic_feature_artifact'
  | 'all_artifacts';

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
  artifactType?: ArtifactType;
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

export const ARTIFACT_TYPE_OPTIONS: Array<{label: string; value: ArtifactType}> = [
  {label: 'All Artifact Types', value: 'all_artifacts'},
  {label: 'Main App', value: 'main_artifact'},
  {label: 'Watch App', value: 'watch_artifact'},
  {label: 'Android Dynamic Feature', value: 'android_dynamic_feature_artifact'},
];

export function getMetricLabel(metric: MetricType): string {
  return METRIC_OPTIONS.find(o => o.value === metric)?.label ?? metric;
}

export function getMeasurementLabel(measurement: MeasurementType): string {
  return MEASUREMENT_OPTIONS.find(o => o.value === measurement)?.label ?? measurement;
}

export function getArtifactTypeLabel(artifactType: ArtifactType | undefined): string {
  return (
    ARTIFACT_TYPE_OPTIONS.find(option => option.value === artifactType)?.label ??
    'Main App'
  );
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
