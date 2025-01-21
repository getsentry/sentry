import {Component} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import type {Location} from 'history';
import Cookies from 'js-cookie';
import isEqual from 'lodash/isEqual';
import mapValues from 'lodash/mapValues';
import omit from 'lodash/omit';
import pickBy from 'lodash/pickBy';
import moment from 'moment-timezone';
import * as qs from 'query-string';

import {addMessage} from 'sentry/actionCreators/indicator';
import {fetchOrgMembers, indexMembersByProject} from 'sentry/actionCreators/members';
import type {Client} from 'sentry/api';
import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {extractSelectionParameters} from 'sentry/components/organizations/pageFilters/utils';
import type {CursorHandler} from 'sentry/components/pagination';
import QueryCount from 'sentry/components/queryCount';
import {DEFAULT_QUERY, DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import IssueListCacheStore from 'sentry/stores/IssueListCacheStore';
import SelectedGroupStore from 'sentry/stores/selectedGroupStore';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {BaseGroup, Group, PriorityLevel, SavedSearch} from 'sentry/types/group';
import {GroupStatus, IssueCategory} from 'sentry/types/group';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import CursorPoller from 'sentry/utils/cursorPoller';
import {getUtcDateString} from 'sentry/utils/dates';
import getCurrentSentryReactRootSpan from 'sentry/utils/getCurrentSentryReactRootSpan';
import parseApiError from 'sentry/utils/parseApiError';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {makeIssuesINPObserver} from 'sentry/utils/performanceForSentry';
import {decodeScalar} from 'sentry/utils/queryString';
import type {WithRouteAnalyticsProps} from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import withRouteAnalytics from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import withSavedSearches from 'sentry/utils/withSavedSearches';
import IssueListTable from 'sentry/views/issueList/issueListTable';
import {IssuesDataConsentBanner} from 'sentry/views/issueList/issuesDataConsentBanner';
import IssueViewsIssueListHeader from 'sentry/views/issueList/issueViewsHeader';
import SavedIssueSearches from 'sentry/views/issueList/savedIssueSearches';
import type {IssueUpdateData} from 'sentry/views/issueList/types';
import {NewTabContextProvider} from 'sentry/views/issueList/utils/newTabContext';
import {parseIssuePrioritySearch} from 'sentry/views/issueList/utils/parseIssuePrioritySearch';

import IssueListFilters from './filters';
import IssueListHeader from './header';
import type {QueryCounts} from './utils';
import {
  DEFAULT_ISSUE_STREAM_SORT,
  FOR_REVIEW_QUERIES,
  getTabs,
  getTabsWithCounts,
  isForReviewQuery,
  IssueSortOptions,
  Query,
  TAB_MAX_COUNT,
} from './utils';

const MAX_ITEMS = 25;
// the default period for the graph in each issue row
const DEFAULT_GRAPH_STATS_PERIOD = '24h';
// the allowed period choices for graph in each issue row
const DYNAMIC_COUNTS_STATS_PERIODS = new Set(['14d', '24h', 'auto']);
const MAX_ISSUES_COUNT = 100;

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
  selectedSearchId: string;
  selection: PageFilters;
} & RouteComponentProps<{}, {searchId?: string}> &
  WithRouteAnalyticsProps;

type State = {
  error: string | null;
  groupIds: string[];
  issuesLoading: boolean;
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
  selectAllActive: boolean;
  // Will be set to true if there is valid session data from issue-stats api call
  query?: string;
};

interface EndpointParams extends Partial<PageFilters['datetime']> {
  environment: string[];
  project: number[];
  cursor?: string;
  groupStatsPeriod?: string | null;
  page?: number | string;
  query?: string;
  sort?: string;
  statsPeriod?: string | null;
  useGroupSnubaDataset?: boolean;
}

type CountsEndpointParams = Omit<EndpointParams, 'cursor' | 'page' | 'query'> & {
  query: string[];
};

type StatEndpointParams = Omit<EndpointParams, 'cursor' | 'page'> & {
  groups: string[];
  expand?: string | string[];
};

class IssueListOverview extends Component<Props, State> {
  state: State = this.getInitialState();

