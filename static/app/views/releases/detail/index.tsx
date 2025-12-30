import {createContext, useCallback, useEffect, useMemo} from 'react';
import {Outlet} from 'react-router-dom';
import type {Location} from 'history';
import pick from 'lodash/pick';

import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import PickProjectToContinue from 'sentry/components/pickProjectToContinue';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {PAGE_URL_PARAM, URL_PARAM} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import type {SessionApiResponse} from 'sentry/types/organization';
import {SessionFieldWithOperation} from 'sentry/types/organization';
import type {
  Deploy,
  ReleaseMeta,
  ReleaseProject,
  ReleaseWithHealth,
} from 'sentry/types/release';
import {useApiQuery} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import routeTitleGen from 'sentry/utils/routeTitle';
import {getCount} from 'sentry/utils/sessions';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useParams} from 'sentry/utils/useParams';
import useRouter from 'sentry/utils/useRouter';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import type {ReleaseBounds} from 'sentry/views/releases/utils';
import {getReleaseBounds, searchReleaseVersion} from 'sentry/views/releases/utils';
import {makeReleasesPathname} from 'sentry/views/releases/utils/pathnames';
import {useReleaseMeta} from 'sentry/views/releases/utils/useReleaseMeta';

import ReleaseHeader from './header/releaseHeader';

type ReleaseContextType = {
  deploys: Deploy[];
  hasHealthData: boolean;
  project: Required<ReleaseProject>;
  refetchData: () => void;
  release: ReleaseWithHealth;
  releaseBounds: ReleaseBounds;
  releaseMeta: ReleaseMeta;
};
const ReleaseContext = createContext<ReleaseContextType>({} as ReleaseContextType);

function pickLocationQuery(location: Location) {
  return pick(location.query, [
    ...Object.values(URL_PARAM),
    ...Object.values(PAGE_URL_PARAM),
  ]);
}

