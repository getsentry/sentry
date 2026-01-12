import {useTheme} from '@emotion/react';
import {PlatformIcon} from 'platformicons';

import {FeatureBadge} from '@sentry/scraps/badge/featureBadge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Heading} from '@sentry/scraps/text/heading';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {IconCode, IconDownload, IconJson, IconMobile} from 'sentry/icons';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {AppIcon} from 'sentry/views/preprod/components/appIcon';
import {
  isSizeInfoCompleted,
  type BuildDetailsApiResponse,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  formattedPrimaryMetricDownloadSize,
  formattedPrimaryMetricInstallSize,
  getLabels,
  getPlatformIconFromPlatform,
  getReadablePlatformLabel,
} from 'sentry/views/preprod/utils/labelUtils';
import {makeReleasesUrl} from 'sentry/views/preprod/utils/releasesUrl';

interface BuildCompareHeaderContentProps {
  buildDetails: BuildDetailsApiResponse;
  projectId: string;
}

export function BuildCompareHeaderContent(props: BuildCompareHeaderContentProps) {
  const {buildDetails, projectId} = props;
  const theme = useTheme();
  const project = ProjectsStore.getBySlug(projectId);
  const labels = getLabels(buildDetails.app_info?.platform ?? undefined);
  const breadcrumbs: Crumb[] = [
    {
      to: makeReleasesUrl(project?.id, {tab: 'mobile-builds'}),
      label: t('Releases'),
    },
  ];

  if (buildDetails.app_info.version) {
    breadcrumbs.push({
      to: makeReleasesUrl(project?.id, {
        query: buildDetails.app_info.version,
        tab: 'mobile-builds',
      }),
      label: buildDetails.app_info.version,
    });
  }

  breadcrumbs.push({
    label: t('Compare'),
  });

  return (
    <Flex justify="between" align="center" gap="lg">
      <Stack gap="lg" style={{padding: `0 0 ${theme.space.lg} 0`}}>
        <Flex align="center" gap="sm">
          <Breadcrumbs crumbs={breadcrumbs} />
          <FeatureBadge type="beta" />
        </Flex>
        <Heading as="h1">Build comparison</Heading>
        <Flex gap="lg" wrap="wrap" align="center">
          {buildDetails.app_info.name && (
            <Flex gap="sm" align="center">
              <AppIcon
                appName={buildDetails.app_info.name}
                appIconId={buildDetails.app_info.app_icon_id}
                projectId={projectId}
              />
              <Text>{buildDetails.app_info.name}</Text>
            </Flex>
          )}
          <Flex gap="sm" align="center">
            <Flex justify="center" align="center" width="24px" height="24px">
              {buildDetails.app_info.platform ? (
                <PlatformIcon
                  platform={getPlatformIconFromPlatform(buildDetails.app_info.platform)}
                />
              ) : null}
            </Flex>
            <Text>
              {buildDetails.app_info.platform
                ? getReadablePlatformLabel(buildDetails.app_info.platform)
                : ''}
            </Text>
          </Flex>
          <Tooltip title={t('Application ID')}>
            <Flex gap="sm" align="center">
              <Flex justify="center" align="center" width="24px" height="24px">
                <IconJson />
              </Flex>
              <Text>{buildDetails.app_info.app_id}</Text>
            </Flex>
          </Tooltip>
          {buildDetails.app_info.build_configuration && (
            <Tooltip title={t('Build configuration')}>
              <Flex gap="sm" align="center">
                <IconMobile size="sm" variant="muted" />
                <Text monospace>{buildDetails.app_info.build_configuration}</Text>
              </Flex>
            </Tooltip>
          )}
          {isSizeInfoCompleted(buildDetails.size_info) && (
            <Tooltip title={labels.installSizeDescription}>
              <Flex gap="sm" align="center">
                <IconCode size="sm" variant="muted" />
                <Text underline="dotted">
                  {formattedPrimaryMetricInstallSize(buildDetails.size_info)}
                </Text>
              </Flex>
            </Tooltip>
          )}
          {isSizeInfoCompleted(buildDetails.size_info) && (
            <Tooltip title={labels.downloadSizeDescription}>
              <Flex gap="sm" align="center">
                <IconDownload size="sm" variant="muted" />
                <Text underline="dotted">
                  {formattedPrimaryMetricDownloadSize(buildDetails.size_info)}
                </Text>
              </Flex>
            </Tooltip>
          )}
        </Flex>
      </Stack>
      <FeedbackButton
        feedbackOptions={{
          tags: {
            'feedback.source': 'preprod.buildDetails',
          },
        }}
      />
    </Flex>
  );
}
