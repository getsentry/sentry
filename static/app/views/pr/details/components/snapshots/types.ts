export interface SnapshotDiff {
  baseSnapshot: Snapshot;
  headSnapshot: Snapshot;
  height: number;
  ignored: boolean | null | undefined;
  width: number;
  diff?: number | null | undefined;
  diffImageInfo?: {
    imageUrl: string;
  } | null;
}

export interface Snapshot {
  height: number;
  id: string;
  identifier: string;
  imageUrl: string;
  s3Prefix: string | null | undefined;
  subtitle: string | null | undefined;
  title: string;
  width: number;
  appStoreSnapshot?: boolean | null | undefined;
  isDarkMode?: boolean;
}

export interface SnapshotDiffResponse {
  added: SnapshotDiff[];
  addedCount: number;
  changed: SnapshotDiff[];
  changedCount: number;
  errors: SnapshotDiff[];
  errorsCount: number;
  removed: SnapshotDiff[];
  removedCount: number;
  status: 'processing' | 'success' | 'error';
  unchanged: Snapshot[];
  unchangedCount: number;
  baseUploadMetadata?: {
    name: string;
    sha: string;
    version: string;
  };
  headUploadMetadata?: {
    name: string;
    sha: string;
    version: string;
  };
  message?: string;
}
