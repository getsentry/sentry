import {Component} from 'react';
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
import moment from 'moment';
import * as qs from 'query-string';

import {addMessage} from 'sentry/actionCreators/indicator';
import {fetchOrgMembers, indexMembersByProject} from 'sentry/actionCreators/members';
import {fetchTagValues, loadOrganizationTags} from 'sentry/actionCreators/tags';
import {Client} from 'sentry/api';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {extractSelectionParameters} from 'sentry/components/organizations/pageFilters/utils';
import Pagination, {CursorHandler} from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import QueryCount from 'sentry/components/queryCount';
import ProcessingIssueList from 'sentry/components/stream/processingIssueList';
import {DEFAULT_QUERY, DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t, tct, tn} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import IssueListCacheStore from 'sentry/stores/IssueListCacheStore';
import SelectedGroupStore from 'sentry/stores/selectedGroupStore';
import {space} from 'sentry/styles/space';
import {
  BaseGroup,
  Group,
  IssueCategory,
  Organization,
  PageFilters,
  SavedSearch,
  TagCollection,
} from 'sentry/types';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import CursorPoller from 'sentry/utils/cursorPoller';
import {getUtcDateString} from 'sentry/utils/dates';
import getCurrentSentryReactTransaction from 'sentry/utils/getCurrentSentryReactTransaction';
import parseApiError from 'sentry/utils/parseApiError';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {decodeScalar} from 'sentry/utils/queryString';
import withRouteAnalytics, {
  WithRouteAnalyticsProps,
} from 'sentry/utils/routeAnalytics/withRouteAnalytics';
import withApi from 'sentry/utils/withApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withIssueTags from 'sentry/utils/withIssueTags';
import withOrganization from 'sentry/utils/withOrganization';
import withPageFilters from 'sentry/utils/withPageFilters';
import withSavedSearches from 'sentry/utils/withSavedSearches';
import SavedIssueSearches from 'sentry/views/issueList/savedIssueSearches';

import IssueListActions from './actions';
import IssueListFilters from './filters';
import GroupListBody from './groupListBody';
import IssueListHeader from './header';
import {
  DEFAULT_ISSUE_STREAM_SORT,
  FOR_REVIEW_QUERIES,
  getTabs,
  getTabsWithCounts,
  isForReviewQuery,
  IssueSortOptions,
  Query,
  QueryCounts,
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
  tags: TagCollection;
} & RouteComponentProps<{searchId?: string}, {}> &
  WithRouteAnalyticsProps;

