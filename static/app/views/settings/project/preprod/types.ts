const ALL_METRIC_TYPES = ['install_size', 'download_size'] as const;

export type MetricType = (typeof ALL_METRIC_TYPES)[number];

const ALL_THRESHOLD_TYPES = [
  'absolute_threshold',
  'absolute_diff',
  'relative_diff',
] as const;

export type ThresholdType = (typeof ALL_THRESHOLD_TYPES)[number];

export const ALL_ARTIFACT_TYPES = [
  'all_artifacts',
  'main_artifact',
  'watch_artifact',
  'android_dynamic_feature_artifact',
  'app_clip_artifact',
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
  measurement: ThresholdType;
  metric: MetricType;
  value: number;
  artifactType?: ArtifactType;
  filterQuery?: string;
}

export const DEFAULT_METRIC_TYPE: MetricType = 'install_size';

const METRIC_LABELS: Record<MetricType, string> = {
  install_size: 'Install/Uncompressed Size',
  download_size: 'Download Size',
};

export const METRIC_OPTIONS: Array<{label: string; value: MetricType}> =
  ALL_METRIC_TYPES.map(value => ({
    label: METRIC_LABELS[value],
    value,
  }));

export const DEFAULT_THRESHOLD_TYPE: ThresholdType = 'absolute_threshold';

const THRESHOLD_TYPE_LABELS: Record<ThresholdType, string> = {
  absolute_threshold: 'Absolute Size',
  absolute_diff: 'Absolute Diff',
  relative_diff: 'Relative Diff',
};

export const THRESHOLD_TYPE_OPTIONS: Array<{
  description: string;
  label: string;
  value: ThresholdType;
}> = [
  {
    label: 'Absolute Size',
    value: 'absolute_threshold',
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

const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  all_artifacts: 'All Artifact Types',
  main_artifact: 'Main App',
  watch_artifact: 'Watch App',
  android_dynamic_feature_artifact: 'Android Dynamic Feature',
  app_clip_artifact: 'App Clip',
};

export const ARTIFACT_TYPE_OPTIONS: Array<{label: string; value: ArtifactType}> =
  ALL_ARTIFACT_TYPES.map(value => ({
    label: ARTIFACT_TYPE_LABELS[value],
    value,
  }));

export function getMetricLabel(metric: MetricType): string {
  return METRIC_LABELS[metric];
}

export function getThresholdTypeLabel(measurement: ThresholdType): string {
  return THRESHOLD_TYPE_LABELS[measurement];
}

function getSafeValue<T>(value: unknown, validOptions: readonly T[], fallback: T): T {
  return validOptions.includes(value as T) ? (value as T) : fallback;
}

export function toMetricType(
  value: unknown,
  fallback: MetricType = DEFAULT_METRIC_TYPE
): MetricType {
  return getSafeValue(value, ALL_METRIC_TYPES, fallback);
}

export function toThresholdType(
  value: unknown,
  fallback: ThresholdType = DEFAULT_THRESHOLD_TYPE
): ThresholdType {
  return getSafeValue(value, ALL_THRESHOLD_TYPES, fallback);
}

export function toArtifactType(
  value: unknown,
  fallback: ArtifactType = DEFAULT_ARTIFACT_TYPE
): ArtifactType {
  return getSafeValue(value, ALL_ARTIFACT_TYPES, fallback);
}

export function getArtifactTypeLabel(artifactType: ArtifactType | undefined): string {
  return ARTIFACT_TYPE_LABELS[artifactType ?? DEFAULT_ARTIFACT_TYPE];
}

export function getDisplayUnit(measurement: ThresholdType): string {
  return measurement === 'relative_diff' ? '%' : 'MB';
}

export function bytesToMB(bytes: number): number {
  return bytes / (1000 * 1000);
}

export function mbToBytes(mb: number): number {
  return mb * 1000 * 1000;
}
