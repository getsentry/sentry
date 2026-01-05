import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {unreachable} from 'sentry/utils/unreachable';
import {
  BuildDetailsArtifactType,
  getMainArtifactSizeMetric,
  isSizeInfoCompleted,
  type BuildDetailsSizeInfo,
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
    return t('Unknown');
  }

  switch (artifactType) {
    case BuildDetailsArtifactType.XCARCHIVE:
      return t('XCode application archive');
    case BuildDetailsArtifactType.AAB:
      return t('Android app bundle');
    case BuildDetailsArtifactType.APK:
      return t('Android application package');
    default:
      throw new Error(`Unknown artifact type: ${artifactType}`);
  }
}

export interface Labels {
  appId: string;
  buildConfiguration: string;
  downloadSizeDescription: string;
  downloadSizeLabel: string;
  installSizeDescription: string;
  installSizeLabel: string;
  installUnavailableTooltip: string;
  installSizeLabelTooltip?: string;
}

export function getLabels(
  platform: Platform | undefined,
  hasMultiplePlatforms = false
): Labels {
  if (hasMultiplePlatforms) {
    return {
      installSizeLabel: t('Install Size'),
      downloadSizeLabel: t('Download Size'),
      appId: t('Bundle identifier'),
      installSizeDescription: t('Uncompressed size'),
      downloadSizeDescription: t('Bytes transferred over the network'),
      buildConfiguration: t('Build configuration'),
      installUnavailableTooltip: t('This app cannot be installed.'),
      installSizeLabelTooltip: t('Install Size for iOS; Uncompressed Size for Android'),
    };
  }

  switch (platform) {
    case 'android':
      return {
        installSizeLabel: t('Uncompressed Size'),
        downloadSizeLabel: t('Download Size'),
        appId: t('Package name'),
        installSizeDescription: t('Uncompressed size on disk not including AOT DEX'),
        downloadSizeDescription: t('Bytes transferred over the network'),
        buildConfiguration: t('Build configuration'),
        installUnavailableTooltip: t('This app cannot be installed.'),
      };
    case 'ios':
    case 'macos':
    case undefined:
      return {
        installSizeLabel: t('Install Size'),
        appId: t('Bundle identifier'),
        installSizeDescription: t('Unencrypted install size'),
        downloadSizeDescription: t('Bytes transferred over the network'),
        downloadSizeLabel: t('Download Size'),
        buildConfiguration: t('Build configuration'),
        installUnavailableTooltip: t(
          'Code signature must be valid for this app to be installed.'
        ),
      };
    default:
      return unreachable(platform);
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

export function formattedPrimaryMetricInstallSize(
  sizeInfo: BuildDetailsSizeInfo | undefined
): string {
  if (isSizeInfoCompleted(sizeInfo)) {
    const primarySizeMetric = getMainArtifactSizeMetric(sizeInfo);
    if (!primarySizeMetric) {
      return '-';
    }

    return formatBytesBase10(primarySizeMetric.install_size_bytes);
  }
  return '-';
}

export function formattedPrimaryMetricDownloadSize(
  sizeInfo: BuildDetailsSizeInfo | undefined
): string {
  if (isSizeInfoCompleted(sizeInfo)) {
    const primarySizeMetric = getMainArtifactSizeMetric(sizeInfo);
    if (!primarySizeMetric) {
      return '-';
    }

    return formatBytesBase10(primarySizeMetric.download_size_bytes);
  }
  return '-';
}

export function formattedSizeDiff(diff: number): string {
  if (diff === 0) {
    return '';
  }

  const sign = diff > 0 ? '+' : '-';
  return `${sign}${formatBytesBase10(Math.abs(diff))}`;
}

export function getTrend(diff: number): {
  variant: 'danger' | 'success' | 'muted';
  icon?: React.ReactNode;
} {
  if (diff > 0) {
    return {
      variant: 'danger',
      icon: <IconArrow direction="up" size="xs" />,
    };
  }

  if (diff < 0) {
    return {
      variant: 'success',
      icon: <IconArrow direction="down" size="xs" />,
    };
  }

  return {variant: 'muted'};
}