type State = {
  actionTaken: boolean;
  actionTakenGroupData: Group[];
  error: string | null;
  groupIds: string[];
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
  selectAllActive: boolean;
  undo: boolean;
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
      actionTakenGroupData: [],
      undo: false,
      selectAllActive: false,
      realtimeActive,
      pageLinks: '',
      itemsRemoved: 0,
      queryCount: 0,
      queryCounts: {},
      queryMaxCount: 0,
      error: null,
      issuesLoading: true,
      memberList: {},
    };
  }

  componentDidMount() {
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
    this.fetchTags();
    this.fetchMemberList();
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
      this.fetchTags();
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
    if (
      groups.length > 0 &&
      !this.state.issuesLoading &&
      !this.state.realtimeActive &&
      this.props.organization.features.includes('issue-stream-performance-cache')
    ) {
      IssueListCacheStore.save(this.getCacheEndpointParams(), {
        groups,
        queryCount: this.state.queryCount,
        queryMaxCount: this.state.queryMaxCount,
        pageLinks: this.state.pageLinks,
      });
    }
    this._poller.disable();
    SelectedGroupStore.reset();
    GroupStore.reset();
    this.props.api.clear();
    this.listener?.();
  }

  private _poller: any;
  private _lastRequest: any;
  private _lastStatsRequest: any;
  private _lastFetchCountsRequest: any;

  getQueryFromSavedSearchOrLocation({
    savedSearch,
    location,
  }: Pick<Props, 'savedSearch' | 'location'>): string {
    if (savedSearch) {
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
    if (!this.props.organization.features.includes('issue-stream-performance-cache')) {
      return false;
    }

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

  fetchTags() {
    const {api, organization, selection} = this.props;
    loadOrganizationTags(api, organization.slug, selection);
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
        this.trackTabViewed(groups, data);
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

  fetchCounts = (currentQueryCount: number, fetchAllCounts: boolean) => {
    const {organization} = this.props;
    const {queryCounts: _queryCounts} = this.state;
    let queryCounts: QueryCounts = {..._queryCounts};

    const endpointParams = this.getEndpointParams();
    const tabQueriesWithCounts = getTabsWithCounts(organization);
    const currentTabQuery = tabQueriesWithCounts.includes(endpointParams.query as Query)
      ? endpointParams.query
      : null;

    // Update the count based on the exact number of issues, these shown as is
    if (currentTabQuery) {
      queryCounts[currentTabQuery] = {
        count: currentQueryCount,
        hasMore: false,
      };
    }

    this.setState({queryCounts});

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

    if (!this.state.realtimeActive) {
      if (!this.state.actionTaken && !this.state.undo) {
        GroupStore.loadInitialData([]);

        this.setState({
          issuesLoading: true,
          queryCount: 0,
          itemsRemoved: 0,
          error: null,
        });
      }
    } else {
      if (!isForReviewQuery(query)) {
        GroupStore.loadInitialData([]);

        this.setState({
          issuesLoading: true,
          queryCount: 0,
          itemsRemoved: 0,
          error: null,
        });
      }
    }

    const transaction = getCurrentSentryReactTransaction();
    transaction?.setTag('query.sort', this.getSort());

    this.setState({
      itemsRemoved: 0,
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
      !this.props.location.query.query
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
          if (data[0] && data[0].matchingEventId) {
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

        if (this.state.undo) {
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
          this.setState({actionTaken: false, undo: false});
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
    if (links && !links.previous.results && this.state.realtimeActive) {
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
    const {actionTakenGroupData} = this.state;
    const query = this.getQuery();

    if (!this.state.realtimeActive && actionTakenGroupData.length > 0) {
      const filteredItems = GroupStore.getAllItems().filter(item => {
        return actionTakenGroupData.findIndex(data => data.id === item.id) !== -1;
      });

      const resolvedIds = filteredItems
        .filter(item => item.status === 'resolved')
        .map(id => id.id);
      const ignoredIds = filteredItems
        .filter(item => item.status === 'ignored')
        .map(i => i.id);
      // need to include resolve and ignored statuses because marking as resolved/ignored also
      // counts as reviewed
      const reviewedIds = filteredItems
        .filter(
          item => !item.inbox && item.status !== 'resolved' && item.status !== 'ignored'
        )
        .map(i => i.id);
      // Remove Ignored and Resolved group ids from the issue stream if on the All Unresolved,
      // For Review, or Ignored tab. Still include on the saved/custom search tab.
      if (
        resolvedIds.length > 0 &&
        (query.includes('is:unresolved') ||
          query.includes('is:ignored') ||
          isForReviewQuery(query))
      ) {
        this.onIssueAction(resolvedIds, 'Resolved');
      }
      if (
        ignoredIds.length > 0 &&
        (query.includes('is:unresolved') || isForReviewQuery(query))
      ) {
        this.onIssueAction(ignoredIds, 'Archived');
      }
      // Remove issues that are marked as Reviewed from the For Review tab, but still include the
      // issues if on the All Unresolved tab or saved/custom searches.
      if (
        reviewedIds.length > 0 &&
        (isForReviewQuery(query) || query.includes('is:ignored'))
      ) {
        this.onIssueAction(reviewedIds, 'Reviewed');
      }
    }

    const groupIds = GroupStore.getAllItems()
      .map(item => item.id)
      .slice(0, MAX_ISSUES_COUNT);
    if (!isEqual(groupIds, this.state.groupIds)) {
      this.setState({groupIds});
    }
  }

  trackTabViewed(groups: string[], data: Group[]) {
    const {organization, location} = this.props;
    const page = location.query.page;
    const endpointParams = this.getEndpointParams();
    const tabQueriesWithCounts = getTabsWithCounts(organization);
    const currentTabQuery = tabQueriesWithCounts.includes(endpointParams.query as Query)
      ? endpointParams.query
      : null;
    const tab = getTabs(organization).find(
      ([tabQuery]) => currentTabQuery === tabQuery
    )?.[1];

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
    return links && !links.previous.results && !links.next.results;
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
    this.setState({actionTaken: true});
    this.fetchData(true);
  };

  onUndo = () => {
    const {organization, selection} = this.props;
    const {actionTakenGroupData} = this.state;
    const query = this.getQuery();

    const groupIds = actionTakenGroupData.map(data => data.id);
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
      data: {
        status: 'unresolved',
      },
      query: {
        project: projectIds,
        id: groupIds,
      },
      success: response => {
        if (!response) {
          return;
        }
        // If on the Ignore or For Review tab, adding back to the GroupStore will make the issue show up
        // on this page for a second and then be removed (will show up on All Unresolved). This is to
        // stop this from happening and avoid confusion.
        if (!query.includes('is:ignored') && !isForReviewQuery(query)) {
          GroupStore.add(actionTakenGroupData);
        }
        this.setState({undo: true});
      },
      error: err => {
        this.setState({
          error: parseApiError(err),
          issuesLoading: false,
        });
      },
      complete: () => {
        this.setState({actionTakenGroupData: []});
        this.fetchData();
      },
    });
  };

  onMarkReviewed = (itemIds: string[]) => {
    const query = this.getQuery();

    if (!isForReviewQuery(query)) {
      if (itemIds.length > 1) {
        addMessage(
          tn('Reviewed %s Issue', 'Reviewed %s Issues', itemIds.length),
          'success',
          {duration: 4000}
        );
      } else {
        const shortId = itemIds.map(item => GroupStore.get(item)?.shortId).toString();
        addMessage(t('Reviewed %s', shortId), 'success', {duration: 4000});
      }
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
      });
    }
  };

  onActionTaken = (itemIds: string[]) => {
    const actionTakenGroupData = itemIds
      .map(id => GroupStore.get(id) as Group | undefined)
      .filter(defined);
    this.setState({
      actionTakenGroupData,
    });
  };

  onIssueAction = (
    itemIds: string[],
    actionType: 'Reviewed' | 'Resolved' | 'Ignored' | 'Archived'
  ) => {
    if (itemIds.length > 1) {
      addMessage(`${actionType} ${itemIds.length} ${t('Issues')}`, 'success', {
        duration: 4000,
        ...(actionType !== 'Reviewed' && {undo: this.onUndo}),
      });
    } else {
      const shortId = itemIds.map(item => GroupStore.get(item)?.shortId).toString();
      addMessage(`${actionType} ${shortId}`, 'success', {
        duration: 4000,
        ...(actionType !== 'Reviewed' && {undo: this.onUndo}),
      });
    }

    const links = parseLinkHeader(this.state.pageLinks);

    GroupStore.remove(itemIds);
    const queryCount = this.state.queryCount - itemIds.length;
    this.setState({
      actionTaken: true,
      queryCount,
    });

    if (GroupStore.getAllItemIds().length === 0) {
      // If we run out of issues on the last page, navigate back a page to
      // avoid showing an empty state - if not on the last page, just show a spinner
      const shouldGoBackAPage = links?.previous?.results && !links?.next?.results;
      this.transitionTo({cursor: shouldGoBackAPage ? links.previous.cursor : undefined});
      this.fetchCounts(queryCount, true);
    } else {
      this.fetchData(true);
    }
  };

  tagValueLoader = (key: string, search: string) => {
    const {organization} = this.props;
    const projectIds = this.getSelectedProjectIds();
    const endpointParams = this.getEndpointParams();

    return fetchTagValues({
      api: this.props.api,
      orgSlug: organization.slug,
      tagKey: key,
      search,
      projectIds,
      endpointParams: endpointParams as any,
    });
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
      itemsRemoved,
      issuesLoading,
      error,
    } = this.state;
    const {organization, selection, router} = this.props;
    const query = this.getQuery();

    const modifiedQueryCount = Math.max(queryCount - itemsRemoved, 0);
    const projectIds = selection?.projects?.map(p => p.toString());

    const showReprocessingTab = this.displayReprocessingTab();
    const displayReprocessingActions = this.displayReprocessingLayout(
      showReprocessingTab,
      query
    );

    const {numPreviousIssues, numIssuesOnPage} = this.getPageCounts();

    return (
      <Layout.Page>
        <IssueListHeader
          organization={organization}
          query={query}
          sort={this.getSort()}
          queryCount={queryCount}
          queryCounts={queryCounts}
          realtimeActive={realtimeActive}
          onRealtimeChange={this.onRealtimeChange}
          router={router}
          displayReprocessingTab={showReprocessingTab}
          selectedProjectIds={selection.projects}
        />
        <StyledBody>
          <StyledMain>
            <IssueListFilters query={query} onSearch={this.onSearch} />

            <Panel>
              <IssueListActions
                selection={selection}
                query={query}
                queryCount={modifiedQueryCount}
                onSelectStatsPeriod={this.onSelectStatsPeriod}
                onMarkReviewed={this.onMarkReviewed}
                onActionTaken={this.onActionTaken}
                onDelete={this.onDelete}
                statsPeriod={this.getGroupStatsPeriod()}
                groupIds={groupIds}
                allResultsVisible={this.allResultsVisible()}
                displayReprocessingActions={displayReprocessingActions}
                sort={this.getSort()}
                onSortChange={this.onSortChange}
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
                  isLoading={this.state.issuesLoading}
                >
                  <GroupListBody
                    memberList={this.state.memberList}
                    groupStatsPeriod={this.getGroupStatsPeriod()}
                    groupIds={groupIds}
                    displayReprocessingLayout={displayReprocessingActions}
                    query={query}
                    sort={this.getSort()}
                    selectedProjectIds={selection.projects}
                    loading={issuesLoading}
                    error={error}
                    refetchGroups={this.fetchData}
                  />
                </VisuallyCompleteWithData>
              </PanelBody>
            </Panel>
            <StyledPagination
              caption={
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
            />
          </StyledMain>
          <SavedIssueSearches
            {...{organization, query}}
            onSavedSearchSelect={this.onSavedSearchSelect}
            sort={this.getSort()}
          />
        </StyledBody>
      </Layout.Page>
    );
  }
}

export default withRouteAnalytics(
  withApi(
    withPageFilters(
      withSavedSearches(withOrganization(withIssueTags(withProfiler(IssueListOverview))))
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

const StyledPagination = styled(Pagination)`
  margin-top: 0;
`;

const StyledQueryCount = styled(QueryCount)`
  margin-left: 0;
`;
