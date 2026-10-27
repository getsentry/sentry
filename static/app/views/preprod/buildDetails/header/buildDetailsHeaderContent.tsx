import {Fragment} from 'react';
import {IconDelete} from '@sentry/icons/delete';
import {IconDownload} from '@sentry/icons/download';
import {IconEllipsis} from '@sentry/icons/ellipsis';
import {IconMobile} from '@sentry/icons/mobile';
import {IconRefresh} from '@sentry/icons/refresh';
import {IconSettings} from '@sentry/icons/settings';
import {IconTelescope} from '@sentry/icons/telescope';

import type {BreadcrumbListProps} from '@sentry/scraps/breadcrumbList';
import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';

import {ConfirmDelete} from 'sentry/components/confirmDelete';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {IdBadge} from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';
import {BuildEntityHeader} from 'sentry/views/preprod/components/buildEntityHeader';
import {getDistributionErrorTooltip} from 'sentry/views/preprod/components/installDetailsContent';
import {openInstallModal} from 'sentry/views/preprod/components/installModal';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  isSizeInfoCompleted,
  isSizeInfoRetryable,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import {getCompareBuildPath} from 'sentry/views/preprod/utils/buildLinkUtils';
import {makeReleasesUrl} from 'sentry/views/preprod/utils/releasesUrl';

import {useBuildDetailsActions} from './useBuildDetailsActions';

interface BuildDetailsHeaderContentProps {
  artifactId: string;
  buildDetailsQuery: UseApiQueryResult<BuildDetailsApiResponse, RequestError>;
  projectSlug: string;
  projectType: string | null;
}

const buildDetailsFeedbackOptions = {
  tags: {
    'feedback.source': 'preprod.buildDetails',
  },
};