  getInitialState() {
    const realtimeActiveCookie = Cookies.get('realtimeActive');
    const realtimeActive =
      typeof realtimeActiveCookie === 'undefined'
        ? false
        : realtimeActiveCookie === 'true';

    return {
      groupIds: [],
      actionTaken: false,
      selectAllActive: false,
      realtimeActive,
      pageLinks: '',
      queryCount: 0,
      queryCounts: {},
      queryMaxCount: 0,
      error: null,
      issuesLoading: true,
      memberList: {},
    };
  }

  componentDidMount() {
    this._performanceObserver = makeIssuesINPObserver();
    this._poller = new CursorPoller({
      linkPreviousHref: parseLinkHeader(this.state.pageLinks)?.previous?.href,
      success: this.onRealtimePoll,
    });

    // Wait for saved searches to load so if the user is on a saved search
    // or they have a pinned search we load the correct data the first time.
    // But if searches are already there, we can go right to fetching issues
    if (
      !this.props.savedSearchLoading ||
      this.props.organization.features.includes('issue-stream-performance')
    ) {
      const loadedFromCache = this.loadFromCache();
      if (!loadedFromCache) {
        // It's possible the projects query parameter is not yet ready and this
        // request will be repeated in componentDidUpdate
        this.fetchData();
      }
    }
    this.fetchMemberList();
    this.props.setRouteAnalyticsParams?.({
      issue_views_enabled: this.props.organization.features.includes(
        'issue-stream-custom-views'
      ),
    });
    // let custom analytics take control
    this.props.setDisableRouteAnalytics?.();
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
      this.loadFromCache();
      this.fetchMemberList();
    }

    const selectionChanged = !isEqual(prevProps.selection, this.props.selection);

    // Wait for saved searches to load before we attempt to fetch stream data
    // Selection changing could indicate that the projects query parameter has populated
    // and we should refetch data.
    if (this.props.savedSearchLoading && !selectionChanged) {
      return;
    }

    if (
      prevProps.savedSearchLoading &&
      !this.props.savedSearchLoading &&
      this.props.organization.features.includes('issue-stream-performance')
    ) {
      return;
    }

    if (
      prevProps.savedSearchLoading &&
      !this.props.organization.features.includes('issue-stream-performance')
    ) {
      const loadedFromCache = this.loadFromCache();
      if (!loadedFromCache) {
        this.fetchData();
      }
      return;
    }

    const prevUrlQuery = prevProps.location.query;
    const newUrlQuery = this.props.location.query;

    const prevQuery = this.getQueryFromSavedSearchOrLocation({
      savedSearch: prevProps.savedSearch,
      location: prevProps.location,
    });
    const newQuery = this.getQuery();

    const prevSort = this.getSortFromSavedSearchOrLocation({
      savedSearch: prevProps.savedSearch,
      location: prevProps.location,
    });
    const newSort = this.getSort();

    // If any important url parameter changed or saved search changed
    // reload data.
    if (
      selectionChanged ||
      prevUrlQuery.cursor !== newUrlQuery.cursor ||
      prevUrlQuery.statsPeriod !== newUrlQuery.statsPeriod ||
      prevUrlQuery.groupStatsPeriod !== newUrlQuery.groupStatsPeriod ||
      prevQuery !== newQuery ||
      prevSort !== newSort
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
    const groups = GroupStore.getState() as Group[];
    if (groups.length > 0 && !this.state.issuesLoading && !this.state.realtimeActive) {
      IssueListCacheStore.save(this.getCacheEndpointParams(), {
        groups,
        queryCount: this.state.queryCount,
        queryMaxCount: this.state.queryMaxCount,
        pageLinks: this.state.pageLinks,
      });
    }

    if (this._performanceObserver) {
      this._performanceObserver.disconnect();
    }
    this._poller.disable();
    SelectedGroupStore.reset();
    GroupStore.reset();
    this.props.api.clear();
    this.listener?.();
  }

  private _performanceObserver: PerformanceObserver | undefined;
  private _poller: any;
  private _lastRequest: any;
  private _lastStatsRequest: any;
  private _lastFetchCountsRequest: any;
  private actionTaken = false;
  private undo = false;

