import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Heading, Text} from 'sentry/components/core/text';
import {IconClock, IconFile, IconJson, IconLink} from 'sentry/icons';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {getFormattedDate} from 'sentry/utils/dates';
import {openInstallModal} from 'sentry/views/preprod/components/installModal';
import {type BuildDetailsAppInfo} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  getPlatformIconFromPlatform,
  getReadableArtifactTypeLabel,
  getReadablePlatformLabel,
} from 'sentry/views/preprod/utils';

interface BuildDetailsSidebarAppInfoProps {
  appInfo: BuildDetailsAppInfo;
  artifactId: string;
  // TODO: Optional
  downloadSizeBytes: number;
  // TODO: Optional
  installSizeBytes: number;
  projectId: string;
}

export function BuildDetailsSidebarAppInfo(props: BuildDetailsSidebarAppInfoProps) {
  const handleInstallClick = () => {
    openInstallModal(props.projectId, props.artifactId);
  };

  return (
    <AppInfoContainer>
      <AppNameHeader>
        <AppIcon>
          <AppIconPlaceholder>{props.appInfo.name?.charAt(0) || ''}</AppIconPlaceholder>
        </AppIcon>
        <Heading as="h3">{props.appInfo.name}</Heading>
      </AppNameHeader>

      {/* TODO: Optional */}
      <SizeSection>
        <SizeRow>
          <SizeItem>
            <Heading as="h4">Install Size</Heading>
            <SizeValue>{formatBytesBase10(props.installSizeBytes)}</SizeValue>
          </SizeItem>
          <SizeItem>
            <Heading as="h4">Download Size</Heading>
            <SizeValue>{formatBytesBase10(props.downloadSizeBytes)}</SizeValue>
          </SizeItem>
        </SizeRow>
      </SizeSection>

      <InfoSection>
        <InfoItem>
          <InfoIcon>
            <PlatformIcon
              platform={getPlatformIconFromPlatform(props.appInfo.platform)}
            />
          </InfoIcon>
          <Text>{getReadablePlatformLabel(props.appInfo.platform)}</Text>
        </InfoItem>
        <InfoItem>
          <InfoIcon>
            <IconJson />
          </InfoIcon>
          <Text>{props.appInfo.app_id}</Text>
        </InfoItem>
        <InfoItem>
          <InfoIcon>
            <IconClock />
          </InfoIcon>
          <Text>
            {getFormattedDate(props.appInfo.date_added, 'MM/DD/YYYY [at] hh:mm A')}
          </Text>
        </InfoItem>
        <InfoItem>
          <InfoIcon>
            <IconFile />
          </InfoIcon>
          <Text>{getReadableArtifactTypeLabel(props.appInfo.artifact_type)}</Text>
        </InfoItem>
        <InfoItem>
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
        </InfoItem>
      </InfoSection>
    </AppInfoContainer>
  );
}

const AppInfoContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
`;

const AppNameHeader = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.sm};
`;

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

const InfoSection = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${p => p.theme.space.md};
`;

const InfoItem = styled('div')`
  display: flex;
  gap: ${p => p.theme.space['2xs']};
  align-items: center;
`;

const InfoIcon = styled('div')`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SizeSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.sm};
`;

const SizeRow = styled('div')`
  display: flex;
`;

const SizeItem = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
  flex: 1;
`;

const SizeValue = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.textColor};
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
