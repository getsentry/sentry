import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {
  IconCode,
  IconDownload,
  IconEllipsis,
  IconJson,
  IconMobile,
  IconRefresh,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import useOrganization from 'sentry/utils/useOrganization';
import {AppIcon} from 'sentry/views/preprod/components/appIcon';
import {
  isSizeInfoCompleted,
  type BuildDetailsApiResponse,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  formattedPrimaryMetricDownloadSize,
  formattedPrimaryMetricInstallSize,
  getLabels,
  getReadablePlatformLabel,
} from 'sentry/views/preprod/utils/labelUtils';
import {makeReleasesUrl} from 'sentry/views/preprod/utils/releasesUrl';

interface BuildCompareHeaderContentProps {
  buildDetails: BuildDetailsApiResponse;
  projectId: string;
  baseArtifactId?: string;
  headArtifactId?: string;
  isRerunning?: boolean;
  onRerunComparison?: () => void;
}

export function BuildCompareHeaderContent(props: BuildCompareHeaderContentProps) {
  const {
    buildDetails,
    projectId,
    headArtifactId,
    baseArtifactId,
    onRerunComparison,
    isRerunning,
  } = props;
  const organization = useOrganization();
  const isSentryEmployee = useIsSentryEmployee();
  const labels = getLabels(buildDetails.app_info?.platform ?? undefined);
  const breadcrumbs: Crumb[] = [
    {
      to: makeReleasesUrl(organization.slug, projectId, {tab: 'mobile-builds'}),
      label: t('Releases'),
    },
  ];

  if (buildDetails.app_info.version) {
    breadcrumbs.push({
      to: makeReleasesUrl(organization.slug, projectId, {
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
      <Stack gap="lg" padding="0 0 lg 0">
        <Flex align="center" gap="sm">
          <Breadcrumbs crumbs={breadcrumbs} />
          <FeatureBadge type="new" />
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
            <InfoIcon>
              {buildDetails.app_info.platform ? (
                <PlatformIcon platform={buildDetails.app_info.platform} />
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
      <Flex align="center" gap="sm">
        <FeedbackButton
          feedbackOptions={{
            tags: {
              'feedback.source': 'preprod.buildDetails',
            },
          }}
        />
        {isSentryEmployee &&
          headArtifactId &&
          baseArtifactId &&
          (() => {
            const menuItems: MenuItemProps[] = [
              {
                key: 'admin-section',
                label: t('Admin (Sentry Employees only)'),
                children: [
                  {
                    key: 'rerun-comparison',
                    label: (
                      <Flex align="center" gap="sm">
                        <IconRefresh size="sm" />
                        {t('Rerun Comparison')}
                      </Flex>
                    ),
                    onAction: onRerunComparison,
                    textValue: t('Rerun Comparison'),
                  },
                ],
              },
            ];
            return (
              <DropdownMenu
                items={menuItems}
                trigger={(triggerProps, _isOpen) => (
                  <DropdownButton
                    {...triggerProps}
                    size="sm"
                    aria-label="More actions"
                    showChevron={false}
                    disabled={isRerunning}
                  >
                    <IconEllipsis />
                  </DropdownButton>
                )}
              />
            );
          })()}
      </Flex>
    </Flex>
  );
}

const InfoIcon = styled('div')`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
`;
