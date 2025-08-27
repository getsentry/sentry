import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {IconClock, IconFile, IconJson, IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {getFormattedDate} from 'sentry/utils/dates';
import {openInstallModal} from 'sentry/views/preprod/components/installModal';
import {
  type BuildDetailsAppInfo,
  type BuildDetailsSizeInfo,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  getPlatformIconFromPlatform,
  getReadableArtifactTypeLabel,
  getReadablePlatformLabel,
} from 'sentry/views/preprod/utils/labelUtils';

interface BuildDetailsSidebarAppInfoProps {
  appInfo: BuildDetailsAppInfo;
  artifactId: string;
  projectId: string;
  sizeInfo?: BuildDetailsSizeInfo;
}

export function BuildDetailsSidebarAppInfo(props: BuildDetailsSidebarAppInfoProps) {
  const handleInstallClick = () => {
    openInstallModal(props.projectId, props.artifactId);
  };

  // Android uses uncompressed size, other platforms use install size
  const installSizeText =
    props.appInfo.platform === 'android' ? t('Uncompressed Size') : t('Install Size');

  return (
    <Flex direction="column" gap="xl">
      <Flex align="center" gap="sm">
        <AppIcon>
          <AppIconPlaceholder>{props.appInfo.name?.charAt(0) || ''}</AppIconPlaceholder>
        </AppIcon>
        <Heading as="h3">{props.appInfo.name}</Heading>
      </Flex>

      {props.sizeInfo && (
        <Flex gap="sm">
          <Flex direction="column" gap="xs" style={{flex: 1}}>
            <Heading as="h4">{installSizeText}</Heading>
            <Text size="md">{formatBytesBase10(props.sizeInfo.install_size_bytes)}</Text>
          </Flex>
          <Flex direction="column" gap="xs" style={{flex: 1}}>
            <Heading as="h4">{t('Download Size')}</Heading>
            <Text size="md">{formatBytesBase10(props.sizeInfo.download_size_bytes)}</Text>
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
        <Flex gap="2xs" align="center">
          <InfoIcon>
            <IconJson />
          </InfoIcon>
          <Text>{props.appInfo.app_id}</Text>
        </Flex>
        <Flex gap="2xs" align="center">
          <InfoIcon>
            <IconClock />
          </InfoIcon>
          <Text>
            {getFormattedDate(props.appInfo.date_added, 'MM/DD/YYYY [at] hh:mm A')}
          </Text>
        </Flex>
        <Flex gap="2xs" align="center">
          <InfoIcon>
            <IconFile />
          </InfoIcon>
          <Text>{getReadableArtifactTypeLabel(props.appInfo.artifact_type)}</Text>
        </Flex>
        <Flex gap="2xs" align="center">
          <InfoIcon>
            <IconLink />
          </InfoIcon>
          <Text>
            {props.appInfo.is_installable ? (
              <InstallableLink onClick={handleInstallClick}>Installable</InstallableLink>
            ) : (
              'Not Installable'
            )}
          </Text>
        </Flex>
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
