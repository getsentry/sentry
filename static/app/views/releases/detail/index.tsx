import {createContext, useCallback, useEffect} from 'react';
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
import {makeReleasesPathname} from 'sentry/views/releases/utils/pathnames';
import {useReleaseMeta} from 'sentry/views/releases/utils/useReleaseMeta';

import type {ReleaseBounds} from '../utils';
import {getReleaseBounds, searchReleaseVersion} from '../utils';

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

type RouteParams = {
  orgId: string;
  release: string;
};

type Props = {
  children: React.ReactNode;
  releaseMeta: ReleaseMeta;
};

function pickLocationQuery(location: Location) {
  return pick(location.query, [
    ...Object.values(URL_PARAM),
    ...Object.values(PAGE_URL_PARAM),
  ]);
}

function ReleasesDetail({children, releaseMeta}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const {selection} = usePageFilters();
  const {release} = useParams<RouteParams>();

  const basePath = `/organizations/${organization.slug}/releases/${encodeURIComponent(
    release
  )}/`;

  const releaseQuery = useApiQuery<ReleaseWithHealth>(
    [
      basePath,
      {
        query: {
          adoptionStages: 1,
          ...normalizeDateTimeParams(pickLocationQuery(location)),
        },
      },
    ],
    {
      staleTime: 0,
    }
  );

  const deploysQuery = useApiQuery<Deploy[]>(
    [
      `${basePath}deploys/`,
      {
        query: {
          project: location.query.project,
        },
      },
    ],
    {enabled: releaseMeta.deployCount > 0, staleTime: 0}
  );

  const sessionsQuery = useApiQuery<SessionApiResponse>(
    [
      `/organizations/${organization.slug}/sessions/`,
      {
        query: {
          project: location.query.project,
          environment: location.query.environment ?? [],
          query: searchReleaseVersion(release),
          field: 'sum(session)',
          statsPeriod: '90d',
          interval: '1d',
        },
      },
    ],
    {staleTime: 0}
  );

  const refetchData = useCallback(() => {
    releaseQuery.refetch();
    deploysQuery.refetch();
    sessionsQuery.refetch();
  }, [releaseQuery, deploysQuery, sessionsQuery]);

  const isLoading =
    releaseQuery.isPending || deploysQuery.isPending || sessionsQuery.isPending;

  const isError =
    releaseQuery.isError ||
    deploysQuery.isError ||
    (sessionsQuery.isError && sessionsQuery.error.status !== 400);

  if (isError) {
    const possiblyWrongProject = [
      releaseQuery.error?.status,
      deploysQuery.error?.status,
      sessionsQuery.error?.status,
    ].find(status => status === 404 || status === 403);

    if (possiblyWrongProject) {
      return (
        <Layout.Page>
          <Alert.Container>
            <Alert type="error" showIcon>
              {t('This release may not be in your selected project.')}
            </Alert>
          </Alert.Container>
        </Layout.Page>
      );
    }

    return <LoadingError />;
  }

  if (isLoading) {
    return (
      <Layout.Page>
        <LoadingIndicator />
      </Layout.Page>
    );
  }

  const project = releaseQuery.data?.projects.find(p => p.id === selection.projects[0]);
  const releaseBounds = getReleaseBounds(releaseQuery.data);

  if (!project || !release) {
    return null;
  }
  return (
    <Layout.Page>
      <SentryDocumentTitle
        title={routeTitleGen(
          t('Release %s', formatVersion(release)),
          organization.slug,
          false,
          project?.slug
        )}
      />
      <NoProjectMessage organization={organization}>
        <ReleaseHeader
          location={location}
          organization={organization}
          release={releaseQuery.data}
          project={project}
          releaseMeta={releaseMeta}
          refetchData={refetchData}
        />
        <ReleaseContext
          value={{
            release: releaseQuery.data,
            project,
            deploys: deploysQuery.data || [],
            releaseMeta,
            refetchData,
            hasHealthData:
              getCount(sessionsQuery.data?.groups, SessionFieldWithOperation.SESSIONS) >
              0,
            releaseBounds,
          }}
        >
          {children}
        </ReleaseContext>
      </NoProjectMessage>
    </Layout.Page>
  );
}

// ========================================================================
// RELEASE DETAIL CONTAINER
// ========================================================================
type ReleasesDetailContainerProps = Omit<Props, 'releaseMeta'>;
function ReleasesDetailContainer(props: ReleasesDetailContainerProps) {
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
          <Alert type="error" showIcon>
            {t('This release could not be found.')}
          </Alert>
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
      <ReleasesDetail {...props} releaseMeta={releaseMeta} />
    </PageFiltersContainer>
  );
}
export {ReleaseContext, ReleasesDetailContainer};
export default ReleasesDetailContainer;
