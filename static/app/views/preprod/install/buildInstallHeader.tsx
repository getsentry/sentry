import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {CodeBlock} from '@sentry/scraps/code';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import * as Layout from 'sentry/components/layouts/thirds';
import Placeholder from 'sentry/components/placeholder';
import Version from 'sentry/components/version';
import {IconClock, IconFile, IconJson, IconMobile} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getFormat, getFormattedDate, getUtcToSystem} from 'sentry/utils/dates';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {AppIcon} from 'sentry/views/preprod/components/appIcon';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  getLabels,
  getPlatformIconFromPlatform,
  getReadableArtifactTypeLabel,
  getReadableArtifactTypeTooltip,
  getReadablePlatformLabel,
} from 'sentry/views/preprod/utils/labelUtils';

interface BuildInstallHeaderProps {
  buildDetailsQuery: UseApiQueryResult<BuildDetailsApiResponse, RequestError>;
  projectId: string;
}

export function BuildInstallHeader(props: BuildInstallHeaderProps) {
  const {buildDetailsQuery, projectId} = props;
  const {
    data: buildDetailsData,
    isPending: isBuildDetailsPending,
    isError: isBuildDetailsError,
  } = buildDetailsQuery;

  const datetimeFormat = getFormat({
    seconds: true,
    timeZone: true,
  });

  if (isBuildDetailsPending) {
    return (
      <Layout.HeaderContent>
        <Flex direction="column" gap="sm">
          <Flex align="center" gap="sm">
            <Placeholder width="140px" height="16px" />
          </Flex>
          <Layout.Title>
            <Placeholder width="220px" height="1em" />
          </Layout.Title>
          <Flex gap="lg" wrap="wrap" align="center">
            <Placeholder width="120px" height="16px" />
            <Placeholder width="160px" height="16px" />
            <Placeholder width="180px" height="16px" />
          </Flex>
        </Flex>
      </Layout.HeaderContent>
    );
  }

  if (isBuildDetailsError || !buildDetailsData) {
    return null;
  }

  const appInfo = buildDetailsData.app_info;
  const labels = getLabels(appInfo.platform ?? undefined);
  const version = appInfo.version;
  const buildNumber = appInfo.build_number;
  const versionTitle = version
    ? `v${version}${buildNumber ? ` (${buildNumber})` : ''}`
    : undefined;

  return (
    <Layout.HeaderContent>
      <Flex direction="column" gap="sm">
        <Flex align="center" gap="sm">
          {appInfo.app_icon_id && appInfo.name ? (
            <AppIcon
              appName={appInfo.name}
              appIconId={appInfo.app_icon_id}
              projectId={projectId}
            />
          ) : null}
          {appInfo.name ? (
            <Text bold size="md">
              {appInfo.name}
            </Text>
          ) : null}
        </Flex>
        <Layout.Title>
          <Flex align="center" gap="sm" minHeight="1lh">
            {versionTitle ? (
              <Version version={versionTitle} anchor={false} truncate />
            ) : (
              <Placeholder width="30ch" height="1em" />
            )}
          </Flex>
        </Layout.Title>
        <Flex gap="lg" wrap="wrap" align="center">
          {appInfo.platform ? (
            <Tooltip title={t('Platform')}>
              <Flex gap="2xs" align="center">
                <InfoIcon>
                  <PlatformIcon
                    platform={getPlatformIconFromPlatform(appInfo.platform)}
                  />
                </InfoIcon>
                <Text size="sm" variant="muted">
                  {getReadablePlatformLabel(appInfo.platform)}
                </Text>
              </Flex>
            </Tooltip>
          ) : null}
          {appInfo.app_id ? (
            <Tooltip title={labels.appId}>
              <Flex gap="2xs" align="center">
                <InfoIcon>
                  <IconJson />
                </InfoIcon>
                <Text size="sm" variant="muted">
                  {appInfo.app_id}
                </Text>
              </Flex>
            </Tooltip>
          ) : null}
          {(appInfo.date_built || appInfo.date_added) && (
            <Tooltip
              title={appInfo.date_built ? t('App build time') : t('App upload time')}
            >
              <Flex gap="2xs" align="center">
                <InfoIcon>
                  <IconClock />
                </InfoIcon>
                <Text size="sm" variant="muted">
                  {getFormattedDate(
                    getUtcToSystem(appInfo.date_built || appInfo.date_added),
                    datetimeFormat,
                    {local: true}
                  )}
                </Text>
              </Flex>
            </Tooltip>
          )}
          {appInfo.build_configuration ? (
            <Tooltip title={labels.buildConfiguration}>
              <Flex gap="2xs" align="center">
                <InfoIcon>
                  <IconMobile />
                </InfoIcon>
                <InlineCodeSnippet data-render-inline hideCopyButton>
                  {appInfo.build_configuration}
                </InlineCodeSnippet>
              </Flex>
            </Tooltip>
          ) : null}
          {appInfo.artifact_type !== null && appInfo.artifact_type !== undefined ? (
            <Tooltip title={getReadableArtifactTypeTooltip(appInfo.artifact_type)}>
              <Flex gap="2xs" align="center">
                <InfoIcon>
                  <IconFile />
                </InfoIcon>
                <Text size="sm" variant="muted">
                  {getReadableArtifactTypeLabel(appInfo.artifact_type)}
                </Text>
              </Flex>
            </Tooltip>
          ) : null}
        </Flex>
      </Flex>
    </Layout.HeaderContent>
  );
}

const InfoIcon = styled('div')`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const InlineCodeSnippet = styled(CodeBlock)`
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.xs};
`;
