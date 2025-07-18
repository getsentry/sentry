import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {IconCheckmark, IconClock, IconFile, IconJson, IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {getFormattedDate} from 'sentry/utils/dates';
import {type BuildDetailsAppInfo, BuildDetailsState} from 'sentry/views/preprod/types';
import {
  formatBytes,
  getPlatformFromArtifactType,
  getReadableArtifactTypeLabel,
  getReadablePlatformLabel,
} from 'sentry/views/preprod/utils';

interface BuildDetailsSidebarAppInfoProps {
  appInfo: BuildDetailsAppInfo;
  downloadSizeBytes: number;
  installSizeBytes: number;
  state: BuildDetailsState;
}

export function BuildDetailsSidebarAppInfo(props: BuildDetailsSidebarAppInfoProps) {
  const {appInfo, state, installSizeBytes, downloadSizeBytes} = props;
  const platform = getPlatformFromArtifactType(appInfo.artifact_type);

  return (
    <AppInfoContainer>
      <AppHeader>
        <AppNameContainer>
          <AppIcon>
            <AppIconPlaceholder>{appInfo.name?.charAt(0) || ''}</AppIconPlaceholder>
          </AppIcon>
          <AppName>{appInfo.name}</AppName>
        </AppNameContainer>
        <StateTag state={state} />
      </AppHeader>

      <InfoSection>
        <InfoRow>
          <InfoIcon>
            <PlatformIcon platform={platform} />
          </InfoIcon>
          <InfoValue>{getReadablePlatformLabel(platform)}</InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoIcon>
            <IconJson />
          </InfoIcon>
          <InfoValue>{appInfo.app_id}</InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoIcon>
            <IconClock />
          </InfoIcon>
          <InfoValue>
            {getFormattedDate(appInfo.date_added, 'MM/DD/YYYY [at] hh:mm A')}
          </InfoValue>
        </InfoRow>
        <InfoRow>
          <InfoIcon>
            <IconFile />
          </InfoIcon>
          <InfoValue>{getReadableArtifactTypeLabel(appInfo.artifact_type)}</InfoValue>
        </InfoRow>
      </InfoSection>

      <SizeSection>
        <SizeRow>
          <SizeItem>
            <SizeLabel>Install Size</SizeLabel>
            <SizeValue>{formatBytes(installSizeBytes)}</SizeValue>
          </SizeItem>
          <SizeItem>
            <SizeLabel>Download Size</SizeLabel>
            <SizeValue>{formatBytes(downloadSizeBytes)}</SizeValue>
          </SizeItem>
        </SizeRow>
      </SizeSection>
    </AppInfoContainer>
  );
}

function StateTag({state}: {state: BuildDetailsState}) {
  switch (state) {
    case BuildDetailsState.PROCESSED:
      return (
        <SuccessTag>
          <IconCheckmark color="successText" />
          Processed
        </SuccessTag>
      );
    case BuildDetailsState.FAILED:
      return (
        <ErrorTag>
          <IconWarning color="errorText" />
          Failed
        </ErrorTag>
      );
    case BuildDetailsState.UPLOADING:
    case BuildDetailsState.UPLOADED:
      return (
        <ProcessingTag>
          <IconClock color="warningText" />
          Processing
        </ProcessingTag>
      );
    default:
      return null;
  }
}

const AppInfoContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const AppHeader = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(1)};
`;

const AppNameContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
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

const AppName = styled('h3')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.textColor};
`;

const InfoSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const InfoRow = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const InfoIcon = styled('div')`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const InfoValue = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  align-items: center;
  color: ${p => p.theme.textColor};
`;

const SizeSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const SizeRow = styled('div')`
  display: flex;
`;

const SizeItem = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  flex: 1;
`;

const SizeLabel = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const SizeValue = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.textColor};
`;

const SuccessTag = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  color: ${p => p.theme.successText};
  background-color: ${p => p.theme.green100};
  padding: ${space(0.5)} ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const ErrorTag = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  color: ${p => p.theme.errorText};
  background-color: ${p => p.theme.red100};
  padding: ${space(0.5)} ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const ProcessingTag = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  color: ${p => p.theme.warningText};
  background-color: ${p => p.theme.yellow100};
  padding: ${space(0.5)} ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
`;
