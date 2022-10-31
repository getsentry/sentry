import {createContext} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';

import Alert from 'sentry/components/alert';
import AsyncComponent from 'sentry/components/asyncComponent';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import PickProjectToContinue from 'sentry/components/pickProjectToContinue';
import {PAGE_URL_PARAM, URL_PARAM} from 'sentry/constants/pageFilters';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {
  Deploy,
  Organization,
  PageFilters,
  ReleaseMeta,
  ReleaseProject,
  ReleaseWithHealth,
  SessionApiResponse,
  SessionFieldWithOperation,
} from 'sentry/types';
import {formatVersion} from 'sentry/utils/formatters';
import withRouteAnalytics, {
  WithRouteAnalyticsProps,
} from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import routeTitleGen from 'sentry/utils/routeTitle';
import {getCount} from 'sentry/utils/sessions';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import AsyncView from 'sentry/views/asyncView';

import {getReleaseBounds, ReleaseBounds, searchReleaseVersion} from '../utils';

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

type Props = RouteComponentProps<RouteParams, {}> &
  WithRouteAnalyticsProps & {
    organization: Organization;
    releaseMeta: ReleaseMeta;
    selection: PageFilters;
  };

type State = {
  deploys: Deploy[];
  release: ReleaseWithHealth;
  sessions: SessionApiResponse | null;
} & AsyncView['state'];

class ReleasesDetail extends AsyncView<Props, State> {
  shouldReload = true;

  getTitle() {
    const {params, organization, selection} = this.props;
    const {release} = this.state;

    // The release details page will always have only one project selected
    const project = release?.projects.find(p => p.id === selection.projects[0]);

    return routeTitleGen(
      t('Release %s', formatVersion(params.release)),
      organization.slug,
      false,
      project?.slug
    );
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      deploys: [],
      sessions: null,
    };
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const {organization, params, location} = this.props;

    if (
      prevProps.params.release !== params.release ||
      prevProps.organization.slug !== organization.slug ||
      !isEqual(
        this.pickLocationQuery(prevProps.location),
        this.pickLocationQuery(location)
      )
    ) {
      super.componentDidUpdate(prevProps, prevState);
    }
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, location, params, releaseMeta} = this.props;

    const basePath = `/organizations/${organization.slug}/releases/${encodeURIComponent(
      params.release
    )}/`;

    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      [
        'release',
        basePath,
        {
          query: {
            adoptionStages: 1,
            ...normalizeDateTimeParams(this.pickLocationQuery(location)),
          },
        },
      ],
    ];

    if (releaseMeta.deployCount > 0) {
      endpoints.push(['deploys', `${basePath}deploys/`]);
    }

    // Used to figure out if the release has any health data
    endpoints.push([
      'sessions',
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
      {
        allowError: error => error.status === 400,
      },
    ]);

    return endpoints;
  }

  pickLocationQuery(location: Location) {
    return pick(location.query, [
      ...Object.values(URL_PARAM),
      ...Object.values(PAGE_URL_PARAM),
    ]);
  }

  renderError(...args) {
    const possiblyWrongProject = Object.values(this.state.errors).find(
      e => e?.status === 404 || e?.status === 403
    );

    if (possiblyWrongProject) {
      return (
        <PageContent>
          <Alert type="error" showIcon>
            {t('This release may not be in your selected project.')}
          </Alert>
        </PageContent>
      );
    }

    return super.renderError(...args);
  }

  renderLoading() {
    return (
      <PageContent>
        <LoadingIndicator />
      </PageContent>
    );
  }

  renderBody() {
    const {organization, location, selection, releaseMeta} = this.props;
    const {release, deploys, sessions, reloading} = this.state;
    const project = release?.projects.find(p => p.id === selection.projects[0]);
    const releaseBounds = getReleaseBounds(release);

    if (!project || !release) {
      if (reloading) {
        return <LoadingIndicator />;
      }

      return null;
    }

    return (
      <NoProjectMessage organization={organization}>
        <StyledPageContent>
          <ReleaseHeader
            location={location}
            organization={organization}
            release={release}
            project={project}
            releaseMeta={releaseMeta}
            refetchData={this.fetchData}
          />
          <ReleaseContext.Provider
            value={{
              release,
              project,
              deploys,
              releaseMeta,
              refetchData: this.fetchData,
              hasHealthData:
                getCount(sessions?.groups, SessionFieldWithOperation.SESSIONS) > 0,
              releaseBounds,
            }}
          >
            {this.props.children}
          </ReleaseContext.Provider>
        </StyledPageContent>
      </NoProjectMessage>
    );
  }
}

