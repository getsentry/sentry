import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {
  BuildDetailsArtifactType,
  isSizeInfoCompleted,
  type BuildDetailsApiResponse,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import type {Platform} from 'sentry/views/preprod/types/sharedTypes';

// Mapping of Launchpad platform to PlatformIcon platform
// PlatformIcon definitions: https://sentry.sentry.io/stories/foundations/icons
export function getPlatformIconFromPlatform(platform: Platform): 'apple' | 'android' {
  switch (platform) {
    case 'ios':
    case 'macos':
      return 'apple';
    case 'android':
      return 'android';
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export function getReadableArtifactTypeLabel(
  artifactType: BuildDetailsArtifactType | null
): string {
  if (artifactType === null) {
    return 'Unknown';
  }

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

export function getReadableArtifactTypeTooltip(
  artifactType: BuildDetailsArtifactType | null
): string {
  if (artifactType === null) {
    return 'Unknown';
  }

  switch (artifactType) {
    case BuildDetailsArtifactType.XCARCHIVE:
      return 'XCode application archive';
    case BuildDetailsArtifactType.AAB:
      return 'Android app bundle';
    case BuildDetailsArtifactType.APK:
      return 'Android application package';
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

export function formattedInstallSize(build: BuildDetailsApiResponse): string {
  if (isSizeInfoCompleted(build?.size_info)) {
    return formatBytesBase10(build.size_info.install_size_bytes);
  }
  return '-';
}

export function formattedDownloadSize(build: BuildDetailsApiResponse): string {
  if (isSizeInfoCompleted(build?.size_info)) {
    return formatBytesBase10(build.size_info.download_size_bytes);
  }
  return '-';
}