  getQueryFromSavedSearchOrLocation({
    savedSearch,
    location,
  }: Pick<Props, 'savedSearch' | 'location'>): string {
    if (
      !this.props.organization.features.includes('issue-stream-custom-views') &&
      savedSearch
    ) {
      return savedSearch.query;
    }

    const {query} = location.query;

    if (query !== undefined) {
      return decodeScalar(query, '');
    }

    return DEFAULT_QUERY;
  }

  getSortFromSavedSearchOrLocation({
    savedSearch,
    location,
  }: Pick<Props, 'savedSearch' | 'location'>): string {
    if (!location.query.sort && savedSearch?.id) {
      return savedSearch.sort;
    }

    if (location.query.sort) {
      return location.query.sort as string;
    }
    return DEFAULT_ISSUE_STREAM_SORT;
  }

  /**
   * Load the previous
   * @returns Returns true if the data was loaded from cache
   */
  loadFromCache(): boolean {
    const cache = IssueListCacheStore.getFromCache(this.getCacheEndpointParams());
    if (!cache) {
      return false;
    }

    this.setState(
      {
        issuesLoading: false,
        queryCount: cache.queryCount,
        queryMaxCount: cache.queryMaxCount,
        pageLinks: cache.pageLinks,
      },
      () => {
        // Handle this in the next tick to avoid being overwritten by GroupStore.reset
        // Group details clears the GroupStore at the same time this component mounts
        GroupStore.add(cache.groups);
        // Clear cache after loading
        IssueListCacheStore.reset();
      }
    );

    return true;
  }

  getQuery(): string {
    return this.getQueryFromSavedSearchOrLocation({
      savedSearch: this.props.savedSearch,
      location: this.props.location,
    });
  }

  getSort(): string {
    return this.getSortFromSavedSearchOrLocation({
      savedSearch: this.props.savedSearch,
      location: this.props.location,
    });
  }

