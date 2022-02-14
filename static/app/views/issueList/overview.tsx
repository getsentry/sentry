import * as React from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {withProfiler} from '@sentry/react';
import * as Sentry from '@sentry/react';
import {Location} from 'history';
import Cookies from 'js-cookie';
import isEqual from 'lodash/isEqual';
import mapValues from 'lodash/mapValues';
import omit from 'lodash/omit';
import pickBy from 'lodash/pickBy';
import * as qs from 'query-string';

import {fetchOrgMembers, indexMembersByProject} from 'sentry/actionCreators/members';
import {
  deleteSavedSearch,
  fetchSavedSearches,
  resetSavedSearches,
} from 'sentry/actionCreators/savedSearches';
import {fetchTagValues, loadOrganizationTags} from 'sentry/actionCreators/tags';
import GroupActions from 'sentry/actions/groupActions';
import {Client} from 'sentry/api';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {extractSelectionParameters} from 'sentry/components/organizations/pageFilters/utils';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import {Panel, PanelBody} from 'sentry/components/panels';
import QueryCount from 'sentry/components/queryCount';
import StreamGroup from 'sentry/components/stream/group';
import ProcessingIssueList from 'sentry/components/stream/processingIssueList';
import {DEFAULT_QUERY, DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {tct} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import {PageContent} from 'sentry/styles/organization';
import {
  BaseGroup,
  Group,
  Member,
  Organization,
  PageFilters,
  SavedSearch,
  TagCollection,
} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {callIfFunction} from 'sentry/utils/callIfFunction';
import CursorPoller from 'sentry/utils/cursorPoller';
import {getUtcDateString} from 'sentry/utils/dates';
import getCurrentSentryReactTransaction from 'sentry/utils/getCurrentSentryReactTransaction';
import parseApiError from 'sentry/utils/parseApiError';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import StreamManager from 'sentry/utils/streamManager';
import withApi from 'sentry/utils/withApi';
import withIssueTags from 'sentry/utils/withIssueTags';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import withSavedSearches from 'sentry/utils/withSavedSearches';

import IssueListActions from './actions';
import IssueListFilters from './filters';
import IssueListHeader from './header';
import NoGroupsHandler from './noGroupsHandler';
import IssueListSidebar from './sidebar';
import {
  getTabs,
  getTabsWithCounts,
  isForReviewQuery,
  IssueDisplayOptions,
  IssueSortOptions,
  Query,
  QueryCounts,
  TAB_MAX_COUNT,
} from './utils';

const MAX_ITEMS = 25;
const DEFAULT_SORT = IssueSortOptions.DATE;
const DEFAULT_DISPLAY = IssueDisplayOptions.EVENTS;
// the default period for the graph in each issue row
const DEFAULT_GRAPH_STATS_PERIOD = '24h';
// the allowed period choices for graph in each issue row
const DYNAMIC_COUNTS_STATS_PERIODS = new Set(['14d', '24h', 'auto']);

type Params = {
  orgId: string;
};

type Props = {
  api: Client;
  location: Location;
  organization: Organization;
  params: Params;
  savedSearch: SavedSearch;
  savedSearchLoading: boolean;
  savedSearches: SavedSearch[];
  selection: PageFilters;
  tags: TagCollection;
} & RouteComponentProps<{searchId?: string}, {}>;

type State = {
  error: string | null;
  forReview: boolean;
  groupIds: string[];
  isSidebarVisible: boolean;
  issuesLoading: boolean;
  itemsRemoved: number;
  memberList: ReturnType<typeof indexMembersByProject>;
  pageLinks: string;
  /**
   * Current query total
   */
  queryCount: number;
  /**
   * Counts for each inbox tab
   */
  queryCounts: QueryCounts;
  queryMaxCount: number;
  realtimeActive: boolean;
  reviewedIds: string[];
  selectAllActive: boolean;
  tagsLoading: boolean;
  // Will be set to true if there is valid session data from issue-stats api call
  query?: string;
};

type EndpointParams = Partial<PageFilters['datetime']> & {
  environment: string[];
  project: number[];
  cursor?: string;
  display?: string;
  groupStatsPeriod?: string | null;
  page?: number | string;
  query?: string;
  sort?: string;
  statsPeriod?: string | null;
};

type CountsEndpointParams = Omit<EndpointParams, 'cursor' | 'page' | 'query'> & {
  query: string[];
};

type StatEndpointParams = Omit<EndpointParams, 'cursor' | 'page'> & {
  groups: string[];
  expand?: string | string[];
};

class IssueListOverview extends React.Component<Props, State> {
  state: State = this.getInitialState();

  getInitialState() {
    const realtimeActiveCookie = Cookies.get('realtimeActive');
    const realtimeActive =
      typeof realtimeActiveCookie === 'undefined'
        ? false
        : realtimeActiveCookie === 'true';

    return {
      groupIds: [],
      reviewedIds: [],
      forReview: false,
      selectAllActive: false,
      realtimeActive,
      pageLinks: '',
      itemsRemoved: 0,
      queryCount: 0,
      queryCounts: {},
      queryMaxCount: 0,
      error: null,
      isSidebarVisible: false,
      issuesLoading: true,
      tagsLoading: true,
      memberList: {},
    };
  }

  componentDidMount() {
    const links = parseLinkHeader(this.state.pageLinks);
    this._poller = new CursorPoller({
      endpoint: links.previous?.href || '',
      success: this.onRealtimePoll,
    });

    // Start by getting searches first so if the user is on a saved search
    // or they have a pinned search we load the correct data the first time.
    this.fetchSavedSearches();
    this.fetchTags();
    this.fetchMemberList();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevState.realtimeActive !== this.state.realtimeActive) {
      // User toggled realtime button
      if (this.state.realtimeActive) {
        this.resumePolling();
      } else {
        this._poller.disable();
      }
    }

    // If the project selection has changed reload the member list and tag keys
    // allowing autocomplete and tag sidebar to be more accurate.
    if (!isEqual(prevProps.selection.projects, this.props.selection.projects)) {
      this.fetchMemberList();
      this.fetchTags();
      // Reset display when selecting multiple projects
      const projects = this.props.selection.projects ?? [];
      const hasMultipleProjects = projects.length !== 1 || projects[0] === -1;
      if (hasMultipleProjects && this.getDisplay() !== DEFAULT_DISPLAY) {
        this.transitionTo({display: undefined});
      }
    }

    if (prevState.forReview !== this.state.forReview) {
      this.fetchData();
    }

    // Wait for saved searches to load before we attempt to fetch stream data
    if (this.props.savedSearchLoading) {
      return;
    }
    if (prevProps.savedSearchLoading) {
      this.fetchData();
      return;
    }

    const prevQuery = prevProps.location.query;
    const newQuery = this.props.location.query;

    const selectionChanged = !isEqual(prevProps.selection, this.props.selection);

    // If any important url parameter changed or saved search changed
    // reload data.
    if (
      selectionChanged ||
      prevQuery.cursor !== newQuery.cursor ||
      prevQuery.sort !== newQuery.sort ||
      prevQuery.query !== newQuery.query ||
      prevQuery.statsPeriod !== newQuery.statsPeriod ||
      prevQuery.groupStatsPeriod !== newQuery.groupStatsPeriod ||
      prevProps.savedSearch !== this.props.savedSearch
    ) {
      this.fetchData(selectionChanged);
    } else if (
      !this._lastRequest &&
      prevState.issuesLoading === false &&
      this.state.issuesLoading
    ) {
      // Reload if we issues are loading or their loading state changed.
      // This can happen when transitionTo is called
      this.fetchData();
    }
  }

  componentWillUnmount() {
    this._poller.disable();
    GroupStore.reset();
    this.props.api.clear();
    callIfFunction(this.listener);
    // Reset store when unmounting because we always fetch on mount
    // This means if you navigate away from stream and then back to stream,
    // this component will go from:
    // "ready" ->
    // "loading" (because fetching saved searches) ->
    // "ready"
    //
    // We don't render anything until saved searches is ready, so this can
    // cause weird side effects (e.g. ProcessingIssueList mounting and making
    // a request, but immediately unmounting when fetching saved searches)
    resetSavedSearches();
  }

  private _poller: any;
  private _lastRequest: any;
  private _lastStatsRequest: any;
  private _streamManager = new StreamManager(GroupStore);

  getQuery(): string {
    const {savedSearch, location} = this.props;
    if (savedSearch) {
      return savedSearch.query;
    }

    const {query} = location.query;

    if (query !== undefined) {
      return query as string;
    }

    return DEFAULT_QUERY;
  }

  getSort(): string {
    const {location, savedSearch} = this.props;
    if (!location.query.sort && savedSearch?.id) {
      return savedSearch.sort;
    }

    if (location.query.sort) {
      return location.query.sort as string;
    }

    return DEFAULT_SORT;
  }

  getDisplay(): IssueDisplayOptions {
    const {organization, location} = this.props;

    if (organization.features.includes('issue-percent-display')) {
      if (
        location.query.display &&
        Object.values(IssueDisplayOptions).includes(location.query.display)
      ) {
        return location.query.display as IssueDisplayOptions;
      }
    }

    return DEFAULT_DISPLAY;
  }

  getGroupStatsPeriod(): string {
    let currentPeriod: string;
    if (typeof this.props.location.query?.groupStatsPeriod === 'string') {
      currentPeriod = this.props.location.query.groupStatsPeriod;
    } else if (this.getSort() === IssueSortOptions.TREND) {
      // Default to the larger graph when sorting by relative change
      currentPeriod = 'auto';
    } else {
      currentPeriod = DEFAULT_GRAPH_STATS_PERIOD;
    }

    return DYNAMIC_COUNTS_STATS_PERIODS.has(currentPeriod)
      ? currentPeriod
      : DEFAULT_GRAPH_STATS_PERIOD;
  }

  getEndpointParams = (): EndpointParams => {
    const {selection} = this.props;

    const params: EndpointParams = {
      project: selection.projects,
      environment: selection.environments,
      query: this.getQuery(),
      ...selection.datetime,
    };

    if (selection.datetime.period) {
      delete params.period;
      params.statsPeriod = selection.datetime.period;
    }
    if (params.end) {
      params.end = getUtcDateString(params.end);
    }
    if (params.start) {
      params.start = getUtcDateString(params.start);
    }

    const sort = this.getSort();
    if (sort !== DEFAULT_SORT) {
      params.sort = sort;
    }

    const display = this.getDisplay();
    if (display !== DEFAULT_DISPLAY) {
      params.display = display;
    }

    const groupStatsPeriod = this.getGroupStatsPeriod();
    if (groupStatsPeriod !== DEFAULT_GRAPH_STATS_PERIOD) {
      params.groupStatsPeriod = groupStatsPeriod;
    }

    // only include defined values.
    return pickBy(params, v => defined(v)) as EndpointParams;
  };

  getGlobalSearchProjectIds = () => {
    return this.props.selection.projects;
  };

  fetchMemberList() {
    const projectIds = this.getGlobalSearchProjectIds()?.map(projectId =>
      String(projectId)
    );

    fetchOrgMembers(this.props.api, this.props.organization.slug, projectIds).then(
      members => {
        this.setState({memberList: indexMembersByProject(members)});
      }
    );
  }

  fetchTags() {
    const {organization, selection} = this.props;
    this.setState({tagsLoading: true});
    loadOrganizationTags(this.props.api, organization.slug, selection).then(() =>
      this.setState({tagsLoading: false})
    );
  }

  fetchStats = (groups: string[]) => {
    // If we have no groups to fetch, just skip stats
    if (!groups.length) {
      return;
    }
    const requestParams: StatEndpointParams = {
      ...this.getEndpointParams(),
      groups,
    };
    // If no stats period values are set, use default
    if (!requestParams.statsPeriod && !requestParams.start) {
      requestParams.statsPeriod = DEFAULT_STATS_PERIOD;
    }
    if (this.props.organization.features.includes('issue-percent-display')) {
      requestParams.expand = 'sessions';
    }

    this._lastStatsRequest = this.props.api.request(this.getGroupStatsEndpoint(), {
      method: 'GET',
      data: qs.stringify(requestParams),
      success: data => {
        if (!data) {
          return;
        }
        GroupActions.populateStats(groups, data);
      },
      error: err => {
        this.setState({
          error: parseApiError(err),
        });
      },
      complete: () => {
        this._lastStatsRequest = null;

        // End navigation transaction to prevent additional page requests from impacting page metrics.
        // Other transactions include stacktrace preview request
        const currentTransaction = Sentry.getCurrentHub().getScope()?.getTransaction();
        if (currentTransaction?.op === 'navigation') {
          currentTransaction.finish();
        }
      },
    });
  };

  fetchCounts = async (currentQueryCount: number, fetchAllCounts: boolean) => {
    const {organization} = this.props;
    const {queryCounts: _queryCounts} = this.state;
    let queryCounts: QueryCounts = {..._queryCounts};

    const endpointParams = this.getEndpointParams();
    const tabQueriesWithCounts = getTabsWithCounts(organization);
    const currentTabQuery = tabQueriesWithCounts.includes(endpointParams.query as Query)
      ? endpointParams.query
      : null;

    // If all tabs' counts are fetched, skip and only set
    if (
      fetchAllCounts ||
      !tabQueriesWithCounts.every(tabQuery => queryCounts[tabQuery] !== undefined)
    ) {
      const requestParams: CountsEndpointParams = {
        ...omit(endpointParams, 'query'),
        // fetch the counts for the tabs whose counts haven't been fetched yet
        query: tabQueriesWithCounts.filter(_query => _query !== currentTabQuery),
      };

      // If no stats period values are set, use default
      if (!requestParams.statsPeriod && !requestParams.start) {
        requestParams.statsPeriod = DEFAULT_STATS_PERIOD;
      }

      try {
        const response = await this.props.api.requestPromise(
          this.getGroupCountsEndpoint(),
          {
            method: 'GET',
            data: qs.stringify(requestParams),
          }
        );

        // Counts coming from the counts endpoint is limited to 100, for >= 100 we display 99+
        queryCounts = {
          ...queryCounts,
          ...mapValues(response, (count: number) => ({
            count,
            hasMore: count > TAB_MAX_COUNT,
          })),
        };
      } catch (e) {
        this.setState({
          error: parseApiError(e),
        });
        return;
      }
    }

    // Update the count based on the exact number of issues, these shown as is
    if (currentTabQuery) {
      queryCounts[currentTabQuery] = {
        count: currentQueryCount,
        hasMore: false,
      };

      const tab = getTabs(organization).find(
        ([tabQuery]) => currentTabQuery === tabQuery
      )?.[1];
      if (tab && !endpointParams.cursor) {
        trackAdvancedAnalyticsEvent('issues_tab.viewed', {
          organization,
          tab: tab.analyticsName,
          num_issues: queryCounts[currentTabQuery].count,
        });
      }
    }

    this.setState({queryCounts});
  };

  fetchData = (fetchAllCounts = false) => {
    const query = this.getQuery();

    if (!this.state.reviewedIds.length || !isForReviewQuery(query)) {
      GroupStore.loadInitialData([]);
      this._streamManager.reset();

      this.setState({
        issuesLoading: true,
        queryCount: 0,
        itemsRemoved: 0,
        reviewedIds: [],
        error: null,
      });
    }

    const transaction = getCurrentSentryReactTransaction();
    transaction?.setTag('query.sort', this.getSort());

    this.setState({
      queryCount: 0,
      itemsRemoved: 0,
      error: null,
    });

    const requestParams: any = {
      ...this.getEndpointParams(),
      limit: MAX_ITEMS,
      shortIdLookup: 1,
    };

    const currentQuery = this.props.location.query || {};
    if ('cursor' in currentQuery) {
      requestParams.cursor = currentQuery.cursor;
    }

    // If no stats period values are set, use default
    if (!requestParams.statsPeriod && !requestParams.start) {
      requestParams.statsPeriod = DEFAULT_STATS_PERIOD;
    }

    requestParams.expand = ['owners', 'inbox'];
    requestParams.collapse = 'stats';

    if (this._lastRequest) {
      this._lastRequest.cancel();
    }
    if (this._lastStatsRequest) {
      this._lastStatsRequest.cancel();
    }

    this._poller.disable();

    this._lastRequest = this.props.api.request(this.getGroupListEndpoint(), {
      method: 'GET',
      data: qs.stringify(requestParams),
      success: (data, _, resp) => {
        if (!resp) {
          return;
        }

        const {orgId} = this.props.params;
        // If this is a direct hit, we redirect to the intended result directly.
        if (resp.getResponseHeader('X-Sentry-Direct-Hit') === '1') {
          let redirect: string;
          if (data[0] && data[0].matchingEventId) {
            const {id, matchingEventId} = data[0];
            redirect = `/organizations/${orgId}/issues/${id}/events/${matchingEventId}/`;
          } else {
            const {id} = data[0];
            redirect = `/organizations/${orgId}/issues/${id}/`;
          }

          browserHistory.replace({
            pathname: redirect,
            query: extractSelectionParameters(this.props.location.query),
          });
          return;
        }

        this._streamManager.push(data);

        if (isForReviewQuery(query)) {
          GroupStore.remove(this.state.reviewedIds);
        }

        this.fetchStats(data.map((group: BaseGroup) => group.id));

        const hits = resp.getResponseHeader('X-Hits');
        const queryCount =
          typeof hits !== 'undefined' && hits ? parseInt(hits, 10) || 0 : 0;
        const maxHits = resp.getResponseHeader('X-Max-Hits');
        const queryMaxCount =
          typeof maxHits !== 'undefined' && maxHits ? parseInt(maxHits, 10) || 0 : 0;
        const pageLinks = resp.getResponseHeader('Link');

        if (!this.state.forReview) {
          this.fetchCounts(queryCount, fetchAllCounts);
        }

        this.setState({
          error: null,
          issuesLoading: false,
          queryCount,
          queryMaxCount,
          pageLinks: pageLinks !== null ? pageLinks : '',
        });
      },
      error: err => {
        trackAdvancedAnalyticsEvent('issue_search.failed', {
          organization: this.props.organization,
          search_type: 'issues',
          search_source: 'main_search',
          error: parseApiError(err),
        });

        this.setState({
          error: parseApiError(err),
          issuesLoading: false,
        });
      },
      complete: () => {
        this._lastRequest = null;

        this.resumePolling();

        this.setState({forReview: false});
      },
    });
  };

  resumePolling = () => {
    if (!this.state.pageLinks) {
      return;
    }

    // Only resume polling if we're on the first page of results
    const links = parseLinkHeader(this.state.pageLinks);
    if (links && !links.previous.results && this.state.realtimeActive) {
      // Remove collapse stats from endpoint before supplying to poller
      const issueEndpoint = new URL(links.previous.href, window.location.origin);
      issueEndpoint.searchParams.delete('collapse');
      this._poller.setEndpoint(decodeURIComponent(issueEndpoint.href));
      this._poller.enable();
    }
  };

  getGroupListEndpoint(): string {
    const {orgId} = this.props.params;

    return `/organizations/${orgId}/issues/`;
  }

  getGroupCountsEndpoint(): string {
    const {orgId} = this.props.params;

    return `/organizations/${orgId}/issues-count/`;
  }

  getGroupStatsEndpoint(): string {
    const {orgId} = this.props.params;

    return `/organizations/${orgId}/issues-stats/`;
  }

  onRealtimeChange = (realtime: boolean) => {
    Cookies.set('realtimeActive', realtime.toString());
    this.setState({realtimeActive: realtime});
  };

  onSelectStatsPeriod = (period: string) => {
    const {location} = this.props;
    if (period !== this.getGroupStatsPeriod()) {
      const cursor = location.query.cursor;
      const queryPageInt = parseInt(location.query.page, 10);
      const page = isNaN(queryPageInt) || !location.query.cursor ? 0 : queryPageInt;
      this.transitionTo({cursor, page, groupStatsPeriod: period});
    }
  };

  onRealtimePoll = (data: any, _links: any) => {
    // Note: We do not update state with cursors from polling,
    // `CursorPoller` updates itself with new cursors
    this._streamManager.unshift(data);
  };

  listener = GroupStore.listen(() => this.onGroupChange(), undefined);

  onGroupChange() {
    const groupIds = this._streamManager.getAllItems().map(item => item.id) ?? [];
    if (!isEqual(groupIds, this.state.groupIds)) {
      this.setState({groupIds});
    }
  }

  onIssueListSidebarSearch = (query: string) => {
    trackAdvancedAnalyticsEvent('search.searched', {
      organization: this.props.organization,
      query,
      search_type: 'issues',
      search_source: 'search_builder',
    });

    this.onSearch(query);
  };

  onSearch = (query: string) => {
    if (query === this.state.query) {
      // if query is the same, just re-fetch data
      this.fetchData();
    } else {
      // Clear the saved search as the user wants something else.
      this.transitionTo({query}, null);
    }
  };

  onSortChange = (sort: string) => {
    this.transitionTo({sort});
  };

  onDisplayChange = (display: string) => {
    this.transitionTo({display});
  };

  onCursorChange: CursorHandler = (nextCursor, _path, _query, delta) => {
    const queryPageInt = parseInt(this.props.location.query.page, 10);
    let nextPage: number | undefined = isNaN(queryPageInt) ? delta : queryPageInt + delta;

    let cursor: undefined | string = nextCursor;

    // unset cursor and page when we navigate back to the first page
    // also reset cursor if somehow the previous button is enabled on
    // first page and user attempts to go backwards
    if (nextPage <= 0) {
      cursor = undefined;
      nextPage = undefined;
    }

    this.transitionTo({cursor, page: nextPage});
  };

  onSidebarToggle = () => {
    const {organization} = this.props;
    this.setState({
      isSidebarVisible: !this.state.isSidebarVisible,
    });
    trackAdvancedAnalyticsEvent('issue.search_sidebar_clicked', {
      organization,
    });
  };

  /**
   * Returns true if all results in the current query are visible/on this page
   */
  allResultsVisible(): boolean {
    if (!this.state.pageLinks) {
      return false;
    }

    const links = parseLinkHeader(this.state.pageLinks);
    return links && !links.previous.results && !links.next.results;
  }

  transitionTo = (
    newParams: Partial<EndpointParams> = {},
    savedSearch: (SavedSearch & {projectId?: number}) | null = this.props.savedSearch
  ) => {
    const query = {
      ...this.getEndpointParams(),
      ...newParams,
    };
    const {organization} = this.props;
    let path: string;

    if (savedSearch && savedSearch.id) {
      path = `/organizations/${organization.slug}/issues/searches/${savedSearch.id}/`;

      // Remove the query as saved searches bring their own query string.
      delete query.query;

      // If we aren't going to another page in the same search
      // drop the query and replace the current project, with the saved search search project
      // if available.
      if (!query.cursor && savedSearch.projectId) {
        query.project = [savedSearch.projectId];
      }
      if (!query.cursor && !newParams.sort && savedSearch.sort) {
        query.sort = savedSearch.sort;
      }
    } else {
      path = `/organizations/${organization.slug}/issues/`;
    }

    // Remove inbox tab specific sort
    if (query.sort === IssueSortOptions.INBOX && query.query !== Query.FOR_REVIEW) {
      delete query.sort;
    }

    if (
      path !== this.props.location.pathname ||
      !isEqual(query, this.props.location.query)
    ) {
      browserHistory.push({
        pathname: path,
        query,
      });
      this.setState({issuesLoading: true});
    }
  };

  displayReprocessingTab() {
    const {organization} = this.props;
    const {queryCounts} = this.state;

    return (
      organization.features.includes('reprocessing-v2') &&
      !!queryCounts?.[Query.REPROCESSING]?.count
    );
  }

  displayReprocessingLayout(showReprocessingTab: boolean, query: string) {
    return showReprocessingTab && query === Query.REPROCESSING;
  }

  renderGroupNodes = (ids: string[], groupStatsPeriod: string) => {
    const topIssue = ids[0];
    const {memberList} = this.state;
    const query = this.getQuery();
    const showInboxTime = this.getSort() === IssueSortOptions.INBOX;

    return ids.map((id, index) => {
      const hasGuideAnchor = id === topIssue;
      const group = GroupStore.get(id) as Group | undefined;
      let members: Member['user'][] | undefined;
      if (group?.project) {
        members = memberList[group.project.slug];
      }

      const showReprocessingTab = this.displayReprocessingTab();
      const displayReprocessingLayout = this.displayReprocessingLayout(
        showReprocessingTab,
        query
      );

      return (
        <StreamGroup
          index={index}
          key={id}
          id={id}
          statsPeriod={groupStatsPeriod}
          query={query}
          hasGuideAnchor={hasGuideAnchor}
          memberList={members}
          displayReprocessingLayout={displayReprocessingLayout}
          useFilteredStats
          showInboxTime={showInboxTime}
          display={this.getDisplay()}
        />
      );
    });
  };

  renderLoading(): React.ReactNode {
    return (
      <PageContent>
        <LoadingIndicator />
      </PageContent>
    );
  }

  renderStreamBody(): React.ReactNode {
    const {issuesLoading, error, groupIds} = this.state;

    if (issuesLoading) {
      return <LoadingIndicator hideMessage />;
    }

    if (error) {
      return <LoadingError message={error} onRetry={this.fetchData} />;
    }

    if (groupIds.length > 0) {
      return (
        <PanelBody>
          {this.renderGroupNodes(groupIds, this.getGroupStatsPeriod())}
        </PanelBody>
      );
    }

    const {api, organization, selection} = this.props;

    return (
      <NoGroupsHandler
        api={api}
        organization={organization}
        query={this.getQuery()}
        selectedProjectIds={selection.projects}
        groupIds={groupIds}
      />
    );
  }

  fetchSavedSearches = () => {
    const {organization, api} = this.props;

    fetchSavedSearches(api, organization.slug);
  };

  onSavedSearchSelect = (savedSearch: SavedSearch) => {
    trackAdvancedAnalyticsEvent('organization_saved_search.selected', {
      organization: this.props.organization,
      search_type: 'issues',
      id: savedSearch.id ? parseInt(savedSearch.id, 10) : -1,
    });
    this.setState({issuesLoading: true}, () => this.transitionTo(undefined, savedSearch));
  };

  onSavedSearchDelete = (search: SavedSearch) => {
    const {orgId} = this.props.params;

    deleteSavedSearch(this.props.api, orgId, search).then(() => {
      this.setState(
        {
          issuesLoading: true,
        },
        () => this.transitionTo({}, null)
      );
    });
  };

  onDelete = () => {
    this.fetchData(true);
  };

  onMarkReviewed = (itemIds: string[]) => {
    const query = this.getQuery();

    if (!isForReviewQuery(query)) {
      return;
    }

    const {queryCounts, itemsRemoved} = this.state;
    const currentQueryCount = queryCounts[query as Query];
    if (itemIds.length && currentQueryCount) {
      const inInboxCount = itemIds.filter(id => GroupStore.get(id)?.inbox).length;
      currentQueryCount.count -= inInboxCount;
      this.setState({
        queryCounts: {
          ...queryCounts,
          [query as Query]: currentQueryCount,
        },
        itemsRemoved: itemsRemoved + inInboxCount,
        reviewedIds: itemIds,
        forReview: true,
      });
    }
  };

  tagValueLoader = (key: string, search: string) => {
    const {orgId} = this.props.params;
    const projectIds = this.getGlobalSearchProjectIds().map(id => id.toString());
    const endpointParams = this.getEndpointParams();

    return fetchTagValues(
      this.props.api,
      orgId,
      key,
      search,
      projectIds,
      endpointParams as any
    );
  };

  render() {
    if (this.props.savedSearchLoading) {
      return this.renderLoading();
    }

    const {
      isSidebarVisible,
      tagsLoading,
      pageLinks,
      queryCount,
      queryCounts,
      realtimeActive,
      groupIds,
      queryMaxCount,
      itemsRemoved,
    } = this.state;
    const {organization, savedSearch, savedSearches, tags, selection, location, router} =
      this.props;
    const links = parseLinkHeader(pageLinks);
    const query = this.getQuery();
    const queryPageInt = parseInt(location.query.page, 10);
    // Cursor must be present for the page number to be used
    const page = isNaN(queryPageInt) || !location.query.cursor ? 0 : queryPageInt;
    const pageBasedCount = page * MAX_ITEMS + groupIds.length;

    let pageCount = pageBasedCount > queryCount ? queryCount : pageBasedCount;
    if (!links?.next?.results || this.allResultsVisible()) {
      // On last available page
      pageCount = queryCount;
    } else if (!links?.previous?.results) {
      // On first available page
      pageCount = groupIds.length;
    }

    // Subtract # items that have been marked reviewed
    pageCount = Math.max(pageCount - itemsRemoved, 0);
    const modifiedQueryCount = Math.max(queryCount - itemsRemoved, 0);
    const displayCount = tct('[count] of [total]', {
      count: pageCount,
      total: (
        <StyledQueryCount
          hideParens
          hideIfEmpty={false}
          count={modifiedQueryCount}
          max={queryMaxCount || 100}
        />
      ),
    });

    const projectIds = selection?.projects?.map(p => p.toString());

    const showReprocessingTab = this.displayReprocessingTab();
    const displayReprocessingActions = this.displayReprocessingLayout(
      showReprocessingTab,
      query
    );

    const layoutProps = {
      fullWidth: !isSidebarVisible,
    };

    return (
      <React.Fragment>
        <StyledPageContent>
          <IssueListHeader
            organization={organization}
            query={query}
            sort={this.getSort()}
            queryCount={queryCount}
            queryCounts={queryCounts}
            realtimeActive={realtimeActive}
            onRealtimeChange={this.onRealtimeChange}
            router={router}
            savedSearchList={savedSearches}
            onSavedSearchSelect={this.onSavedSearchSelect}
            onSavedSearchDelete={this.onSavedSearchDelete}
            displayReprocessingTab={showReprocessingTab}
            selectedProjectIds={selection.projects}
          />
          <Layout.Body {...layoutProps}>
            <Layout.Main {...layoutProps}>
              <IssueListFilters
                organization={organization}
                query={query}
                savedSearch={savedSearch}
                sort={this.getSort()}
                display={this.getDisplay()}
                onDisplayChange={this.onDisplayChange}
                onSortChange={this.onSortChange}
                onSearch={this.onSearch}
                onSidebarToggle={this.onSidebarToggle}
                isSearchDisabled={isSidebarVisible}
                tagValueLoader={this.tagValueLoader}
                tags={tags}
                selectedProjects={selection.projects}
              />

              <Panel>
                <IssueListActions
                  organization={organization}
                  selection={selection}
                  query={query}
                  queryCount={modifiedQueryCount}
                  displayCount={displayCount}
                  onSelectStatsPeriod={this.onSelectStatsPeriod}
                  onMarkReviewed={this.onMarkReviewed}
                  onDelete={this.onDelete}
                  statsPeriod={this.getGroupStatsPeriod()}
                  groupIds={groupIds}
                  allResultsVisible={this.allResultsVisible()}
                  displayReprocessingActions={displayReprocessingActions}
                />
                <PanelBody>
                  <ProcessingIssueList
                    organization={organization}
                    projectIds={projectIds}
                    showProject
                  />
                  <VisuallyCompleteWithData
                    hasData={this.state.groupIds.length > 0}
                    id="IssueList-Body"
                  >
                    {this.renderStreamBody()}
                  </VisuallyCompleteWithData>
                </PanelBody>
              </Panel>
              <StyledPagination
                caption={tct('Showing [displayCount] issues', {
                  displayCount,
                })}
                pageLinks={pageLinks}
                onCursor={this.onCursorChange}
              />
            </Layout.Main>

            {/* Avoid rendering sidebar until first accessed */}
            {isSidebarVisible && (
              <Layout.Side>
                <IssueListSidebar
                  loading={tagsLoading}
                  tags={tags}
                  query={query}
                  onQueryChange={this.onIssueListSidebarSearch}
                  tagValueLoader={this.tagValueLoader}
                />
              </Layout.Side>
            )}
          </Layout.Body>
        </StyledPageContent>

        {query === Query.FOR_REVIEW && <GuideAnchor target="is_inbox_tab" />}
      </React.Fragment>
    );
  }
}

export default withApi(
  withPageFilters(
    withSavedSearches(withOrganization(withIssueTags(withProfiler(IssueListOverview))))
  )
);

export {IssueListOverview};

const StyledPagination = styled(Pagination)`
  margin-top: 0;
`;

const StyledQueryCount = styled(QueryCount)`
  margin-left: 0;
`;

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;