function ReleasesDetail({
  children,
  releaseMeta,
}: {
  children: React.ReactNode;
  releaseMeta: ReleaseMeta;
}) {
  const params = useParams<{release: string}>();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const location = useLocation();
  const releasePath = `/organizations/${organization.slug}/releases/${encodeURIComponent(
    params.release
  )}/`;

  const {
    data: release,
    refetch: refetchRelease,
    isPending: isReleasePending,
    error: releaseError,
  } = useApiQuery<ReleaseWithHealth>(
    [
      releasePath,
      {
        query: {
          adoptionStages: 1,
          ...normalizeDateTimeParams(pickLocationQuery(location)),
        },
      },
    ],
    {staleTime: Infinity}
  );
  const isDeploysEnabled = releaseMeta.deployCount > 0;
  const {
    data: deploys = [],
    refetch: refetchDeploys,
    isPending: isDeploysPending,
    error: deploysError,
  } = useApiQuery<Deploy[]>(
    [`${releasePath}deploys/`, {query: {project: location.query.project}}],
    {staleTime: Infinity, enabled: isDeploysEnabled}
  );

  const {
    data: sessions = null,
    refetch: refetchSessions,
    isPending: isSessionsPending,
    error: sessionsError,
  } = useApiQuery<SessionApiResponse>(
    [
      `/organizations/${organization.slug}/sessions/`,
      {
        query: {
          project: location.query.project,
          environment: location.query.environment ?? [],
          query: searchReleaseVersion(params.release),
          field: 'sum(session)',
          statsPeriod: '90d',
          interval: '1d',
        },
      },
    ],
    {staleTime: Infinity}
  );

  const refetchData = useCallback(() => {
    refetchRelease();
    refetchDeploys();
    refetchSessions();
  }, [refetchRelease, refetchDeploys, refetchSessions]);

  const pageTitle = useMemo(() => {
    const project = release?.projects.find(p => p.id === selection.projects[0]);
    return routeTitleGen(
      t('Release %s', formatVersion(params.release)),
      organization.slug,
      false,
      project?.slug
    );
  }, [organization, params.release, selection.projects, release]);

  const renderErrors = useCallback(
    (errors: RequestError[]) => {
      const possiblyWrongProject = errors.find(
        e => e?.status === 404 || e?.status === 403
      );
      return (
        <SentryDocumentTitle title={pageTitle}>
          <Layout.Page>
            <Alert.Container>
              <Alert variant="danger">
                {possiblyWrongProject
                  ? t('This release may not be in your selected project.')
                  : t('There was an error loading the release details')}
              </Alert>
            </Alert.Container>
          </Layout.Page>
        </SentryDocumentTitle>
      );
    },
    [pageTitle]
  );

  // Remove null values and status 400 errors -> Only show non-400 errors.
  const visibleErrors = [releaseError, deploysError, sessionsError]
    .filter(e => e !== null)
    .filter(e => e?.status !== 400);

  if (visibleErrors.length) {
    return renderErrors(visibleErrors);
  }

  const isPending =
    isReleasePending || (isDeploysEnabled && isDeploysPending) || isSessionsPending;
  if (isPending) {
    return (
      <SentryDocumentTitle title={pageTitle}>
        <Layout.Page>
          <LoadingIndicator />
        </Layout.Page>
      </SentryDocumentTitle>
    );
  }

  const project = release?.projects.find(p => p.id === selection.projects[0]);
  const releaseBounds = getReleaseBounds(release);

  if (!project || !release) {
    return null;
  }

  return (
    <SentryDocumentTitle title={pageTitle}>
      <Layout.Page>
        <NoProjectMessage organization={organization}>
          <ReleaseHeader
            location={location}
            organization={organization}
            release={release}
            project={project}
            releaseMeta={releaseMeta}
            refetchData={refetchData}
          />
          <ReleaseContext
            value={{
              release,
              project,
              deploys,
              releaseMeta,
              refetchData,
              hasHealthData:
                getCount(sessions?.groups, SessionFieldWithOperation.SESSIONS) > 0,
              releaseBounds,
            }}
          >
            {children}
          </ReleaseContext>
        </NoProjectMessage>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

// ========================================================================
// RELEASE DETAIL CONTAINER
// ========================================================================
function ReleasesDetailContainer() {
  const params = useParams<{release: string}>();
  const location = useLocation();
  const navigate = useNavigate();
  const router = useRouter();
  const organization = useOrganization();
  const {release} = params;

  useRouteAnalyticsParams({release});

  // Remove global date time from URL
  useEffect(() => {
    const {start, end, statsPeriod, utc, ...restQuery} = location.query;

    if (start || end || statsPeriod || utc) {
      navigate(
        {
          ...location,
          query: restQuery,
        },
        {replace: true}
      );
    }
  }, [location, navigate]);

  const {data: releaseMeta, isPending, isError, error} = useReleaseMeta({release});

  if (isPending) {
    return (
      <Layout.Page>
        <LoadingIndicator />
      </Layout.Page>
    );
  }

  if (isError && error.status === 404) {
    // This catches a 404 coming from the release endpoint and displays a custom error message.
    return (
      <Layout.Page withPadding>
        <Alert.Container>
          <Alert variant="danger">{t('This release could not be found.')}</Alert>
        </Alert.Container>
      </Layout.Page>
    );
  }

  if (isError || !releaseMeta) {
    return <LoadingError />;
  }

  const {projects} = releaseMeta;
  const projectId = location.query.project;
  const isProjectMissingInUrl = !projectId || typeof projectId !== 'string';

  if (isProjectMissingInUrl) {
    return (
      <PickProjectToContinue
        projects={projects.map(({id, slug}: ReleaseProject) => ({
          id: String(id),
          slug,
        }))}
        router={router}
        nextPath={{
          pathname: makeReleasesPathname({
            path: `/${encodeURIComponent(release)}/`,
            organization,
          }),
        }}
        noProjectRedirectPath={makeReleasesPathname({
          organization,
          path: '/',
        })}
      />
    );
  }

  return (
    <PageFiltersContainer
      shouldForceProject={projects.length === 1}
      forceProject={
        projects.length === 1 ? {...projects[0]!, id: String(projects[0]!.id)} : undefined
      }
      specificProjectSlugs={projects.map((p: ReleaseProject) => p.slug)}
    >
      <ReleasesDetail releaseMeta={releaseMeta}>
        <Outlet />
      </ReleasesDetail>
    </PageFiltersContainer>
  );
}
export {ReleaseContext};
export default ReleasesDetailContainer;
