import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {FeatureBadge} from '@sentry/scraps/badge/featureBadge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Heading} from '@sentry/scraps/text/heading';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import {IconCode, IconDownload, IconJson, IconMobile} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
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

interface BuildCompareHeaderContentProps {
  buildDetails: BuildDetailsApiResponse;
  projectId: string;
}

export function BuildCompareHeaderContent(props: BuildCompareHeaderContentProps) {
  const {buildDetails, projectId} = props;
  const organization = useOrganization();
  const theme = useTheme();
  const labels = getLabels(buildDetails.app_info?.platform ?? undefined);
  const breadcrumbs: Crumb[] = [
    {
      to: '#',
      label: t('Releases'),
    },
    {
      to: `/organizations/${organization.slug}/preprod/${projectId}/${buildDetails.id}/`,
      label: buildDetails.app_info.version ?? t('Build Version'),
    },
    {
      label: t('Compare'),
    },
  ];

  return (
    <Flex justify="between" align="center" gap="lg">
      <Stack gap="lg" style={{padding: `0 0 ${theme.space.lg} 0`}}>
        <Flex align="center" gap="sm">
          <Breadcrumbs crumbs={breadcrumbs} />
          <FeatureBadge type="beta" />
        </Flex>
        <Heading as="h1">Build comparison</Heading>
        <Flex gap="lg" wrap="wrap" align="center">
          <Flex gap="sm" align="center">
            <AppIcon>
              <AppIconPlaceholder>
                {buildDetails.app_info.name?.charAt(0) || ''}
              </AppIconPlaceholder>
            </AppIcon>
            <Text>{buildDetails.app_info.name}</Text>
          </Flex>
          <Flex gap="sm" align="center">
            <InfoIcon>
              {buildDetails.app_info.platform ? (
                <PlatformIcon
                  platform={getPlatformIconFromPlatform(buildDetails.app_info.platform)}
                />
              ) : null}
            </InfoIcon>
            <Text>
              {buildDetails.app_info.platform
                ? getReadablePlatformLabel(buildDetails.app_info.platform)
                : ''}
            </Text>
          </Flex>
          <Tooltip title={t('Application ID')}>
            <Flex gap="sm" align="center">
              <InfoIcon>
                <IconJson />
              </InfoIcon>
              <Text>{buildDetails.app_info.app_id}</Text>
            </Flex>
          </Tooltip>
          {buildDetails.app_info.build_configuration && (
            <Tooltip title={t('Build configuration')}>
              <Flex gap="sm" align="center">
                <IconMobile size="sm" color="gray300" />
                <Text monospace>{buildDetails.app_info.build_configuration}</Text>
              </Flex>
            </Tooltip>
          )}
          {isSizeInfoCompleted(buildDetails.size_info) && (
            <Tooltip title={labels.installSizeDescription}>
              <Flex gap="sm" align="center">
                <IconCode size="sm" color="gray300" />
                <Text underline="dotted">
                  {formattedPrimaryMetricInstallSize(buildDetails.size_info)}
                </Text>
              </Flex>
            </Tooltip>
          )}
          {isSizeInfoCompleted(buildDetails.size_info) && (
            <Tooltip title={labels.downloadSizeDescription}>
              <Flex gap="sm" align="center">
                <IconDownload size="sm" color="gray300" />
                <Text underline="dotted">
                  {formattedPrimaryMetricDownloadSize(buildDetails.size_info)}
                </Text>
              </Flex>
            </Tooltip>
          )}
        </Flex>
      </Stack>
      <FeedbackWidgetButton
        optionOverrides={{
          tags: {
            'feedback.source': 'preprod.buildDetails',
          },
        }}
      />
    </Flex>
  );
}

const AppIcon = styled('div')`
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: ${p => p.theme.purple400};
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
