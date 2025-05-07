import {forceCheck} from 'react-lazyload';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {fetchTagValues} from 'sentry/actionCreators/tags';
import type {Client} from 'sentry/api';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ReleasesSortOption} from 'sentry/constants/releases';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Tag} from 'sentry/types/group';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {Release} from 'sentry/types/release';
import {ReleaseStatus} from 'sentry/types/release';
import {DemoTourElement, DemoTourStep} from 'sentry/utils/demoMode/demoTours';
import {SEMVER_TAGS} from 'sentry/utils/discover/fields';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import withProjects from 'sentry/utils/withProjects';
import Header from 'sentry/views/releases/components/header';
import ReleaseArchivedNotice from 'sentry/views/releases/detail/overview/releaseArchivedNotice';
import ReleaseHealthCTA from 'sentry/views/releases/list/releaseHealthCTA';
import ReleaseListInner from 'sentry/views/releases/list/releaseListInner';
import {isMobileRelease} from 'sentry/views/releases/utils';

import ReleasesDisplayOptions, {ReleasesDisplayOption} from './releasesDisplayOptions';
import ReleasesSortOptions from './releasesSortOptions';
import ReleasesStatusOptions, {ReleasesStatusOption} from './releasesStatusOptions';

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams> & {
  api: Client;
  organization: Organization;
  projects: Project[];
  selection: PageFilters;
};

type State = {
  releases: Release[];
} & DeprecatedAsyncComponent['state'];

class ReleasesList extends DeprecatedAsyncComponent<Props, State> {
  shouldReload = true;
  shouldRenderBadRequests = true;

