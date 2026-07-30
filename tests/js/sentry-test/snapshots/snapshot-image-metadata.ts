/* eslint-disable unicorn/filename-case */
// Keep in sync with src/sentry/preprod/snapshots/manifest.py
export interface SnapshotImageMetadata {
  display_name: string;
  canvas_theme?: 'light' | 'dark';
  context?: {
    test_file_path: string;
  };
  group?: string | null;
  tags?: Record<string, string>;
  // Skip height, width and image_file_name as they're handled by the CLI
}

type SnapshotArea = 'core' | 'snapshots' | 'billing';

type SnapshotTags = {area: SnapshotArea} & Record<string, string>;

export interface SnapshotTestMetadata {
  display_name?: string;
  group?: string;
  tags?: SnapshotTags;
}
