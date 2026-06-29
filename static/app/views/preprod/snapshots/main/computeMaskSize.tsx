import type {SnapshotImage} from 'sentry/views/preprod/types/snapshotTypes';

export function computeMaskSize(
  baseImage: SnapshotImage,
  headImage: SnapshotImage
): string {
  const headW = headImage.width;
  const headH = headImage.height;
  if (!headW || !headH) {
    return '100% 100%';
  }
  const maskW = Math.max(baseImage.width || headW, headW);
  const maskH = Math.max(baseImage.height || headH, headH);
  return `${(maskW / headW) * 100}% ${(maskH / headH) * 100}%`;
}