type ReleasesDetailContainerProps = Omit<Props, 'releaseMeta'>;
type ReleasesDetailContainerState = {
  releaseMeta: ReleaseMeta | null;
} & AsyncComponent['state'];
class ReleasesDetailContainer extends AsyncComponent<
  ReleasesDetailContainerProps,
  ReleasesDetailContainerState
> {
  shouldReload = true;

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, params} = this.props;
    // fetch projects this release belongs to
    return [
      [
        'releaseMeta',
        `/organizations/${organization.slug}/releases/${encodeURIComponent(
          params.release
        )}/meta/`,
      ],
    ];
  }

  componentDidMount() {
    this.removeGlobalDateTimeFromUrl();
    this.props.setRouteAnalyticsParams({release: this.props.params.release});
  }

  componentDidUpdate(
    prevProps: ReleasesDetailContainerProps,
    prevState: ReleasesDetailContainerState
  ) {
    const {organization, params} = this.props;

    this.removeGlobalDateTimeFromUrl();
    if (
      prevProps.params.release !== params.release ||
      prevProps.organization.slug !== organization.slug
    ) {
      super.componentDidUpdate(prevProps, prevState);
    }
  }

  removeGlobalDateTimeFromUrl() {
    const {router, location} = this.props;
    const {start, end, statsPeriod, utc, ...restQuery} = location.query;

    if (start || end || statsPeriod || utc) {
      router.replace({
        ...location,
        query: restQuery,
      });
    }
  }

  renderError(...args) {
    const has404Errors = Object.values(this.state.errors).find(e => e?.status === 404);

    if (has404Errors) {
      // This catches a 404 coming from the release endpoint and displays a custom error message.
      return (
        <PageContent>
          <Alert type="error" showIcon>
            {t('This release could not be found.')}
          </Alert>
        </PageContent>
      );
    }

    return super.renderError(...args);
  }

  isProjectMissingInUrl() {
    const projectId = this.props.location.query.project;

    return !projectId || typeof projectId !== 'string';
  }

  renderLoading() {
    return (
      <PageContent>
        <LoadingIndicator />
      </PageContent>
    );
  }

  renderProjectsFooterMessage() {
    return (
      <ProjectsFooterMessage>
        <IconInfo size="xs" /> {t('Only projects with this release are visible.')}
      </ProjectsFooterMessage>
    );
  }

  renderBody() {
    const {organization, params, router} = this.props;
    const {releaseMeta} = this.state;

    if (!releaseMeta) {
      return null;
    }

    const {projects} = releaseMeta;

    if (this.isProjectMissingInUrl()) {
      return (
        <PickProjectToContinue
          projects={projects.map(({id, slug}) => ({
            id: String(id),
            slug,
          }))}
          router={router}
          nextPath={{
            pathname: `/organizations/${organization.slug}/releases/${encodeURIComponent(
              params.release
            )}/`,
          }}
          noProjectRedirectPath={`/organizations/${organization.slug}/releases/`}
        />
      );
    }

    return (
      <PageFiltersContainer
        shouldForceProject={projects.length === 1}
        forceProject={
          projects.length === 1 ? {...projects[0], id: String(projects[0].id)} : undefined
        }
        specificProjectSlugs={projects.map(p => p.slug)}
      >
        <ReleasesDetail {...this.props} releaseMeta={releaseMeta} />
      </PageFiltersContainer>
    );
  }
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const ProjectsFooterMessage = styled('div')`
  display: grid;
  align-items: center;
  grid-template-columns: min-content 1fr;
  gap: ${space(1)};
`;

export {ReleaseContext, ReleasesDetailContainer};
export default withRouteAnalytics(
  withPageFilters(withOrganization(ReleasesDetailContainer))
);
