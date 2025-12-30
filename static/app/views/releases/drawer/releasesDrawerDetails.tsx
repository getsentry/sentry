import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import {Select} from 'sentry/components/core/select';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  Header,
  NavigationCrumbs,
} from 'sentry/components/events/eventDrawer';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import type {ReleaseMeta} from 'sentry/types/release';
import {trackAnalytics} from 'sentry/utils/analytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {CommitsFilesSection} from 'sentry/views/releases/drawer/commitsFilesSection';
import {DeploysCard} from 'sentry/views/releases/drawer/deploysCard';
import {GeneralCard} from 'sentry/views/releases/drawer/generalCard';
import {NewIssues} from 'sentry/views/releases/drawer/newIssues';
import {ReleasesDrawerFields} from 'sentry/views/releases/drawer/utils';
import {makeReleasesPathname} from 'sentry/views/releases/utils/pathnames';
import {useReleaseMeta} from 'sentry/views/releases/utils/useReleaseMeta';

interface ReleasesDrawerDetailsProps {
  end: Date | null;
  projectId: string | undefined;
  release: string;
  start: Date | null;
}

interface ReleasesDrawerContentProps {
  isLoadingMeta: boolean;
  isMetaError: boolean;
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
}: ReleasesDrawerContentProps) {
  const organization = useOrganization();
  const location = useLocation();

  return (
    <Fragment>
      <EventNavigator>
        <ErrorBoundary mini>
          <HeaderToolbar>
            <ReleaseWithPlatform>
              <ErrorBoundary mini>
                <SelectableProjectBadges>
                  {releaseMeta?.projects?.map(releaseProject => (
                    <SelectableProjectBadge
                      key={releaseProject.id}
                      data-test-id={`select-project-${releaseProject.id}`}
                      to={{
                        pathname: location.pathname,
                        query: {
                          ...location.query,
                          [ReleasesDrawerFields.RELEASE_PROJECT_ID]: releaseProject.id,
                        },
                      }}
                    >
                      <ProjectBadge
                        project={releaseProject}
                        hideName
                        avatarSize={16}
                        disableLink
                      />
                    </SelectableProjectBadge>
                  ))}
                </SelectableProjectBadges>
              </ErrorBoundary>
              {formatVersion(release)}
            </ReleaseWithPlatform>

            <LinkButton
              to={normalizeUrl({
                pathname: makeReleasesPathname({
                  path: `/${encodeURIComponent(release)}/`,
                  organization,
                }),
                query: {
                  project: projectId,
                },
              })}
              size="xs"
              onClick={() => {
                trackAnalytics('releases.drawer_view_full_details', {
                  organization: organization.id,
                  project_id: String(projectId),
                });
              }}
            >
              {t('View Full Details')}
            </LinkButton>
          </HeaderToolbar>
        </ErrorBoundary>
      </EventNavigator>

      <EventDrawerBody>
        <div>
          <Title>{t('Details')}</Title>
          <Details>
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
          </Details>

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
      <ProjectSelectContainer>
        <Alert variant="info" showIcon={false}>
          {t(
            'This release exists in multiple projects. Please select a project to view details.'
          )}
        </Alert>
        <Select
          options={projectOptions}
          placeholder={t('Select a project')}
          onChange={(option: {value: string} | null) => {
            if (option?.value) {
              onProjectSelect(option.value);
            }
          }}
          isClearable={false}
        />
      </ProjectSelectContainer>
    </EventDrawerBody>
  );
}

export function ReleasesDrawerDetails({
  end,
  release,
  projectId: projectIdProp,
  start,
}: ReleasesDrawerDetailsProps) {
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
    [ReleasesDrawerFields.RELEASE]: _release,
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

  const crumbs = [
    {
      label:
        start && end ? (
          <Link
            to={{
              query: {
                ...locationQueryWithoutRelease,
                [ReleasesDrawerFields.START]: start.toISOString(),
                [ReleasesDrawerFields.END]: end.toISOString(),
              },
            }}
          >
            {t('Releases')}
          </Link>
        ) : (
          t('Releases')
        ),
    },
    {label: formatVersion(release)},
  ];

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

  return (
    <EventDrawerContainer>
      <EventDrawerHeader>
        <ErrorBoundary mini>
          <NavigationCrumbs crumbs={crumbs} />
        </ErrorBoundary>
      </EventDrawerHeader>

      <ErrorBoundary>
        {showContent ? (
          <ReleasesDrawerContent
            release={release}
            projectId={projectIdProp || projectId}
            project={project}
            releaseMeta={releaseMeta}
            isMetaError={isMetaError}
            isLoadingMeta={isLoadingMeta}
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

const Details = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(3)};
  align-items: start;
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin-bottom: ${space(1)};
`;

const ReleaseWithPlatform = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const SelectableProjectBadges = styled('div')`
  display: flex;
  & > :not(:first-child) {
    margin-left: -${space(0.5)};
  }
`;

const SelectableProjectBadge = styled(Link)`
  display: flex;
  cursor: pointer;

  & img {
    cursor: pointer;
  }
`;

const HeaderToolbar = styled(Header)`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ProjectSelectContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  height: 100vh;
`;
