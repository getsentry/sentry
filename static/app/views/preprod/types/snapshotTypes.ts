/* eslint-disable typescript-sort-keys/interface */
import type {
  BuildDetailsVcsInfo,
  SnapshotApprovalStatus,
  SnapshotComparisonState,
} from './buildDetailsTypes';

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

interface SnapshotComparisonRunInfo {
  completed_at?: string;
  duration_ms?: number;
  state?: SnapshotComparisonState;
}

interface SnapshotApprover {
  source: 'sentry' | 'github';
  approved_at?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  id?: string | null;
  name?: string | null;
  username?: string | null;
}

interface SnapshotApprovalInfo {
  approvers: SnapshotApprover[];
  status: 'approved' | 'requires_approval';
  is_auto_approved?: boolean;
}

export interface SnapshotDetailsApiResponse {
  comparison_type: 'solo' | 'diff' | 'waiting_for_base';
  head_artifact_id: string;
  image_count: number;
  images: SnapshotImage[];
  project_id: string;
  state: string;
  vcs_info: BuildDetailsVcsInfo;

  app_id?: string | null;

  comparison_run_info?: SnapshotComparisonRunInfo | null;

  approval_info?: SnapshotApprovalInfo | null;

  comparison_state?: SnapshotComparisonState | null;
  approval_status?: SnapshotApprovalStatus | null;
  comparison_error_message?: string | null;
  approvers?: SnapshotApprover[];

  diff_threshold?: number | null;

  // Diff fields
  added: SnapshotImage[];
  added_count: number;
  base_artifact_id: string | null;
  changed: SnapshotDiffPair[];
  changed_count: number;
  removed: SnapshotImage[];
  removed_count: number;
  renamed?: SnapshotDiffPair[];
  renamed_count?: number;
  unchanged: SnapshotImage[];
  unchanged_count: number;
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

interface SidebarItemBase {
  displayName: string;
  key: string;
  name: string;
}

export type SidebarItem =
  | (SidebarItemBase & {type: 'solo'; images: SnapshotImage[]})
  | (SidebarItemBase & {type: 'changed'; pairs: SnapshotDiffPair[]})
  | (SidebarItemBase & {type: 'renamed'; pairs: SnapshotDiffPair[]})
  | (SidebarItemBase & {
      type: 'added' | 'removed' | 'unchanged';
      images: SnapshotImage[];
    });
