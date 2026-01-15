import React from 'react';
import {Link} from 'react-router-dom';

import {FeatureBadge} from '@sentry/scraps/badge/featureBadge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import Feature from 'sentry/components/acl/feature';
import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import ConfirmDelete from 'sentry/components/confirmDelete';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import IdBadge from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import Placeholder from 'sentry/components/placeholder';
import Version from 'sentry/components/version';
import {
  IconDelete,
  IconDownload,
  IconEllipsis,
  IconRefresh,
  IconSettings,
  IconTelescope,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import useOrganization from 'sentry/utils/useOrganization';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {getCompareBuildPath} from 'sentry/views/preprod/utils/buildLinkUtils';
import {makeReleasesUrl} from 'sentry/views/preprod/utils/releasesUrl';

import {useBuildDetailsActions} from './useBuildDetailsActions';

interface BuildDetailsHeaderContentProps {
  artifactId: string;
  buildDetailsQuery: UseApiQueryResult<BuildDetailsApiResponse, RequestError>;
  projectId: string;
  projectType: string | null;
}

export function BuildDetailsHeaderContent(props: BuildDetailsHeaderContentProps) {
  const organization = useOrganization();
  const isSentryEmployee = useIsSentryEmployee();
  const {buildDetailsQuery, projectId, artifactId, projectType} = props;
  const {
    isDeletingArtifact,
    isRerunningStatusChecks,
    handleDeleteArtifact,
    handleRerunAction,
    handleDownloadAction,
    handleRerunStatusChecksAction,
  } = useBuildDetailsActions({
    projectId,
    artifactId,
  });

  const {
    data: buildDetailsData,
    isPending: isBuildDetailsPending,
    isError: isBuildDetailsError,
  } = buildDetailsQuery;

  // TODO(preprod): for now show nothing for loading/error states, but in the future we
  // might be able to show the release breadcrumb
  if (isBuildDetailsPending) {
    return (
      <Flex direction="column" padding="0 0 xl 0">
        {/* Empty header space - no skeleton content */}
      </Flex>
    );
  }

  if (isBuildDetailsError || !buildDetailsData) {
    return (
      <Flex direction="column" padding="0 0 xl 0">
        {/* Empty header space during error */}
      </Flex>
    );
  }

  const project = ProjectsStore.getById(projectId);

  const breadcrumbs: Crumb[] = [
    {
      to: makeReleasesUrl(organization.slug, projectId, {tab: 'mobile-builds'}),
      label: 'Releases',
    },
  ];

  const version = buildDetailsData.app_info?.version;
  const buildNumber = buildDetailsData.app_info?.build_number;

  if (version) {
    breadcrumbs.push({
      to: makeReleasesUrl(organization.slug, projectId, {
        query: version,
        tab: 'mobile-builds',
      }),
      label: version,
    });
  }

  breadcrumbs.push({
    label: 'Build Details',
  });

  let versionTitle: string | undefined = undefined;
  if (version) {
    versionTitle = `v${version}`;
    if (buildNumber) {
      versionTitle += ` (${buildNumber})`;
    }
  }

  const handleCompareClick = () => {
    trackAnalytics('preprod.builds.details.compare_build_clicked', {
      organization,
      platform: buildDetailsData.app_info?.platform ?? null,
      build_id: buildDetailsData.id,
      project_type: projectType,
      project_slug: projectId,
    });
  };

  const handleConfirmDelete = () => {
    handleDeleteArtifact();
    trackAnalytics('preprod.builds.details.delete_build', {
      organization,
      platform: buildDetailsData.app_info?.platform ?? null,
      build_id: buildDetailsData.id,
      project_slug: projectId,
      project_type: projectType,
    });
  };

  return (
    <React.Fragment>
      <Layout.HeaderContent>
        <Flex align="center" gap="sm">
          <Breadcrumbs crumbs={breadcrumbs} />
          <FeatureBadge type="beta" />
        </Flex>
        <Layout.Title>
          <Flex align="center" gap="sm" minHeight="1lh">
            {project && <IdBadge project={project} avatarSize={28} hideName />}
            {versionTitle && <Version version={versionTitle} anchor={false} truncate />}
            {!versionTitle && <Placeholder width="30ch" height="1em" />}
          </Flex>
        </Layout.Title>
      </Layout.HeaderContent>

      <Layout.HeaderActions>
        <Flex align="center" gap="sm" flexShrink={0}>
          <FeedbackButton
            feedbackOptions={{
              tags: {
                'feedback.source': 'preprod.buildDetails',
              },
            }}
          />
          <Link
            to={getCompareBuildPath({
              organizationSlug: organization.slug,
              projectId,
              headArtifactId: buildDetailsData.id,
            })}
            onClick={handleCompareClick}
          >
            <Button size="sm" priority="default" icon={<IconTelescope />}>
              {t('Compare Build')}
            </Button>
          </Link>
          <Feature features="organizations:preprod-issues">
            <LinkButton
              size="sm"
              icon={<IconSettings />}
              aria-label={t('Settings')}
              to={`/settings/${organization.slug}/projects/${projectId}/preprod/`}
            />
          </Feature>
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
                  key: 'rerun-status-checks',
                  label: (
                    <Flex align="center" gap="sm">
                      <IconRefresh size="sm" />
                      {t('Rerun Status Checks')}
                    </Flex>
                  ),
                  onAction: handleRerunStatusChecksAction,
                  textValue: t('Rerun Status Checks'),
                },
                {
                  key: 'delete',
                  label: (
                    <Flex align="center" gap="sm">
                      <IconDelete size="sm" variant="danger" />
                      <Text variant="danger">{t('Delete Build')}</Text>
                    </Flex>
                  ),
                  onAction: openDeleteModal,
                  textValue: t('Delete Build'),
                },
              ];

              if (isSentryEmployee) {
                menuItems.push({
                  key: 'admin-section',
                  label: t('Admin (Sentry Employees only)'),
                  children: [
                    {
                      key: 'rerun',
                      label: (
                        <Flex align="center" gap="sm">
                          <IconRefresh size="sm" />
                          {t('Rerun Analysis')}
                        </Flex>
                      ),
                      onAction: handleRerunAction,
                      textValue: t('Rerun Analysis'),
                    },
                    {
                      key: 'download',
                      label: (
                        <Flex align="center" gap="sm">
                          <IconDownload size="sm" />
                          {t('Download Build')}
                        </Flex>
                      ),
                      onAction: handleDownloadAction,
                      textValue: t('Download Build'),
                    },
                  ],
                });
              }

              return (
                <DropdownMenu
                  items={menuItems}
                  trigger={(triggerProps, _isOpen) => (
                    <DropdownButton
                      {...triggerProps}
                      size="sm"
                      aria-label="More actions"
                      showChevron={false}
                      disabled={
                        isDeletingArtifact || isRerunningStatusChecks || !artifactId
                      }
                    >
                      <IconEllipsis />
                    </DropdownButton>
                  )}
                />
              );
            }}
          </ConfirmDelete>
        </Flex>
      </Layout.HeaderActions>
    </React.Fragment>
  );
}
