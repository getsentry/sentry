type MetricType = 'install_size' | 'download_size';

type MeasurementType = 'absolute' | 'absolute_diff' | 'relative_diff';

export const ALL_ARTIFACT_TYPES = [
  'all_artifacts',
  'main_artifact',
  'watch_artifact',
  'android_dynamic_feature_artifact',
] as const;

export type ArtifactType = (typeof ALL_ARTIFACT_TYPES)[number];

export const DEFAULT_ARTIFACT_TYPE: ArtifactType = 'main_artifact';
export const ALL_ARTIFACTS_ARTIFACT_TYPE: ArtifactType = 'all_artifacts';

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

export const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  all_artifacts: 'All Artifact Types',
  main_artifact: 'Main App',
  watch_artifact: 'Watch App',
  android_dynamic_feature_artifact: 'Android Dynamic Feature',
};

export const ARTIFACT_TYPE_OPTIONS: Array<{label: string; value: ArtifactType}> =
  ALL_ARTIFACT_TYPES.map(value => ({
    label: ARTIFACT_TYPE_LABELS[value],
    value,
  }));

export function getMetricLabel(metric: MetricType): string {
  return METRIC_OPTIONS.find(o => o.value === metric)?.label ?? metric;
}

export function getMeasurementLabel(measurement: MeasurementType): string {
  return MEASUREMENT_OPTIONS.find(o => o.value === measurement)?.label ?? measurement;
}

export function getSafeValue<T>(
  value: unknown,
  validOptions: readonly T[],
  fallback: T
): T {
  return validOptions.includes(value as T) ? (value as T) : fallback;
}

export function toArtifactType(
  value: unknown,
  fallback: ArtifactType = DEFAULT_ARTIFACT_TYPE
): ArtifactType {
  return getSafeValue(value, ALL_ARTIFACT_TYPES, fallback);
}

export function getArtifactTypeLabel(artifactType: ArtifactType | undefined): string {
  return ARTIFACT_TYPE_LABELS[toArtifactType(artifactType)];
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
