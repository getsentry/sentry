import type {
  SnapshotDetailsApiResponse,
  SnapshotImage,
} from 'sentry/views/preprod/types/snapshotTypes';

export function buildSoloImages(data: SnapshotDetailsApiResponse): SnapshotImage[] {
  if (data.comparison_type === 'diff') {
    return [
      ...data.unchanged,
      ...data.changed.map(p => p.head_image),
      ...data.added,
      ...(data.renamed ?? []).map(p => p.head_image),
      ...(data.errored ?? []).map(p => p.head_image),
    ].sort((a, b) => a.image_file_name.localeCompare(b.image_file_name));
  }
  return data.images ?? [];
}
