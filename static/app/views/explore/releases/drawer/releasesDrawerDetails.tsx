import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';
import {IconExpand} from '@sentry/icons/expand';

import {Alert} from '@sentry/scraps/alert';
import {ProjectAvatar} from '@sentry/scraps/avatar';
import type {BreadcrumbListProps} from '@sentry/scraps/breadcrumbList';
import {LinkButton} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {DrawerHeader} from '@sentry/scraps/drawer';
import {Stack, Grid} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {
  DrawerBreadcrumbs,
  EventDrawerBody,
  EventDrawerContainer,
  EventNavigator,
} from 'sentry/components/events/eventDrawer';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {ReleaseMeta} from 'sentry/types/release';
import {trackAnalytics} from 'sentry/utils/analytics';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {makeReleasesPathname} from 'sentry/views/explore/releases/utils/pathnames';
import {useReleaseMeta} from 'sentry/views/explore/releases/utils/useReleaseMeta';

import {CommitsFilesSection} from './commitsFilesSection';
import {DeploysCard} from './deploysCard';
import {GeneralCard} from './generalCard';
import {NewIssues} from './newIssues';
import {ReleasesDrawerFields} from './utils';

interface ReleasesDrawerDetailsProps {
  end: Date | null;
  projectId: string | undefined;
  release: string;
  start: Date | null;
}

interface ReleasesDrawerContentProps {
  isLoadingMeta: boolean;
  isMetaError: boolean;
  onProjectSelect: (selectedProjectId: string) => void;
  project: Project;
  projectId: string | undefined;
  release: string;
  releaseMeta: ReleaseMeta | undefined;
}

function ReleasesDrawerContent({
  release,
  projectId,
  project,
  releaseMeta,
  isMetaError,
  isLoadingMeta,
  onProjectSelect,
}: ReleasesDrawerContentProps) {
  const releaseProjects = releaseMeta?.projects ?? [];
  const selectedProject = releaseProjects.find(
    releaseProject => String(releaseProject.id) === projectId
  );

  return (
    <Fragment>
      {releaseProjects.length > 1 ? (
        <EventNavigator
          leadingItems={
            <CompactSelect
              size="sm"
              value={projectId}
              options={releaseProjects.map(releaseProject => ({
                value: String(releaseProject.id),
                label: releaseProject.slug,
                leadingItems: <ProjectAvatar project={releaseProject} size={16} />,
              }))}
              onChange={option => onProjectSelect(option.value)}
              trigger={triggerProps => (
                // Matches the project page filter: platform icon and a bold
                // project slug, without a prefix.
                <OverlayTrigger.Button
                  {...triggerProps}
                  icon={
                    selectedProject ? (
                      <ProjectAvatar project={selectedProject} size={16} />
                    ) : undefined
                  }
                >
                  {selectedProject ? (
                    <Text ellipsis>{selectedProject.slug}</Text>
                  ) : (
                    triggerProps.children
                  )}
                </OverlayTrigger.Button>
              )}
            />
          }
        />
      ) : null}

      <EventDrawerBody>
        <div>
          <Title>{t('Details')}</Title>
          <Grid align="start" gap="2xl" columns="1fr 1fr">
            <ErrorBoundary mini>
              <GeneralCard
                isMetaError={isMetaError}
                projectSlug={project?.slug}
                release={release}
                releaseMeta={releaseMeta}
              />
            </ErrorBoundary>

            <ErrorBoundary mini>
              <DeploysCard release={release} projectSlug={project?.slug} />
            </ErrorBoundary>
          </Grid>

          <Title>{t('New Issues')}</Title>
          <ErrorBoundary mini>
            <NewIssues projectId={projectId} release={release} />
          </ErrorBoundary>

          <ErrorBoundary mini>
            <CommitsFilesSection
              isLoadingMeta={isLoadingMeta}
              isMetaError={isMetaError}
              releaseMeta={releaseMeta}
              projectSlug={project?.slug}
              release={release}
            />
          </ErrorBoundary>
        </div>
      </EventDrawerBody>
    </Fragment>
  );
}

function EnsureSingleProject({
  releaseMeta,
  onProjectSelect,
}: {
  onProjectSelect: (selectedProjectId: string) => void;
  releaseMeta: NonNullable<ReturnType<typeof useReleaseMeta>['data']>;
}) {
  const projectOptions = (releaseMeta.projects ?? []).map(project => ({
    value: String(project.id),
    label: <ProjectBadge project={project} disableLink />,
  }));

  return (
    <EventDrawerBody>
      <Stack gap="xl" height="100vh">
        <Alert variant="info" showIcon={false}>
          {t(
            'This release exists in multiple projects. Please select a project to view details.'
          )}
        </Alert>
        <Select
          options={projectOptions}
          value={null}
          placeholder={t('Select a project')}
          onChange={(option: {value: string} | null) => {
            if (option?.value) {
              onProjectSelect(option.value);
            }
          }}
          clearable={false}
        />
      </Stack>
    </EventDrawerBody>
  );
}

