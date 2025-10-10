import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {CodeBlock} from 'sentry/components/core/code';
import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconClock, IconFile, IconJson, IconLink, IconMobile} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {getFormattedDate} from 'sentry/utils/dates';
import {unreachable} from 'sentry/utils/unreachable';
import {openInstallModal} from 'sentry/views/preprod/components/installModal';
import {
  BuildDetailsSizeAnalysisState,
  type BuildDetailsAppInfo,
  type BuildDetailsSizeInfo,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import type {Platform} from 'sentry/views/preprod/types/sharedTypes';
import {
  getPlatformIconFromPlatform,
  getReadableArtifactTypeLabel,
  getReadableArtifactTypeTooltip,
  getReadablePlatformLabel,
} from 'sentry/views/preprod/utils/labelUtils';

interface Labels {
  appId: string;
  buildConfiguration: string;
  downloadSize: string;
  installSize: string;
  installSizeText: string;
  installUnavailableTooltip: string;
}

function getLabels(platform: Platform | undefined): Labels {
  switch (platform) {
    case 'android':
      return {
        installSizeText: t('Uncompressed Size'),
        appId: t('Package name'),
        installSize: t('Size on disk not including AOT DEX'),
        downloadSize: t('Bytes transferred over the network'),
        buildConfiguration: t('Build configuration'),
        installUnavailableTooltip: t('This app cannot be installed.'),
      };
    case 'ios':
    case 'macos':
    case undefined:
      return {
        installSizeText: t('Install Size'),
        appId: t('Bundle identifier'),
        installSize: t('Unencrypted install size'),
        downloadSize: t('Bytes transferred over the network'),
        buildConfiguration: t('Build configuration'),
        installUnavailableTooltip: t(
          'Code signature must be valid for this app to be installed.'
        ),
      };
    default:
      return unreachable(platform);
  }
}

interface BuildDetailsSidebarAppInfoProps {
  appInfo: BuildDetailsAppInfo;
  artifactId: string;
  projectId: string | null;
  sizeInfo?: BuildDetailsSizeInfo;
}

export function BuildDetailsSidebarAppInfo(props: BuildDetailsSidebarAppInfoProps) {
  const labels = getLabels(props.appInfo.platform ?? undefined);

  return (
    <Flex direction="column" gap="xl">
      <Flex align="center" gap="sm">
        <AppIcon>
          <AppIconPlaceholder>{props.appInfo.name?.charAt(0) || ''}</AppIconPlaceholder>
        </AppIcon>
        {props.appInfo.name && <Heading as="h3">{props.appInfo.name}</Heading>}
      </Flex>

      {props.sizeInfo &&
        props.sizeInfo.state === BuildDetailsSizeAnalysisState.COMPLETED && (
          <Flex gap="sm">
            <Flex direction="column" gap="xs" flex={1}>
              <Tooltip title={labels.installSize} position="left">
                <Heading as="h4">{labels.installSizeText}</Heading>
              </Tooltip>
              <Text size="md">
                {formatBytesBase10(props.sizeInfo.install_size_bytes)}
              </Text>
            </Flex>
            <Flex direction="column" gap="xs" flex={1}>
              <Tooltip title={labels.downloadSize} position="left">
                <Heading as="h4">{t('Download Size')}</Heading>
              </Tooltip>
              <Text size="md">
                {formatBytesBase10(props.sizeInfo.download_size_bytes)}
              </Text>
            </Flex>
          </Flex>
        )}

      <Flex wrap="wrap" gap="md">
        <Flex gap="2xs" align="center">
          <InfoIcon>
            {props.appInfo.platform ? (
              <PlatformIcon
                platform={getPlatformIconFromPlatform(props.appInfo.platform)}
              />
            ) : null}
          </InfoIcon>
          <Text>
            {props.appInfo.platform
              ? getReadablePlatformLabel(props.appInfo.platform)
              : ''}
          </Text>
        </Flex>
        {props.appInfo.app_id && (
          <Tooltip title={labels.appId}>
            <Flex gap="2xs" align="center">
              <InfoIcon>
                <IconJson />
              </InfoIcon>
              <Text>{props.appInfo.app_id}</Text>
            </Flex>
          </Tooltip>
        )}
        {props.appInfo.date_added && (
          <Tooltip title={t('App upload time')}>
            <Flex gap="2xs" align="center">
              <InfoIcon>
                <IconClock />
              </InfoIcon>
              <Text>
                {getFormattedDate(props.appInfo.date_added, 'MM/DD/YYYY [at] hh:mm A')}
              </Text>
            </Flex>
          </Tooltip>
        )}
        <Tooltip
          title={getReadableArtifactTypeTooltip(props.appInfo.artifact_type ?? null)}
        >
          <Flex gap="2xs" align="center">
            <InfoIcon>
              <IconFile />
            </InfoIcon>
            <Text>
              {getReadableArtifactTypeLabel(props.appInfo.artifact_type ?? null)}
            </Text>
          </Flex>
        </Tooltip>
        <Flex gap="2xs" align="center">
          <InfoIcon>
            <IconLink />
          </InfoIcon>
          <Text>
            {props.projectId && props.appInfo.is_installable ? (
              <InstallableLink
                onClick={() => {
                  openInstallModal(props.projectId!, props.artifactId);
                }}
              >
                Installable
              </InstallableLink>
            ) : (
              <Tooltip title={labels.installUnavailableTooltip}>Not Installable</Tooltip>
            )}
          </Text>
        </Flex>
        {props.appInfo.build_configuration && (
          <Tooltip title={labels.buildConfiguration}>
            <Flex gap="2xs" align="center">
              <InfoIcon>
                <IconMobile />
              </InfoIcon>
              <InlineCodeSnippet data-render-inline hideCopyButton>
                {props.appInfo.build_configuration}
              </InlineCodeSnippet>
            </Flex>
          </Tooltip>
        )}
      </Flex>
    </Flex>
  );
}

const AppIcon = styled('div')`
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: #ff6600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const AppIconPlaceholder = styled('div')`
  color: white;
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.sm};
`;

const InfoIcon = styled('div')`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const InstallableLink = styled('button')`
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  font-size: inherit;
  color: ${p => p.theme.linkColor};
  text-decoration: underline;
  cursor: pointer;
  font-family: inherit;

  &:hover {
    color: ${p => p.theme.linkHoverColor};
  }
`;

const InlineCodeSnippet = styled(CodeBlock)`
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.xs};
`;
