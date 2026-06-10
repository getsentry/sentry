export type MetricType = 'install_size' | 'download_size';

export type MeasurementType = 'absolute' | 'absolute_diff' | 'relative_diff';

export type ArtifactType =
  | 'all_artifacts'
  | 'main_artifact'
  | 'watch_artifact'
  | 'android_dynamic_feature_artifact'
  | 'app_clip_artifact';

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
