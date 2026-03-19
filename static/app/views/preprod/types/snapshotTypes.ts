/* eslint-disable typescript-sort-keys/interface */
import type {BuildDetailsVcsInfo} from './buildDetailsTypes';

export interface SnapshotImage {
  display_name: string | null;
  image_file_name: string;
  group?: string | null;
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

  comparison_run_info?: SnapshotComparisonRunInfo | null;

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

export enum ComparisonState {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export enum DiffStatus {
  CHANGED = 'changed',
  ADDED = 'added',
  REMOVED = 'removed',
  RENAMED = 'renamed',
  UNCHANGED = 'unchanged',
}

export function getImageName(image: SnapshotImage): string {
  return image.display_name ?? image.image_file_name;
}

export function getImageGroup(image: SnapshotImage): string {
  return image.group ?? getImageName(image);
}

interface SidebarItemBase {
  badge: string | null;
  key: string;
  name: string;
}

export type SidebarItem =
  | (SidebarItemBase & {type: 'solo'; images: SnapshotImage[]})
  | (SidebarItemBase & {type: 'changed'; pairs: SnapshotDiffPair[]})
  | (SidebarItemBase & {
      type: 'added' | 'removed' | 'renamed' | 'unchanged';
      images: SnapshotImage[];
    });