export function BuildDetailsHeaderContent(props: BuildDetailsHeaderContentProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const isSentryEmployee = useIsSentryEmployee();
  const {buildDetailsQuery, projectSlug, artifactId, projectType} = props;
  const {
    isDeletingArtifact,
    isRerunningStatusChecks,
    handleDeleteArtifact,
    handleRerunAction,
    handleDownloadAction,
    handleRerunStatusChecksAction,
  } = useBuildDetailsActions({
    projectId: projectSlug,
    artifactId,
  });

  const {
    data: buildDetailsData,
    isPending: isBuildDetailsPending,
    isError: isBuildDetailsError,
  } = buildDetailsQuery;

  const project = ProjectsStore.getBySlug(projectSlug);
  const appInfo = buildDetailsData?.app_info;
  const platform = appInfo?.platform ?? null;

  const pageTitle = {
    type: 'page-title',
    label: artifactId,
    leadingGraphic: project && <IdBadge project={project} avatarSize={16} hideName />,
  } as const;

  const breadcrumbItems: BreadcrumbListProps['items'] | undefined = projectSlug
    ? [
        {
          type: 'link',
          label: t('Releases'),
          to: makeReleasesUrl(organization.slug, projectSlug, {}),
        },
      ]
    : undefined;

  const feedback = (
    <TopBar.Slot name="feedback">
      <FeedbackButton
        feedbackOptions={buildDetailsFeedbackOptions}
        aria-label={t('Give Feedback')}
        tooltipProps={{title: t('Give Feedback')}}
      >
        {null}
      </FeedbackButton>
    </TopBar.Slot>
  );

  if (isBuildDetailsPending || isBuildDetailsError || !buildDetailsData) {
    return (
      <Fragment>
        <TopBar.Slot name="breadcrumbs" title={pageTitle} items={breadcrumbItems} />
        {feedback}
        {isBuildDetailsPending && (
          <BuildEntityHeader appInfo={appInfo} projectSlug={projectSlug} isLoading />
        )}
      </Fragment>
    );
  }

  const areActionsEnabled = isSizeInfoCompleted(buildDetailsData.size_info);
  const canRerunStatusChecks =
    areActionsEnabled || isSizeInfoRetryable(buildDetailsData.size_info);

  const handleCompareClick = () => {
    if (!areActionsEnabled) {
      return;
    }
    trackAnalytics('preprod.builds.details.compare_build_clicked', {
      organization,
      platform,
      build_id: buildDetailsData.id,
      project_type: projectType,
      project_slug: project?.slug,
    });
    navigate(
      getCompareBuildPath({
        organizationSlug: organization.slug,
        headArtifactId: buildDetailsData.id,
      })
    );
  };

  const handleInstallClick = () => {
    trackAnalytics('preprod.builds.install_modal.opened', {
      organization,
      build_id: artifactId,
      platform,
      project_slug: projectSlug,
      source: 'build_details_header',
    });
    openInstallModal(artifactId, projectSlug);
  };

  const handleConfirmDelete = () => {
    handleDeleteArtifact();
    trackAnalytics('preprod.builds.details.delete_build', {
      organization,
      platform,
      build_id: buildDetailsData.id,
      project_slug: project?.slug,
      project_type: projectType,
    });
  };

  return (
    <Fragment>
      <ConfirmDelete
        message={t(
          'Are you sure you want to delete this build? This action cannot be undone and will permanently remove all associated files and data.'
        )}
        confirmInput={artifactId}
        onConfirm={handleConfirmDelete}
      >
        {({open: openDeleteModal}) => {
          const menuItems: MenuItemProps[] = [
            {
              key: 'compare',
              label: t('Compare Build'),
              leadingItems: <IconTelescope variant="muted" />,
              onAction: handleCompareClick,
              disabled: !areActionsEnabled,
              tooltip: areActionsEnabled
                ? undefined
                : t('Size analysis must be completed to compare builds'),
            },
          ];

          if (projectSlug) {
            const {is_installable, error_code, error_message} =
              buildDetailsData.distribution_info;

            menuItems.push({
              key: 'install',
              label: t('Install'),
              leadingItems: <IconMobile variant="muted" />,
              onAction: handleInstallClick,
              disabled: !is_installable,
              tooltip: is_installable
                ? undefined
                : getDistributionErrorTooltip(error_code, error_message),
            });
          }

          if (project) {
            menuItems.push({
              key: 'settings',
              label: t('Settings'),
              leadingItems: <IconSettings variant="muted" />,
              to: `/settings/${organization.slug}/projects/${project.slug}/mobile-builds/`,
            });
          }

          menuItems.push(
            {
              key: 'rerun-status-checks',
              label: t('Rerun Status Checks'),
              leadingItems: <IconRefresh variant="muted" />,
              onAction: handleRerunStatusChecksAction,
              disabled: !canRerunStatusChecks || isRerunningStatusChecks,
              tooltip: canRerunStatusChecks
                ? undefined
                : t('Size analysis must be completed to rerun status checks'),
            },
            {
              key: 'delete',
              label: t('Delete Build'),
              leadingItems: <IconDelete variant="danger" />,
              priority: 'danger',
              onAction: openDeleteModal,
              disabled: isDeletingArtifact,
            }
          );

          if (isSentryEmployee) {
            menuItems.push({
              key: 'admin-section',
              label: t('Admin (Sentry Employees only)'),
              children: [
                {
                  key: 'rerun',
                  label: t('Rerun Analysis'),
                  leadingItems: <IconRefresh variant="muted" />,
                  onAction: handleRerunAction,
                },
                {
                  key: 'download',
                  label: t('Download Build'),
                  leadingItems: <IconDownload variant="muted" />,
                  onAction: handleDownloadAction,
                },
              ],
            });
          }

          return (
            <TopBar.Slot
              name="breadcrumbs"
              title={{
                ...pageTitle,
                trailingActions: {
                  type: 'menu',
                  triggerLabel: t('Build Actions'),
                  triggerIcon: <IconEllipsis />,
                  items: menuItems,
                },
              }}
              items={breadcrumbItems}
            />
          );
        }}
      </ConfirmDelete>
      {feedback}
      <BuildEntityHeader appInfo={appInfo} projectSlug={projectSlug} />
    </Fragment>
  );
}
