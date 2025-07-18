import {BuildDetailsArtifactType, type Platform} from 'sentry/views/preprod/types';

export function formatBytes(bytes: number, isSi = false) {
  if (bytes === 0) return '0 B';
  const k = isSi ? 1000 : 1024;
  const sizes = isSi ? ['B', 'KB', 'MB', 'GB', 'TB'] : ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getPlatformFromArtifactType(
  artifactType: BuildDetailsArtifactType
): Platform {
  switch (artifactType) {
    case BuildDetailsArtifactType.XCARCHIVE:
      return 'ios';
    case BuildDetailsArtifactType.AAB:
    case BuildDetailsArtifactType.APK:
      return 'android';
    default:
      throw new Error(`Unknown artifact type: ${artifactType}`);
  }
}

export function getReadableArtifactTypeLabel(
  artifactType: BuildDetailsArtifactType
): string {
  switch (artifactType) {
    case BuildDetailsArtifactType.XCARCHIVE:
      return 'XCArchive';
    case BuildDetailsArtifactType.AAB:
      return 'AAB';
    case BuildDetailsArtifactType.APK:
      return 'APK';
    default:
      throw new Error(`Unknown artifact type: ${artifactType}`);
  }
}

export function getReadablePlatformLabel(platform: Platform): string {
  switch (platform) {
    case 'ios':
      return 'iOS';
    case 'android':
      return 'Android';
    case 'macos':
      return 'macOS';
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}
