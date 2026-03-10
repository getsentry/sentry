import {android, apple} from 'sentry/data/platformCategories';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {Platform} from 'sentry/views/preprod/types/sharedTypes';

const ALL_METRIC_TYPES = ['install_size', 'download_size'] as const;
export type MetricType = (typeof ALL_METRIC_TYPES)[number];

const ALL_MEASUREMENTS = ['absolute', 'absolute_diff', 'relative_diff'] as const;

export type MeasurementType = (typeof ALL_MEASUREMENTS)[number];

export const ALL_ARTIFACT_TYPES = [
  'all_artifacts',
  'main_artifact',
  'watch_artifact',
  'android_dynamic_feature_artifact',
  'app_clip_artifact',
] as const;

export type ArtifactType = (typeof ALL_ARTIFACT_TYPES)[number];

export const DEFAULT_ARTIFACT_TYPE: ArtifactType = 'main_artifact';

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

export const DEFAULT_METRIC_TYPE: MetricType = 'install_size';

const METRIC_LABELS: Record<MetricType, string> = {
  install_size: t('Install/Uncompressed Size'),
  download_size: t('Download Size'),
};

export const METRIC_OPTIONS: Array<{label: string; value: MetricType}> =
  ALL_METRIC_TYPES.map(value => ({
    label: METRIC_LABELS[value],
    value,
  }));

export const DEFAULT_MEASUREMENT_TYPE: MeasurementType = 'absolute';

const MEASUREMENT_LABELS: Record<MeasurementType, string> = {
  absolute: t('Absolute Size'),
  absolute_diff: t('Absolute Diff'),
  relative_diff: t('Relative Diff'),
};

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

const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  all_artifacts: t('Any Artifact Type'),
  main_artifact: t('Main App'),
  watch_artifact: t('Watch App'),
  android_dynamic_feature_artifact: t('Android Dynamic Feature'),
  app_clip_artifact: t('App Clip'),
};

export const ARTIFACT_TYPE_OPTIONS: Array<{label: string; value: ArtifactType}> =
  ALL_ARTIFACT_TYPES.map(value => ({
    label: ARTIFACT_TYPE_LABELS[value],
    value,
  }));

export function guessPlatformForProject(project: Project): Platform | undefined {
  const platform = project.platform;
  if (!platform) {
    return undefined;
  }
  if (android.includes(platform)) {
    return 'android';
  }
  if (apple.includes(platform)) {
    return 'apple';
  }
  return undefined;
}

export function getMetricLabel(metric: MetricType): string {
  return METRIC_LABELS[metric];
}

export function getMetricLabelForPlatform(
  metric: MetricType,
  platform: Platform | undefined
): string {
  if (platform === 'android' && metric === 'install_size') {
    return 'Uncompressed size';
  }
  if (platform === 'apple' && metric === 'install_size') {
    return 'Install size';
  }
  return getMetricLabel(metric);
}

export function getMeasurementLabel(measurement: MeasurementType): string {
  return MEASUREMENT_LABELS[measurement];
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

export function toMeasurementType(
  value: unknown,
  fallback: MeasurementType = DEFAULT_MEASUREMENT_TYPE
): MeasurementType {
  return getSafeValue(value, ALL_MEASUREMENTS, fallback);
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

export function getDisplayUnit(measurement: MeasurementType): string {
  return measurement === 'relative_diff' ? '%' : 'MB';
}

export function bytesToMB(bytes: number): number {
  return bytes / (1000 * 1000);
}

export function mbToBytes(mb: number): number {
  return mb * 1000 * 1000;
}
