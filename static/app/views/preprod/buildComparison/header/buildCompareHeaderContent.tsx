import {Fragment} from 'react';
import {IconEllipsis} from '@sentry/icons/ellipsis';
import {IconRefresh} from '@sentry/icons/refresh';

import type {BreadcrumbListProps} from '@sentry/scraps/breadcrumbList';
import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';
import type {EntityHeaderProps} from '@sentry/scraps/entityHeader';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';
import {BuildEntityHeader} from 'sentry/views/preprod/components/buildEntityHeader';
import {
  isSizeInfoCompleted,
  type BuildDetailsApiResponse,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import type {Platform} from 'sentry/views/preprod/types/sharedTypes';
import {getSizeBuildPath} from 'sentry/views/preprod/utils/buildLinkUtils';
import {
  formattedPrimaryMetricDownloadSize,
  formattedPrimaryMetricInstallSize,
} from 'sentry/views/preprod/utils/labelUtils';
import {makeReleasesUrl} from 'sentry/views/preprod/utils/releasesUrl';

interface BuildCompareHeaderContentProps {
  baseArtifactId?: string;
  buildDetails?: BuildDetailsApiResponse;
  headArtifactId?: string;
  isLoading?: boolean;
  isRerunning?: boolean;
  onRerunComparison?: () => void;
}

const buildCompareFeedbackOptions = {
  tags: {
    'feedback.source': 'preprod.buildDetails',
  },
};

function getInstallSizeStatLabels(platform: Platform | null) {
  if (platform === 'android') {
    return {label: t('Uncompressed Disk Size'), tooltip: t('Excluding AOT DEX')};
  }

  return {label: t('Install Size'), tooltip: t('Unencrypted install size')};
}

export function BuildCompareHeaderContent(props: BuildCompareHeaderContentProps) {
  const {
    buildDetails,
    headArtifactId,
    baseArtifactId,
    onRerunComparison,
    isRerunning,
    isLoading,
  } = props;
  const organization = useOrganization();
  const isSentryEmployee = useIsSentryEmployee();

  const sizeInfo = buildDetails?.size_info;
  const project = ProjectsStore.getBySlug(buildDetails?.project_slug);
  const headBuildPath = headArtifactId
    ? getSizeBuildPath({
        organizationSlug: organization.slug,
        baseArtifactId: headArtifactId,
      })
    : undefined;

  const breadcrumbItems: BreadcrumbListProps['items'] = [
    {
      type: 'link',
      label: t('Releases'),
      to: makeReleasesUrl(
        organization.slug,
        buildDetails ? String(buildDetails.project_id) : undefined,
        {}
      ),
    },
  ];

  if (headArtifactId && headBuildPath) {
    breadcrumbItems.push({
      type: 'link',
      label: headArtifactId,
      to: headBuildPath,
      leadingGraphic: project && (
        <ProjectBadge disableLink project={project} avatarSize={16} hideName />
      ),
    });
  }

  const menuItems: MenuItemProps[] = [
    {
      key: 'admin-section',
      label: t('Admin (Sentry Employees only)'),
      children: [
        {
          key: 'rerun-comparison',
          label: t('Rerun Comparison'),
          leadingItems: <IconRefresh variant="muted" />,
          onAction: onRerunComparison,
          disabled: isRerunning,
        },
      ],
    },
  ];

  const hasAdminMenu = isSentryEmployee && Boolean(headArtifactId && baseArtifactId);

  const installStat = getInstallSizeStatLabels(buildDetails?.app_info?.platform ?? null);
  // Declared while the request is in flight, not only once it settles: the row
  // decides the header's grid template, so resolving it late reflows the title
  // beside it and the page below.
  const stats: EntityHeaderProps['stats'] =
    isLoading || isSizeInfoCompleted(sizeInfo)
      ? {
          label: t('Build size'),
          items: [
            {
              type: 'text',
              label: installStat.label,
              labelTooltip: installStat.tooltip,
              value: formattedPrimaryMetricInstallSize(sizeInfo),
              isLoading,
            },
            {
              type: 'text',
              label: t('Bytes Transferred'),
              labelTooltip: t('Over the network'),
              value: formattedPrimaryMetricDownloadSize(sizeInfo),
              isLoading,
            },
          ],
        }
      : undefined;

  return (
    <Fragment>
      <TopBar.Slot
        name="breadcrumbs"
        title={{
          type: 'page-title',
          label: t('Compare Builds'),
          trailingActions: hasAdminMenu
            ? {
                type: 'menu',
                triggerLabel: t('Comparison Actions'),
                triggerIcon: <IconEllipsis />,
                items: menuItems,
              }
            : undefined,
        }}
        items={breadcrumbItems}
      />
      <TopBar.Slot name="feedback">
        <FeedbackButton
          feedbackOptions={buildCompareFeedbackOptions}
          aria-label={t('Give Feedback')}
          tooltipProps={{title: t('Give Feedback')}}
        >
          {null}
        </FeedbackButton>
      </TopBar.Slot>
      <BuildEntityHeader
        appInfo={buildDetails?.app_info}
        projectSlug={buildDetails?.project_slug ?? ''}
        isLoading={isLoading}
        stats={stats}
      />
    </Fragment>
  );
}
