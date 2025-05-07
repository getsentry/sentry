import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import {logger} from '@sentry/core';

import {Alert} from 'sentry/components/core/alert';
import {LinkButton} from 'sentry/components/core/button';
import {Select} from 'sentry/components/core/select';
import {
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  Header,
  NavigationCrumbs,
} from 'sentry/components/events/eventDrawer';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PlatformList} from 'sentry/components/platformList';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
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
import {useReleaseDetails} from 'sentry/views/releases/utils/useReleaseDetails';
import {useReleaseMeta} from 'sentry/views/releases/utils/useReleaseMeta';

interface ReleasesDrawerDetailsProps {
  projectId: string | undefined;
  release: string;
}

interface ReleasesDrawerContentProps {
  isLoadingMeta: boolean;
  isMetaError: boolean;
  project: ReturnType<typeof useProjectFromId>;
  projectId: string;
  release: string;
  releaseDetailsQuery: ReturnType<typeof useReleaseDetails>;
  releaseMeta: ReturnType<typeof useReleaseMeta>['data'];
}

function ReleasesDrawerContent({
  release,
  projectId,
  project,
  releaseMeta,
  isMetaError,
  isLoadingMeta,
  releaseDetailsQuery,
}: ReleasesDrawerContentProps) {
  const organization = useOrganization();

  return (
    <Fragment>
      <EventNavigator>
        <HeaderToolbar>
          <ReleaseWithPlatform>
            <PlatformList
              platforms={releaseDetailsQuery.data?.projects?.map(
                ({platform}) => platform
              )}
            />
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
      </EventNavigator>

      <EventDrawerBody>
        <div>
          <Title>{t('Details')}</Title>
          <Details>
            <GeneralCard
              isMetaError={isMetaError}
              projectSlug={project?.slug}
              release={release}
              releaseMeta={releaseMeta}
            />

            <DeploysCard release={release} projectSlug={project?.slug} />
          </Details>

          <Title>{t('New Issues')}</Title>
          <NewIssues projectId={projectId} release={release} />

          <CommitsFilesSection
            isLoadingMeta={isLoadingMeta}
            isMetaError={isMetaError}
            releaseMeta={releaseMeta}
            projectSlug={project?.slug}
            release={release}
          />
        </div>
      </EventDrawerBody>
    </Fragment>
  );
}

function EnsureSingleProject({
  releaseMeta,
}: {
  releaseMeta: NonNullable<ReturnType<typeof useReleaseMeta>['data']>;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleProjectSelect = (selectedProjectId: string) => {
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
  };
  const projectOptions = (releaseMeta.projects ?? []).map(project => ({
    value: String(project.id),
    label: project.slug,
  }));

  return (
    <EventDrawerBody>
      <ProjectSelectContainer>
        <Alert type="info">
          {t(
            'This release exists in multiple projects. Please select a project to view details.'
          )}
        </Alert>
        <Select
          options={projectOptions}
          placeholder={t('Select a project')}
          onChange={(option: {value: string} | null) => {
            if (option?.value) {
              handleProjectSelect(option.value);
            }
          }}
          isClearable={false}
          styles={{container: (base: any) => ({...base, marginTop: space(2)})}}
        />
      </ProjectSelectContainer>
    </EventDrawerBody>
  );
}

export function ReleasesDrawerDetails({
  release,
  projectId: projectIdProp,
}: ReleasesDrawerDetailsProps) {
  const location = useLocation();
  const {
    isLoading: isLoadingMeta,
    isError: isMetaError,
    data: releaseMeta,
  } = useReleaseMeta({release});
  const {[ReleasesDrawerFields.RELEASE_PROJECT_ID]: releaseProjectIdParam} =
    useLocationQuery({
      fields: {
        [ReleasesDrawerFields.RELEASE_PROJECT_ID]: decodeScalar,
      },
    });

  const hasMultipleProjects =
    !projectIdProp &&
    // !releaseProjectIdParam &&
    !isLoadingMeta &&
    (releaseMeta?.projects?.length ?? 0) > 1;

  const releaseDetailsQuery = useReleaseDetails(
    {release},
    {enabled: !hasMultipleProjects}
  );

  const projectId =
    projectIdProp ||
    releaseProjectIdParam ||
    (hasMultipleProjects
      ? undefined
      : releaseMeta?.projects?.[0]?.id
        ? String(releaseMeta.projects[0]?.id)
        : undefined);

  const project = useProjectFromId({
    project_id: projectId,
  });

  useEffect(() => {
    if (releaseMeta?.projects?.length && releaseMeta.projects.length > 1) {
      logger.debug('ReleaseDrawer: release is in multiple projects');
    }
  }, [releaseMeta?.projects]);

  const {
    [ReleasesDrawerFields.RELEASE]: _release,
    [ReleasesDrawerFields.RELEASE_PROJECT_ID]: _releaseProjectId,
    ...locationQueryWithoutRelease
  } = location.query;

  const crumbs = [
    {
      label: (
        <Link
          to={{
            query: locationQueryWithoutRelease,
          }}
        >
          {t('Releases')}
        </Link>
      ),
    },
    {label: formatVersion(release)},
  ];

  return (
    <EventDrawerContainer>
      <EventDrawerHeader>
        <NavigationCrumbs crumbs={crumbs} />
      </EventDrawerHeader>
      {isLoadingMeta ? (
        <LoadingIndicator />
      ) : isMetaError && !project ? (
        <EventDrawerBody>
          <Alert type="error">{t('Project not found')}</Alert>
        </EventDrawerBody>
      ) : releaseMeta ? (
        projectId ? (
          <ReleasesDrawerContent
            release={release}
            projectId={projectId}
            project={project}
            releaseMeta={releaseMeta}
            isMetaError={isMetaError}
            isLoadingMeta={isLoadingMeta}
            releaseDetailsQuery={releaseDetailsQuery}
          />
        ) : (
          <EnsureSingleProject releaseMeta={releaseMeta} />
        )
      ) : (
        <div>Error</div>
      )}
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
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  margin-bottom: ${space(1)};
`;

const ReleaseWithPlatform = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const HeaderToolbar = styled(Header)`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ProjectSelectContainer = styled('div')`
  height: 100vh;
`;