export function ReleasesDrawerDetails({
  end,
  release,
  projectId: projectIdProp,
  start,
}: ReleasesDrawerDetailsProps) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    isLoading: isLoadingMeta,
    isError: isMetaError,
    data: releaseMeta,
  } = useReleaseMeta({release});
  const projectsFromMeta = releaseMeta?.projects ?? [];
  const hasMultipleProjects =
    !projectIdProp && !isLoadingMeta && projectsFromMeta.length > 1;

  // projectId is either explicitly defined in the URL, or if there is a single project in release meta
  const projectId =
    projectIdProp ||
    (hasMultipleProjects
      ? undefined
      : projectsFromMeta[0]?.id
        ? String(projectsFromMeta[0]?.id)
        : undefined);

  const project = useProjectFromId({
    project_id: projectId,
  });

  const {
    // oxlint-disable-next-line react/todo
    [ReleasesDrawerFields.RELEASE]: _release,
    // oxlint-disable-next-line react/todo
    [ReleasesDrawerFields.RELEASE_PROJECT_ID]: _releaseProjectId,
    ...locationQueryWithoutRelease
  } = location.query;

  const handleProjectSelect = useCallback(
    (selectedProjectId: string) => {
      navigate(
        {
          pathname: location.pathname,
          query: {
            ...location.query,
            [ReleasesDrawerFields.RELEASE_PROJECT_ID]: selectedProjectId,
          },
        },
        {replace: true}
      );
    },
    [location, navigate]
  );

  const crumbs: BreadcrumbListProps['items'] =
    start && end
      ? [
          {
            type: 'link',
            label: t('Releases'),
            to: {
              query: {
                ...locationQueryWithoutRelease,
                [ReleasesDrawerFields.START]: start.toISOString(),
                [ReleasesDrawerFields.END]: end.toISOString(),
              },
            },
          },
        ]
      : [];
  const displayVersion = formatVersion(release);

  const showContent =
    project &&
    // there is a project id in the url, so display content which has placeholders when releaseMeta is loading
    (projectIdProp ||
      // otherwise, we need to wait for releaseMeta to load and make sure there is only one project
      (!isLoadingMeta &&
        !isMetaError &&
        projectsFromMeta.length === 1 &&
        projectsFromMeta[0] &&
        projectId));

  // show project select if releaseMeta is loaded and there are multiple projects in the release
  const showProjectSelect = releaseMeta && hasMultipleProjects;

  const contentProjectId = projectIdProp || projectId;

  return (
    <EventDrawerContainer>
      <DrawerHeader>
        <ErrorBoundary mini>
          <DrawerBreadcrumbs
            items={crumbs}
            current={{
              label: displayVersion,
              labelTooltip: displayVersion === release ? undefined : release,
              // Reserve the avatar's slot while the release's project resolves,
              // so the version label doesn't shift when it appears.
              leadingGraphic: project ? (
                <ProjectAvatar project={project} size={16} />
              ) : isLoadingMeta ? (
                <Placeholder
                  width="16px"
                  height="16px"
                  testId="release-project-placeholder"
                />
              ) : undefined,
              trailingActions: showContent
                ? {
                    type: 'button',
                    element: (
                      <LinkButton
                        size="zero"
                        variant="transparent"
                        icon={<IconExpand />}
                        aria-label={t('View Full Details')}
                        tooltipProps={{title: t('View Full Details')}}
                        to={normalizeUrl({
                          pathname: makeReleasesPathname({
                            path: `/${encodeURIComponent(release)}/`,
                            organization,
                          }),
                          query: {
                            project: contentProjectId,
                          },
                        })}
                        onClick={() => {
                          trackAnalytics('releases.drawer_view_full_details', {
                            organization: organization.id,
                            project_id: String(contentProjectId),
                          });
                        }}
                      />
                    ),
                  }
                : undefined,
            }}
          />
        </ErrorBoundary>
      </DrawerHeader>

      <ErrorBoundary>
        {showContent ? (
          <ReleasesDrawerContent
            release={release}
            projectId={contentProjectId}
            project={project}
            releaseMeta={releaseMeta}
            isMetaError={isMetaError}
            isLoadingMeta={isLoadingMeta}
            onProjectSelect={handleProjectSelect}
          />
        ) : isLoadingMeta ? (
          <LoadingIndicator />
        ) : showProjectSelect ? (
          <EnsureSingleProject
            releaseMeta={releaseMeta}
            onProjectSelect={handleProjectSelect}
          />
        ) : (
          <EventDrawerBody>
            <Alert variant="danger" showIcon={false}>
              {project || isMetaError ? t('Release not found') : t('Project not found')}
            </Alert>
          </EventDrawerBody>
        )}
      </ErrorBoundary>
    </EventDrawerContainer>
  );
}

const Title = styled('div')`
  font-size: ${p => p.theme.font.size.lg};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin-bottom: ${p => p.theme.space.md};
`;