  getGroupStatsPeriod(): string {
    let currentPeriod: string;
    if (typeof this.props.location.query?.groupStatsPeriod === 'string') {
      currentPeriod = this.props.location.query.groupStatsPeriod;
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
    if (sort !== DEFAULT_ISSUE_STREAM_SORT) {
      params.sort = sort;
    }

    const groupStatsPeriod = this.getGroupStatsPeriod();
    if (groupStatsPeriod !== DEFAULT_GRAPH_STATS_PERIOD) {
      params.groupStatsPeriod = groupStatsPeriod;
    }

    if (this.props.location.query.useGroupSnubaDataset) {
      params.useGroupSnubaDataset = true;
    }

    // only include defined values.
    return pickBy(params, v => defined(v)) as EndpointParams;
  };

  getCacheEndpointParams = (): EndpointParams => {
    const cursor = this.props.location.query.cursor;
    return {
      ...this.getEndpointParams(),
      cursor,
    };
  };

  getSelectedProjectIds = (): string[] => {
    return this.props.selection.projects.map(projectId => String(projectId));
  };

  fetchMemberList() {
    const projectIds = this.getSelectedProjectIds();

    fetchOrgMembers(this.props.api, this.props.organization.slug, projectIds).then(
      members => {
        this.setState({memberList: indexMembersByProject(members)});
      }
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

    this._lastStatsRequest = this.props.api.request(this.groupStatsEndpoint, {
      method: 'GET',
      data: qs.stringify(requestParams),
      success: data => {
        if (!data) {
          return;
        }
        GroupStore.onPopulateStats(groups, data);
        this.trackTabViewed(groups, data, this.state.queryCount);
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
        const currentSpan = Sentry.getActiveSpan();
        const rootSpan = currentSpan ? Sentry.getRootSpan(currentSpan) : undefined;
        if (rootSpan && Sentry.spanToJSON(rootSpan).op === 'navigation') {
          rootSpan.end();
        }
      },
    });
  };

  fetchCounts = (currentQueryCount: number, fetchAllCounts: boolean) => {
    const {queryCounts: _queryCounts} = this.state;
    let queryCounts: QueryCounts = {..._queryCounts};

    const endpointParams = this.getEndpointParams();
    const tabQueriesWithCounts = getTabsWithCounts();
    const currentTabQuery = tabQueriesWithCounts.includes(endpointParams.query as Query)
      ? endpointParams.query
      : null;

    // Update the count based on the exact number of issues, these shown as is
    if (currentTabQuery) {
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      queryCounts[currentTabQuery] = {
        count: currentQueryCount,
        hasMore: false,
      };
    }

    this.setState({queryCounts});

    // If all tabs' counts are fetched, skip and only set
    if (
      fetchAllCounts ||
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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

      this._lastFetchCountsRequest = this.props.api.request(this.groupCountsEndpoint, {
        method: 'GET',
        data: qs.stringify(requestParams),

        success: data => {
          if (!data) {
            return;
          }
          // Counts coming from the counts endpoint is limited to 100, for >= 100 we display 99+
          queryCounts = {
            ...queryCounts,
            ...mapValues(data, (count: number) => ({
              count,
              hasMore: count > TAB_MAX_COUNT,
            })),
          };
        },
        error: () => {
          this.setState({queryCounts: {}});
        },
        complete: () => {
          this._lastFetchCountsRequest = null;

          this.setState({queryCounts});
        },
      });
    }
  };

  fetchData = (fetchAllCounts = false) => {
    const {organization} = this.props;
    const query = this.getQuery();

    if (this.state.realtimeActive || (!this.actionTaken && !this.undo)) {
      GroupStore.loadInitialData([]);

      this.setState({
        issuesLoading: true,
        queryCount: 0,
        error: null,
      });
    }

    const span = getCurrentSentryReactRootSpan();
    span?.setAttribute('query.sort', this.getSort());

    this.setState({
      error: null,
    });

    // Used for Issue Stream Performance project, enabled means we are doing saved search look up in the backend
    const savedSearchLookupEnabled = 0;
    const savedSearchLookupDisabled = 1;

    const requestParams: any = {
      ...this.getEndpointParams(),
      limit: MAX_ITEMS,
      shortIdLookup: 1,
      savedSearch: this.props.organization.features.includes('issue-stream-performance')
        ? this.props.savedSearchLoading
          ? savedSearchLookupEnabled
          : savedSearchLookupDisabled
        : savedSearchLookupDisabled,
    };

    if (
      this.props.organization.features.includes('issue-stream-performance') &&
      this.props.selectedSearchId
    ) {
      requestParams.searchId = this.props.selectedSearchId;
    }

    if (
      this.props.organization.features.includes('issue-stream-performance') &&
      this.props.savedSearchLoading &&
      !defined(this.props.location.query.query)
    ) {
      delete requestParams.query;
    }

    const currentQuery = this.props.location.query || {};
    if ('cursor' in currentQuery) {
      requestParams.cursor = currentQuery.cursor;
    }

    // If no stats period values are set, use default
    if (!requestParams.statsPeriod && !requestParams.start) {
      requestParams.statsPeriod = DEFAULT_STATS_PERIOD;
    }

    requestParams.expand = ['owners', 'inbox'];
    requestParams.collapse = ['stats', 'unhandled'];

    if (this._lastRequest) {
      this._lastRequest.cancel();
    }
    if (this._lastStatsRequest) {
      this._lastStatsRequest.cancel();
    }
    if (this._lastFetchCountsRequest) {
      this._lastFetchCountsRequest.cancel();
    }

    this._poller.disable();

    this._lastRequest = this.props.api.request(this.groupListEndpoint, {
      method: 'GET',
      data: qs.stringify(requestParams),
      success: (data, _, resp) => {
        if (!resp) {
          return;
        }

        // If this is a direct hit, we redirect to the intended result directly.
        if (resp.getResponseHeader('X-Sentry-Direct-Hit') === '1') {
          let redirect: string;
          if (data[0]?.matchingEventId) {
            const {id, matchingEventId} = data[0];
            redirect = `/organizations/${organization.slug}/issues/${id}/events/${matchingEventId}/`;
          } else {
            const {id} = data[0];
            redirect = `/organizations/${organization.slug}/issues/${id}/`;
          }

          browserHistory.replace(
            normalizeUrl({
              pathname: redirect,
              query: {
                referrer: 'issue-list',
                ...extractSelectionParameters(this.props.location.query),
              },
            })
          );
          return;
        }

        if (this.undo) {
          GroupStore.loadInitialData(data);
        }
        GroupStore.add(data);

        this.fetchStats(data.map((group: BaseGroup) => group.id));

        const hits = resp.getResponseHeader('X-Hits');
        const queryCount =
          typeof hits !== 'undefined' && hits ? parseInt(hits, 10) || 0 : 0;
        const maxHits = resp.getResponseHeader('X-Max-Hits');
        const queryMaxCount =
          typeof maxHits !== 'undefined' && maxHits ? parseInt(maxHits, 10) || 0 : 0;
        const pageLinks = resp.getResponseHeader('Link');

        this.fetchCounts(queryCount, fetchAllCounts);

        this.setState({
          error: null,
          issuesLoading: false,
          queryCount,
          queryMaxCount,
          pageLinks: pageLinks !== null ? pageLinks : '',
        });

        if (data.length === 0) {
          trackAnalytics('issue_search.empty', {
            organization: this.props.organization,
            search_type: 'issues',
            search_source: 'main_search',
            query,
          });
        }
      },
      error: err => {
        trackAnalytics('issue_search.failed', {
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

        if (!this.state.realtimeActive) {
          this.actionTaken = false;
          this.undo = false;
        }
      },
    });
  };

  resumePolling = () => {
    if (!this.state.pageLinks) {
      return;
    }

    // Only resume polling if we're on the first page of results
    const links = parseLinkHeader(this.state.pageLinks);
    if (links && !links.previous!.results && this.state.realtimeActive) {
      this._poller.setEndpoint(links?.previous?.href);
      this._poller.enable();
    }
  };

  get groupListEndpoint(): string {
    const {organization} = this.props;
    return `/organizations/${organization.slug}/issues/`;
  }

  get groupCountsEndpoint(): string {
    const {organization} = this.props;
    return `/organizations/${organization.slug}/issues-count/`;
  }

  get groupStatsEndpoint(): string {
    const {organization} = this.props;
    return `/organizations/${organization.slug}/issues-stats/`;
  }

  onRealtimeChange = (realtime: boolean) => {
    Cookies.set('realtimeActive', realtime.toString());
    this.setState({realtimeActive: realtime});
    trackAnalytics('issues_stream.realtime_clicked', {
      organization: this.props.organization,
      enabled: realtime,
    });
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

  onRealtimePoll = (data: any, {queryCount}: {queryCount: number}) => {
    // Note: We do not update state with cursors from polling,
    // `CursorPoller` updates itself with new cursors
    GroupStore.addToFront(data);
    this.setState({queryCount});
  };

  listener = GroupStore.listen(() => this.onGroupChange(), undefined);

  onGroupChange() {
    const groupIds = GroupStore.getAllItems()
      .map(item => item.id)
      .slice(0, MAX_ISSUES_COUNT);

    if (!isEqual(groupIds, this.state.groupIds)) {
      this.setState({groupIds});
    }
  }

  trackTabViewed(groups: string[], data: Group[], numHits: number | null) {
    const {organization, location} = this.props;
    const page = location.query.page;
    const endpointParams = this.getEndpointParams();
    const tabQueriesWithCounts = getTabsWithCounts();
    const currentTabQuery = tabQueriesWithCounts.includes(endpointParams.query as Query)
      ? endpointParams.query
      : null;
    const tab = getTabs().find(([tabQuery]) => currentTabQuery === tabQuery)?.[1];

    const numPerfIssues = groups.filter(
      group => GroupStore.get(group)?.issueCategory === IssueCategory.PERFORMANCE
    ).length;
    // First and last seen are only available after the group has fetched stats
    // Number of issues shown whose first seen is more than 30 days ago
    const numOldIssues = data.filter((group: BaseGroup) =>
      moment(new Date(group.firstSeen)).isBefore(moment().subtract(30, 'd'))
    ).length;
    // number of issues shown whose first seen is less than 7 days
    const numNewIssues = data.filter((group: BaseGroup) =>
      moment(new Date(group.firstSeen)).isAfter(moment().subtract(7, 'd'))
    ).length;

    trackAnalytics('issues_tab.viewed', {
      organization,
      tab: tab?.analyticsName,
      page: page ? parseInt(page, 10) : 0,
      query: this.getQuery(),
      num_perf_issues: numPerfIssues,
      num_old_issues: numOldIssues,
      num_new_issues: numNewIssues,
      num_issues: data.length,
      total_issues_count: numHits,
      issue_views_enabled: organization.features.includes('issue-stream-custom-views'),
      sort: this.getSort(),
    });
  }

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
    trackAnalytics('issues_stream.sort_changed', {
      organization: this.props.organization,
      sort,
    });
    this.transitionTo({sort});
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

  paginationAnalyticsEvent = (direction: string) => {
    trackAnalytics('issues_stream.paginate', {
      organization: this.props.organization,
      direction,
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
    return links && !links.previous!.results && !links.next!.results;
  }

  transitionTo = (
    newParams: Partial<EndpointParams> = {},
    savedSearch: (SavedSearch & {projectId?: number}) | null = this.props.savedSearch
  ) => {
    const query = {
      ...omit(this.props.location.query, ['page', 'cursor']),
      referrer: 'issue-list',
      ...this.getEndpointParams(),
      ...newParams,
    };
    const {organization} = this.props;
    let path: string;

    if (savedSearch?.id) {
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

    if (
      query.sort === IssueSortOptions.INBOX &&
      !FOR_REVIEW_QUERIES.includes(query.query || '')
    ) {
      delete query.sort;
    }

    if (
      path !== this.props.location.pathname ||
      !isEqual(query, this.props.location.query)
    ) {
      browserHistory.push({
        pathname: normalizeUrl(path),
        query,
      });
      this.setState({issuesLoading: true});
    }
  };

  displayReprocessingTab() {
    return !!this.state.queryCounts?.[Query.REPROCESSING]?.count;
  }

  displayReprocessingLayout(showReprocessingTab: boolean, query: string) {
    return showReprocessingTab && query === Query.REPROCESSING;
  }

  renderLoading(): React.ReactNode {
    return (
      <Layout.Page withPadding>
        <LoadingIndicator />
      </Layout.Page>
    );
  }

  onSavedSearchSelect = (savedSearch: SavedSearch) => {
    trackAnalytics('organization_saved_search.selected', {
      organization: this.props.organization,
      search_type: 'issues',
      id: savedSearch.id ? parseInt(savedSearch.id, 10) : -1,
      is_global: savedSearch.isGlobal,
      query: savedSearch.query,
      visibility: savedSearch.visibility,
    });
    this.setState({issuesLoading: true}, () => this.transitionTo(undefined, savedSearch));
  };

  onDelete = () => {
    this.actionTaken = true;
    this.fetchData(true);
  };

  undoAction = ({data, groups}: {data: IssueUpdateData; groups: BaseGroup[]}) => {
    const {organization, selection} = this.props;
    const query = this.getQuery();

    const projectIds = selection?.projects?.map(p => p.toString());
    const endpoint = `/organizations/${organization.slug}/issues/`;

    if (this._lastRequest) {
      this._lastRequest.cancel();
    }
    if (this._lastStatsRequest) {
      this._lastStatsRequest.cancel();
    }
    if (this._lastFetchCountsRequest) {
      this._lastFetchCountsRequest.cancel();
    }

    this.props.api.request(endpoint, {
      method: 'PUT',
      data,
      query: {
        project: projectIds,
        id: groups.map(group => group.id),
      },
      success: response => {
        if (!response) {
          return;
        }
        // If on the Ignore or For Review tab, adding back to the GroupStore will make the issue show up
        // on this page for a second and then be removed (will show up on All Unresolved). This is to
        // stop this from happening and avoid confusion.
        if (!query.includes('is:ignored') && !isForReviewQuery(query)) {
          GroupStore.add(groups);
        }
        this.undo = true;
      },
      error: err => {
        this.setState({
          error: parseApiError(err),
          issuesLoading: false,
        });
      },
      complete: () => {
        this.fetchData();
      },
    });
  };

  onActionTaken = (itemIds: string[], data: IssueUpdateData) => {
    if (this.state.realtimeActive) {
      return;
    }

    const query = this.getQuery();
    const groups = itemIds.map(id => GroupStore.get(id)).filter(defined);

    if ('status' in data) {
      if (data.status === 'resolved') {
        this.onIssueAction({
          itemIds,
          actionType: 'Resolved',
          shouldRemove:
            query.includes('is:unresolved') ||
            query.includes('is:ignored') ||
            isForReviewQuery(query),
          undo: () =>
            this.undoAction({
              data: {status: GroupStatus.UNRESOLVED, statusDetails: {}},
              groups,
            }),
        });
        return;
      }

      if (data.status === 'ignored') {
        this.onIssueAction({
          itemIds,
          actionType: 'Archived',
          shouldRemove: query.includes('is:unresolved') || isForReviewQuery(query),
          undo: () =>
            this.undoAction({
              data: {status: GroupStatus.UNRESOLVED, statusDetails: {}},
              groups,
            }),
        });
        return;
      }
    }

    if ('inbox' in data && data.inbox === false) {
      this.onIssueAction({
        itemIds,
        actionType: 'Reviewed',
        shouldRemove: isForReviewQuery(query),
      });
      return;
    }

    if ('priority' in data && typeof data.priority === 'string') {
      const priorityValues = parseIssuePrioritySearch(query);
      const priority = data.priority.toLowerCase() as PriorityLevel;

      this.onIssueAction({
        itemIds,
        actionType: 'Reprioritized',
        shouldRemove: !priorityValues.has(priority),
      });
      return;
    }
  };

  onIssueAction = ({
    itemIds,
    actionType,
    shouldRemove,
    undo,
  }: {
    actionType: 'Reviewed' | 'Resolved' | 'Ignored' | 'Archived' | 'Reprioritized';
    itemIds: string[];
    shouldRemove: boolean;
    undo?: () => void;
  }) => {
    if (itemIds.length > 1) {
      addMessage(`${actionType} ${itemIds.length} ${t('Issues')}`, 'success', {
        duration: 4000,
        undo,
      });
    } else {
      const shortId = itemIds.map(item => GroupStore.get(item)?.shortId).toString();
      addMessage(`${actionType} ${shortId}`, 'success', {
        duration: 4000,
        undo,
      });
    }

    if (!shouldRemove) {
      return;
    }

    const links = parseLinkHeader(this.state.pageLinks);

    GroupStore.remove(itemIds);

    const queryCount = this.state.queryCount - itemIds.length;
    this.actionTaken = true;
    this.setState({queryCount});

    if (GroupStore.getAllItemIds().length === 0) {
      // If we run out of issues on the last page, navigate back a page to
      // avoid showing an empty state - if not on the last page, just show a spinner
      const shouldGoBackAPage = links?.previous?.results && !links?.next?.results;
      this.transitionTo({cursor: shouldGoBackAPage ? links.previous!.cursor : undefined});
      this.fetchCounts(queryCount, true);
    } else {
      this.fetchData(true);
    }
  };

  getPageCounts = () => {
    const {location} = this.props;
    const {pageLinks, queryCount, groupIds} = this.state;
    const links = parseLinkHeader(pageLinks);
    const queryPageInt = parseInt(location.query.page, 10);
    // Cursor must be present for the page number to be used
    const page = isNaN(queryPageInt) || !location.query.cursor ? 0 : queryPageInt;

    let numPreviousIssues = Math.min(page * MAX_ITEMS, queryCount);

    // Because the query param `page` is not tied to the request, we need to
    // validate that it's correct at the first and last page
    if (!links?.next?.results || this.allResultsVisible()) {
      // On last available page
      numPreviousIssues = Math.max(queryCount - groupIds.length, 0);
    } else if (!links?.previous?.results) {
      // On first available page
      numPreviousIssues = 0;
    }

    return {
      numPreviousIssues,
      numIssuesOnPage: groupIds.length,
    };
  };

  render() {
    if (
      this.props.savedSearchLoading &&
      !this.props.organization.features.includes('issue-stream-performance')
    ) {
      return this.renderLoading();
    }

    const {
      pageLinks,
      queryCount,
      queryCounts,
      realtimeActive,
      groupIds,
      queryMaxCount,
      issuesLoading,
      error,
    } = this.state;
    const {organization, selection, router} = this.props;
    const query = this.getQuery();

    const modifiedQueryCount = Math.max(queryCount, 0);

    // TODO: these two might still be in use for reprocessing2
    const showReprocessingTab = this.displayReprocessingTab();
    const displayReprocessingActions = this.displayReprocessingLayout(
      showReprocessingTab,
      query
    );

    const {numPreviousIssues, numIssuesOnPage} = this.getPageCounts();

    return (
      <NewTabContextProvider>
        <Layout.Page>
          {organization.features.includes('issue-stream-custom-views') ? (
            <ErrorBoundary message={'Failed to load custom tabs'} mini>
              <IssueViewsIssueListHeader
                router={router}
                selectedProjectIds={selection.projects}
                realtimeActive={realtimeActive}
                onRealtimeChange={this.onRealtimeChange}
              />
            </ErrorBoundary>
          ) : (
            <IssueListHeader
              organization={organization}
              query={query}
              sort={this.getSort()}
              queryCount={queryCount}
              queryCounts={queryCounts}
              realtimeActive={realtimeActive}
              router={router}
              displayReprocessingTab={showReprocessingTab}
              selectedProjectIds={selection.projects}
              onRealtimeChange={this.onRealtimeChange}
            />
          )}

          <StyledBody>
            <StyledMain>
              <IssuesDataConsentBanner source="issues" />
              <IssueListFilters
                query={query}
                sort={this.getSort()}
                onSortChange={this.onSortChange}
                onSearch={this.onSearch}
              />
              <IssueListTable
                selection={selection}
                query={query}
                queryCount={modifiedQueryCount}
                onSelectStatsPeriod={this.onSelectStatsPeriod}
                onActionTaken={this.onActionTaken}
                onDelete={this.onDelete}
                statsPeriod={this.getGroupStatsPeriod()}
                groupIds={groupIds}
                allResultsVisible={this.allResultsVisible()}
                displayReprocessingActions={displayReprocessingActions}
                sort={this.getSort()}
                onSortChange={this.onSortChange}
                memberList={this.state.memberList}
                selectedProjectIds={selection.projects}
                issuesLoading={issuesLoading}
                error={error}
                refetchGroups={this.fetchData}
                paginationCaption={
                  !issuesLoading && modifiedQueryCount > 0
                    ? tct('[start]-[end] of [total]', {
                        start: numPreviousIssues + 1,
                        end: numPreviousIssues + numIssuesOnPage,
                        total: (
                          <StyledQueryCount
                            hideParens
                            hideIfEmpty={false}
                            count={modifiedQueryCount}
                            max={queryMaxCount || 100}
                          />
                        ),
                      })
                    : null
                }
                pageLinks={pageLinks}
                onCursor={this.onCursorChange}
                paginationAnalyticsEvent={this.paginationAnalyticsEvent}
                personalSavedSearches={this.props.savedSearches?.filter(
                  search => search.visibility === 'owner'
                )}
                organizationSavedSearches={this.props.savedSearches?.filter(
                  search => search.visibility === 'organization'
                )}
              />
            </StyledMain>
            <SavedIssueSearches
              {...{organization, query}}
              onSavedSearchSelect={this.onSavedSearchSelect}
              sort={this.getSort()}
            />
          </StyledBody>
        </Layout.Page>
      </NewTabContextProvider>
    );
  }
}

export default withRouteAnalytics(
  withApi(
    withPageFilters(
      withSavedSearches(withOrganization(Sentry.withProfiler(IssueListOverview)))
    )
  )
);

export {IssueListOverview};

const StyledBody = styled('div')`
  background-color: ${p => p.theme.background};

  flex: 1;
  display: grid;
  gap: 0;
  padding: 0;

  grid-template-rows: 1fr;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: 'content saved-searches';
`;

const StyledMain = styled('section')`
  grid-area: content;
  padding: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(3)} ${space(4)};
  }
`;

const StyledQueryCount = styled(QueryCount)`
  margin-left: 0;
`;
