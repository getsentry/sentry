import {BuildDetailsArtifactType} from 'sentry/views/preprod/types/buildDetailsTypes';
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
