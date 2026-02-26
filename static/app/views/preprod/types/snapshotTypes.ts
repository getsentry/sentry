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

export interface SnapshotDetailsApiResponse {
  comparison_type: 'solo' | 'diff';
  head_artifact_id: string;
  image_count: number;
  images: SnapshotImage[];
  state: string;
  vcs_info: BuildDetailsVcsInfo;

  // Diff fields
  added: SnapshotImage[];
  added_count: number;
  base_artifact_id: string | null;
  changed: SnapshotDiffPair[];
  changed_count: number;
  removed: SnapshotImage[];
  removed_count: number;
  unchanged: SnapshotImage[];
  unchanged_count: number;
}
