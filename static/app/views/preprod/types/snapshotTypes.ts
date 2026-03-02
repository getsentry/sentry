/* eslint-disable typescript-sort-keys/interface */
import type {BuildDetailsVcsInfo} from './buildDetailsTypes';

export interface SnapshotImage {
  display_name: string | null;
  image_file_name: string;
  height: number;
  key: string;
  width: number;
}

export interface SnapshotDiffPair {
  base_image: SnapshotImage;
  diff: number | null;
  diff_image_key: string | null;
  head_image: SnapshotImage;
}

export interface SnapshotComparisonRunInfo {
  completed_at?: string;
  duration_ms?: number;
  state?: ComparisonState;
}

export interface SnapshotDetailsApiResponse {
  comparison_type: 'solo' | 'diff';
  head_artifact_id: string;
  image_count: number;
  images: SnapshotImage[];
  project_id: string;
  state: string;
  vcs_info: BuildDetailsVcsInfo;

  comparison_run_info?: SnapshotComparisonRunInfo;

  // Diff fields
  added: SnapshotImage[];
  added_count: number;
  base_artifact_id: string | null;
  changed: SnapshotDiffPair[];
  changed_count: number;
  removed: SnapshotImage[];
  removed_count: number;
  renamed?: SnapshotImage[];
  renamed_count?: number;
  unchanged: SnapshotImage[];
  unchanged_count: number;
}

export type ComparisonState = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export type DiffStatus = 'changed' | 'added' | 'removed' | 'renamed' | 'unchanged';

export type SidebarItem =
  | {type: 'solo'; name: string; images: SnapshotImage[]}
  | {type: 'changed'; name: string; pair: SnapshotDiffPair}
  | {type: 'added'; name: string; image: SnapshotImage}
  | {type: 'removed'; name: string; image: SnapshotImage}
  | {type: 'renamed'; name: string; image: SnapshotImage}
  | {type: 'unchanged'; name: string; image: SnapshotImage};