  filterKeys = [
    ...Object.values(SEMVER_TAGS),
    {
      key: 'release',
      name: 'release',
    },
  ].reduce((acc, tag) => {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    acc[tag.key] = tag;
    return acc;
  }, {});

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization, location} = this.props;
    const {statsPeriod} = location.query;
    const activeSort = this.getSort();
    const activeStatus = this.getStatus();

    const query = {
      ...pick(location.query, ['project', 'environment', 'cursor', 'query', 'sort']),
      summaryStatsPeriod: statsPeriod,
      per_page: 20,
      flatten: activeSort === ReleasesSortOption.DATE ? 0 : 1,
      adoptionStages: 1,
      status:
        activeStatus === ReleasesStatusOption.ARCHIVED
          ? ReleaseStatus.ARCHIVED
          : ReleaseStatus.ACTIVE,
    };

    const endpoints: ReturnType<DeprecatedAsyncComponent['getEndpoints']> = [
      [
        'releases', // stateKey
        `/organizations/${organization.slug}/releases/`, // endpoint
        {query}, // params
        {disableEntireQuery: true}, // options - prevent cursor from being passed into query
      ],
    ];
    return endpoints;
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    super.componentDidUpdate(prevProps, prevState);

    if (prevState.releases !== this.state.releases) {
      /**
       * Manually trigger checking for elements in viewport.
       * Helpful when LazyLoad components enter the viewport without resize or scroll events,
       * https://github.com/twobin/react-lazyload#forcecheck
       *
       * HealthStatsCharts are being rendered only when they are scrolled into viewport.
       * This is how we re-check them without scrolling once releases change as this view
       * uses shouldReload=true and there is no reloading happening.
       */
      forceCheck();
    }
  }

  getQuery() {
    const {query} = this.props.location.query;

    return typeof query === 'string' ? query : undefined;
  }

  getSort(): ReleasesSortOption {
    const {environments} = this.props.selection;
    const {sort} = this.props.location.query;

    // Require 1 environment for date adopted
    if (sort === ReleasesSortOption.ADOPTION && environments.length !== 1) {
      return ReleasesSortOption.DATE;
    }

    const sortExists = Object.values(ReleasesSortOption).includes(sort);
    if (sortExists) {
      return sort;
    }

    return ReleasesSortOption.DATE;
  }

  getDisplay(): ReleasesDisplayOption {
    const {display} = this.props.location.query;

    switch (display) {
      case ReleasesDisplayOption.USERS:
        return ReleasesDisplayOption.USERS;
      default:
        return ReleasesDisplayOption.SESSIONS;
    }
  }

  getStatus(): ReleasesStatusOption {
    const {status} = this.props.location.query;

    switch (status) {
      case ReleasesStatusOption.ARCHIVED:
        return ReleasesStatusOption.ARCHIVED;
      default:
        return ReleasesStatusOption.ACTIVE;
    }
  }

  getSelectedProject(): Project | undefined {
    const {selection, projects} = this.props;

    // Return the first project when 'All Projects' is displayed.
    // This ensures the onboarding panel is shown correctly, for example.
    if (selection.projects.length === 0) {
      return projects[0];
    }

    const selectedProjectId =
      selection.projects && selection.projects.length === 1 && selection.projects[0];
    return projects?.find(p => p.id === `${selectedProjectId}`);
  }

  getSelectedProjectSlugs(): string[] {
    const {selection, projects} = this.props;
    const projIdSet = new Set(selection.projects);

    return projects.reduce((result: string[], proj) => {
      if (projIdSet.has(Number(proj.id))) {
        result.push(proj.slug);
      }
      return result;
    }, []);
  }

  get projectHasSessions() {
    return this.getSelectedProject()?.hasSessions ?? null;
  }

  handleSearch = (query: string) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, query},
    });
  };

  handleSortBy = (sort: string) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, sort},
    });
  };

  handleDisplay = (display: string) => {
    const {location, router} = this.props;

    let sort = location.query.sort;
    if (
      sort === ReleasesSortOption.USERS_24_HOURS &&
      display === ReleasesDisplayOption.SESSIONS
    ) {
      sort = ReleasesSortOption.SESSIONS_24_HOURS;
    } else if (
      sort === ReleasesSortOption.SESSIONS_24_HOURS &&
      display === ReleasesDisplayOption.USERS
    ) {
      sort = ReleasesSortOption.USERS_24_HOURS;
    } else if (
      sort === ReleasesSortOption.CRASH_FREE_USERS &&
      display === ReleasesDisplayOption.SESSIONS
    ) {
      sort = ReleasesSortOption.CRASH_FREE_SESSIONS;
    } else if (
      sort === ReleasesSortOption.CRASH_FREE_SESSIONS &&
      display === ReleasesDisplayOption.USERS
    ) {
      sort = ReleasesSortOption.CRASH_FREE_USERS;
    }

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, display, sort},
    });
  };

  handleStatus = (status: string) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, status},
    });
  };

  tagValueLoader = (key: string, search: string) => {
    const {location, organization} = this.props;
    const {project: projectId} = location.query;

    return fetchTagValues({
      api: this.api,
      orgSlug: organization.slug,
      tagKey: key,
      search,
      projectIds: projectId ? [projectId] : undefined,
      endpointParams: normalizeDateTimeParams(location.query),
    });
  };

  getTagValues = async (tag: Tag, currentQuery: string): Promise<string[]> => {
    const values = await this.tagValueLoader(tag.key, currentQuery);
    return values.map(({value}) => value);
  };

  renderLoading() {
    return this.renderBody();
  }

  renderError() {
    return this.renderBody();
  }

  get shouldShowQuickstart() {
    const {releases} = this.state;

    const selectedProject = this.getSelectedProject();
    const hasReleasesSetup = selectedProject?.features.includes('releases');

    return !releases?.length && !hasReleasesSetup && selectedProject;
  }

  renderBody() {
    const {organization, selection} = this.props;
    const {releases, reloading, error} = this.state;

    const activeSort = this.getSort();
    const activeStatus = this.getStatus();
    const activeDisplay = this.getDisplay();

    const hasAnyMobileProject = selection.projects
      .map(id => `${id}`)
      .map(ProjectsStore.getById)
      .some(project => project?.platform && isMobileRelease(project.platform));
    const showReleaseAdoptionStages =
      hasAnyMobileProject && selection.environments.length === 1;

    return (
      <PageFiltersContainer showAbsolute={false}>
        <SentryDocumentTitle title={t('Releases')} orgSlug={organization.slug} />
        <NoProjectMessage organization={organization}>
          <Header />
          <Layout.Body>
            <Layout.Main fullWidth>
              <ReleaseHealthCTA
                organization={this.props.organization}
                releases={this.state.releases}
                selectedProject={this.getSelectedProject()}
                selection={this.props.selection}
              />

              <ReleasesPageFilterBar condensed>
                <DemoTourElement
                  id={DemoTourStep.RELEASES_COMPARE}
                  title={t('Compare releases')}
                  description={t(
                    'Click here and select the "react" project to see how the release is trending compared to previous releases.'
                  )}
                  position="bottom-start"
                >
                  <ProjectPageFilter />
                </DemoTourElement>
                <EnvironmentPageFilter />
                <DatePageFilter
                  disallowArbitraryRelativeRanges
                  menuFooterMessage={t(
                    'Changing this date range will recalculate the release metrics.'
                  )}
                />
              </ReleasesPageFilterBar>

              {this.shouldShowQuickstart ? null : (
                <SortAndFilterWrapper>
                  <StyledSearchQueryBuilder
                    searchOnChange={organization.features.includes('ui-search-on-change')}
                    onSearch={this.handleSearch}
                    initialQuery={this.getQuery() || ''}
                    filterKeys={this.filterKeys}
                    getTagValues={this.getTagValues}
                    placeholder={t('Search by version, build, package, or stage')}
                    searchSource="releases"
                    showUnsubmittedIndicator
                  />
                  <ReleasesStatusOptions
                    selected={activeStatus}
                    onSelect={this.handleStatus}
                  />
                  <ReleasesSortOptions
                    selected={activeSort}
                    selectedDisplay={activeDisplay}
                    onSelect={this.handleSortBy}
                    environments={selection.environments}
                  />
                  <ReleasesDisplayOptions
                    selected={activeDisplay}
                    onSelect={this.handleDisplay}
                  />
                </SortAndFilterWrapper>
              )}

              {!reloading &&
                activeStatus === ReleasesStatusOption.ARCHIVED &&
                !!releases?.length && <ReleaseArchivedNotice multi />}

              {error ? (
                super.renderError()
              ) : (
                <ReleaseListInner
                  activeDisplay={activeDisplay}
                  loading={this.state.loading}
                  location={this.props.location}
                  organization={this.props.organization}
                  releases={this.state.releases}
                  releasesPageLinks={this.state.releasesPageLinks}
                  reloading={this.state.reloading}
                  router={this.props.router}
                  selectedProject={this.getSelectedProject()}
                  selection={this.props.selection}
                  shouldShowQuickstart={this.shouldShowQuickstart}
                  showReleaseAdoptionStages={showReleaseAdoptionStages}
                />
              )}
              <FloatingFeedbackWidget />
            </Layout.Main>
          </Layout.Body>
        </NoProjectMessage>
      </PageFiltersContainer>
    );
  }
}

const ReleasesPageFilterBar = styled(PageFilterBar)`
  margin-bottom: ${space(2)};
`;

const SortAndFilterWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr repeat(3, max-content);
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: repeat(3, 1fr);
    & > div {
      width: auto;
    }
  }
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const StyledSearchQueryBuilder = styled(SearchQueryBuilder)`
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    grid-column: 1 / -1;
  }
`;

export default withApi(withProjects(withOrganization(withPageFilters(ReleasesList))));
