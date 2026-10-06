import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {CodeBlock} from '@sentry/scraps/code';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import * as Layout from 'sentry/components/layouts/thirds';
import {Placeholder} from 'sentry/components/placeholder';
import {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import {IconClock, IconFile, IconJson, IconMobile} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getFormat, getFormattedDate, getUtcToSystem} from 'sentry/utils/dates';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';
import {AppIcon} from 'sentry/views/preprod/components/appIcon';
import {
  getBuildNumber,
  type BuildDetailsApiResponse,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  getLabels,
  getReadableArtifactTypeLabel,
  getReadableArtifactTypeTooltip,
  getReadablePlatformLabel,
} from 'sentry/views/preprod/utils/labelUtils';
import {makeReleasesUrl} from 'sentry/views/preprod/utils/releasesUrl';

interface BuildInstallHeaderProps {
  buildDetailsQuery: UseApiQueryResult<BuildDetailsApiResponse, RequestError>;
  projectId?: string;
}

export function BuildInstallHeader(props: BuildInstallHeaderProps) {
  const organization = useOrganization();
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

  const releasesCrumb = {
    type: 'link' as const,
    to: makeReleasesUrl(organization.slug, projectId, {
      display: PreprodBuildsDisplay.DISTRIBUTION,
      query: 'installable:true',
    }),
    label: t('Releases'),
  };

  if (isBuildDetailsPending) {
    return (
      <Layout.HeaderContent>
        <TopBar.Slot name="breadcrumbs" title={{type: 'page-title', label: t('Install')}}>
          <BreadcrumbList items={[releasesCrumb]} />
        </TopBar.Slot>
        <Flex gap="lg" wrap="wrap" align="center">
          <Placeholder width="120px" height="16px" />
          <Placeholder width="160px" height="16px" />
          <Placeholder width="180px" height="16px" />
        </Flex>
      </Layout.HeaderContent>
    );
  }

  if (isBuildDetailsError || !buildDetailsData) {
    return (
      <Layout.HeaderContent>
        <TopBar.Slot name="breadcrumbs" title={{type: 'page-title', label: t('Install')}}>
          <BreadcrumbList items={[releasesCrumb]} />
        </TopBar.Slot>
      </Layout.HeaderContent>
    );
  }

  const appInfo = buildDetailsData.app_info;
  const labels = getLabels(appInfo.platform ?? undefined);
  const version = appInfo.version;
  const buildNumber = getBuildNumber(appInfo);
  const versionTitle = version
    ? `v${version}${buildNumber ? ` (${buildNumber})` : ''}`
    : undefined;

  return (
    <Layout.HeaderContent>
      <TopBar.Slot
        name="breadcrumbs"
        title={{
          type: 'page-title',
          label: [appInfo.name, versionTitle].filter(Boolean).join(' - ') || t('Install'),
          leadingGraphic: appInfo.name && (
            <AppIcon
              appName={appInfo.name}
              appIconId={appInfo.app_icon_id}
              projectId={projectId}
              size={16}
            />
          ),
        }}
      >
        <BreadcrumbList items={[releasesCrumb]} />
      </TopBar.Slot>
      <Flex gap="lg" wrap="wrap" align="center">
        {appInfo.platform ? (
          <Tooltip title={t('Platform')}>
            <Flex gap="2xs" align="center">
              <Flex align="center" justify="center" width="24px" height="24px">
                <PlatformIcon platform={appInfo.platform} alt="" />
              </Flex>
              <Text size="sm" variant="muted">
                {getReadablePlatformLabel(appInfo.platform)}
              </Text>
            </Flex>
          </Tooltip>
        ) : null}
        {appInfo.app_id ? (
          <Tooltip title={labels.appId}>
            <Flex gap="2xs" align="center">
              <Flex align="center" justify="center" width="24px" height="24px">
                <IconJson />
              </Flex>
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
              <Flex align="center" justify="center" width="24px" height="24px">
                <IconClock />
              </Flex>
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
              <Flex align="center" justify="center" width="24px" height="24px">
                <IconMobile />
              </Flex>
              <InlineCodeSnippet data-render-inline hideCopyButton>
                {appInfo.build_configuration}
              </InlineCodeSnippet>
            </Flex>
          </Tooltip>
        ) : null}
        {appInfo.artifact_type !== null && appInfo.artifact_type !== undefined ? (
          <Tooltip title={getReadableArtifactTypeTooltip(appInfo.artifact_type)}>
            <Flex gap="2xs" align="center">
              <Flex align="center" justify="center" width="24px" height="24px">
                <IconFile />
              </Flex>
              <Text size="sm" variant="muted">
                {getReadableArtifactTypeLabel(appInfo.artifact_type)}
              </Text>
            </Flex>
          </Tooltip>
        ) : null}
      </Flex>
    </Layout.HeaderContent>
  );
}

const InlineCodeSnippet = styled(CodeBlock)`
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.xs};
`;
