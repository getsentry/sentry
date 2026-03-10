// Keep in sync with src/sentry/preprod/snapshots/manifest.py
export interface SnapshotImageMetadata {
  display_name: string;
  // Skip height, width and image_file_name as they're handled by the CLI
}
