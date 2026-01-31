import type {ReactNode} from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import type {Location} from 'history';
import Cookies from 'js-cookie';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import pickBy from 'lodash/pickBy';
import * as qs from 'query-string';

import {addMessage} from 'sentry/actionCreators/indicator';
import {fetchOrgMembers, indexMembersByProject} from 'sentry/actionCreators/members';
import * as Layout from 'sentry/components/layouts/thirds';
import {extractSelectionParameters} from 'sentry/components/organizations/pageFilters/utils';
import type {CursorHandler} from 'sentry/components/pagination';
import QueryCount from 'sentry/components/queryCount';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import IssueListCacheStore from 'sentry/stores/IssueListCacheStore';
import SelectedGroupStore from 'sentry/stores/selectedGroupStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {BaseGroup, Group, PriorityLevel} from 'sentry/types/group';
import {GroupStatus} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import CursorPoller from 'sentry/utils/cursorPoller';
import {getUtcDateString} from 'sentry/utils/dates';
import getCurrentSentryReactRootSpan from 'sentry/utils/getCurrentSentryReactRootSpan';
import parseApiError from 'sentry/utils/parseApiError';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {makeIssuesINPObserver} from 'sentry/utils/performanceForSentry';
import {decodeScalar} from 'sentry/utils/queryString';
import type RequestError from 'sentry/utils/requestError/requestError';
import useDisableRouteAnalytics from 'sentry/utils/routeAnalytics/useDisableRouteAnalytics';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useParams} from 'sentry/utils/useParams';
import usePrevious from 'sentry/utils/usePrevious';
import IssueListTable from 'sentry/views/issueList/issueListTable';
import {IssuesDataConsentBanner} from 'sentry/views/issueList/issuesDataConsentBanner';
import IssueViewsHeader from 'sentry/views/issueList/issueViewsHeader';
import type {IssueUpdateData} from 'sentry/views/issueList/types';
import {parseIssuePrioritySearch} from 'sentry/views/issueList/utils/parseIssuePrioritySearch';

import IssueListFilters from './filters';
import {
  DEFAULT_ISSUE_STREAM_SORT,
  DEFAULT_QUERY,
  FOR_REVIEW_QUERIES,
  isForReviewQuery,
  IssueSortOptions,
  Query,
} from './utils';

const MAX_ITEMS = 25;
// the default period for the graph in each issue row
const DEFAULT_GRAPH_STATS_PERIOD = '24h';
// the allowed period choices for graph in each issue row
const DYNAMIC_COUNTS_STATS_PERIODS = new Set(['14d', '24h', 'auto']);
const MAX_ISSUES_COUNT = 100;

interface Props {
  headerActions?: ReactNode;
  initialQuery?: string;
  shouldFetchOnMount?: boolean;
  title?: ReactNode;
  titleDescription?: ReactNode;
}

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

type StatEndpointParams = Omit<EndpointParams, 'cursor' | 'page'> & {
  groups: string[];
  expand?: string | string[];
};

function useIssuesINPObserver() {
  const _performanceObserver = useRef<PerformanceObserver | undefined>(undefined);

  useEffect(() => {
    _performanceObserver.current = makeIssuesINPObserver();

    return () => {
      if (_performanceObserver.current) {
        _performanceObserver.current.disconnect();
      }
    };
  }, []);
}

const parsePageQueryParam = (location: Location, defaultPage = 0) => {
  const page = location.query.page;
  const pageInt = Array.isArray(page)
    ? parseInt(page[0] ?? '', 10)
    : parseInt(page ?? '', 10);

  if (isNaN(pageInt)) {
    return defaultPage;
  }

  return pageInt;
};

function IssueListOverview({
  initialQuery = DEFAULT_QUERY,
  shouldFetchOnMount = true,
  title = t('Issues'),
  titleDescription,
  headerActions,
}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const navigate = useNavigate();
  const {selection} = usePageFilters();
  const api = useApi();
  const urlParams = useParams<{viewId?: string}>();
  const realtimeActiveCookie = Cookies.get('realtimeActive');
  const [realtimeActive, setRealtimeActive] = useState(
    typeof realtimeActiveCookie === 'undefined' || urlParams.viewId
      ? false
      : realtimeActiveCookie === 'true'
  );
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [pageLinks, setPageLinks] = useState('');
  const [queryCount, setQueryCount] = useState(0);
  const [queryMaxCount, setQueryMaxCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [issuesSuccessfullyLoaded, setIssuesSuccessfullyLoaded] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [memberList, setMemberList] = useState<ReturnType<typeof indexMembersByProject>>(
    {}
  );
  const undoRef = useRef(false);
  const pollerRef = useRef<CursorPoller | undefined>(undefined);
  const actionTakenRef = useRef(false);

  const groups = useLegacyStore(GroupStore);
  useEffect(() => {
    const storeGroupIds = groups.map(group => group.id).slice(0, MAX_ISSUES_COUNT);
    if (!isEqual(groupIds, storeGroupIds)) {
      setGroupIds(storeGroupIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  useIssuesINPObserver();

  const onRealtimePoll = useCallback(
    (data: any, {queryCount: newQueryCount}: {queryCount: number}) => {
      // Note: We do not update state with cursors from polling,
      // `CursorPoller` updates itself with new cursors
      GroupStore.addToFront(data);
      setQueryCount(newQueryCount);
    },
    []
  );

  useEffect(() => {
    // Either cleanup or reuse the poller to prevent a resource leak.
    if (pollerRef.current) {
      pollerRef.current.setEndpoint(parseLinkHeader(pageLinks)?.previous?.href!);
      return;
    }

    pollerRef.current = new CursorPoller({
      linkPreviousHref: parseLinkHeader(pageLinks)?.previous?.href!,
      success: onRealtimePoll,
    });
  }, [onRealtimePoll, pageLinks]);

  const query = defined(location.query.query)
    ? (location.query.query as string)
    : initialQuery;
  const sort = decodeScalar(
    location.query.sort,
    DEFAULT_ISSUE_STREAM_SORT
  ) as IssueSortOptions;

  const getGroupStatsPeriod = useCallback((): string => {
    let currentPeriod: string;
    if (typeof location.query?.groupStatsPeriod === 'string') {
      currentPeriod = location.query.groupStatsPeriod;
    } else {
      currentPeriod = DEFAULT_GRAPH_STATS_PERIOD;
    }

    return DYNAMIC_COUNTS_STATS_PERIODS.has(currentPeriod)
      ? currentPeriod
      : DEFAULT_GRAPH_STATS_PERIOD;
  }, [location]);

  const getEndpointParams = useCallback((): EndpointParams => {
    const params: EndpointParams = {
      project: selection.projects,
      environment: selection.environments,
      query,
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

    if (sort !== DEFAULT_ISSUE_STREAM_SORT) {
      params.sort = sort;
    }

    const groupStatsPeriod = getGroupStatsPeriod();
    if (groupStatsPeriod !== DEFAULT_GRAPH_STATS_PERIOD) {
      params.groupStatsPeriod = groupStatsPeriod;
    }

    // only include defined values.
    return pickBy(params, v => defined(v)) as EndpointParams;
  }, [selection, query, sort, getGroupStatsPeriod]);

  const requestParams = useMemo(() => {
    const params: any = {
      ...getEndpointParams(),
      limit: MAX_ITEMS,
      shortIdLookup: 1,
    };

    const currentQuery = location.query || {};
    if ('cursor' in currentQuery) {
      params.cursor = currentQuery.cursor;
    }

    // If no stats period values are set, use default
    if (!params.statsPeriod && !params.start) {
      params.statsPeriod = DEFAULT_STATS_PERIOD;
    }

    params.expand = ['owners', 'inbox'];
    params.collapse = ['stats', 'unhandled'];

    return params;
  }, [getEndpointParams, location.query]);

  const loadFromCache = useCallback((): boolean => {
    const cache = IssueListCacheStore.getFromCache(requestParams);

    if (!cache) {
      return false;
    }

    setIssuesLoading(false);
    setIssuesSuccessfullyLoaded(true);
    setQueryCount(cache.queryCount);
    setQueryMaxCount(cache.queryMaxCount);
    setPageLinks(cache.pageLinks);

    GroupStore.add(cache.groups);

    return true;
  }, [requestParams]);

  const resumePolling = useCallback(() => {
    if (!pageLinks) {
      return;
    }

    // Only resume polling if we're on the first page of results
    const links = parseLinkHeader(pageLinks);
    if (links && !links.previous!.results && realtimeActive) {
      pollerRef.current?.setEndpoint(links?.previous!.href);
      pollerRef.current?.enable();
    }
  }, [pageLinks, realtimeActive]);

  const fetchStats = useCallback(
    async (newGroupIds: string[]) => {
      // If we have no groups to fetch, just skip stats
      if (!newGroupIds.length) {
        setStatsLoading(false);
        return;
      }

      setStatsLoading(true);

      const statsRequestParams: StatEndpointParams = {
        ...getEndpointParams(),
        groups: newGroupIds,
      };
      // If no stats period values are set, use default
      if (!statsRequestParams.statsPeriod && !statsRequestParams.start) {
        statsRequestParams.statsPeriod = DEFAULT_STATS_PERIOD;
      }

      try {
        const data = await api.requestPromise(
          `/organizations/${organization.slug}/issues-stats/`,
          {
            method: 'GET',
            data: qs.stringify(statsRequestParams),
          }
        );

        if (data) {
          GroupStore.onPopulateStats(newGroupIds, data);
        }
      } catch (e) {
        setError(parseApiError(e as RequestError));
      } finally {
        setStatsLoading(false);
        // End navigation transaction to prevent additional page requests from impacting page metrics.
        // Other transactions include stacktrace preview request
        const currentSpan = Sentry.getActiveSpan();
        const rootSpan = currentSpan ? Sentry.getRootSpan(currentSpan) : undefined;
        if (rootSpan && Sentry.spanToJSON(rootSpan).op === 'navigation') {
          rootSpan.end();
        }
      }
    },
    [getEndpointParams, api, organization.slug]
  );

  // Blank views are created with ?new=true, in order to show the empty state.
  // We want to clear this query param when data is fetched.
  const resetNewViewQueryParam = useCallback(() => {
    if (location.query.new) {
      navigate(
        {
          pathname: location.pathname,
          query: {
            ...location.query,
            new: undefined,
          },
        },
        {
          replace: true,
          preventScrollReset: true,
        }
      );
    }
  }, [location.pathname, navigate, location.query]);

  const fetchData = useCallback(() => {
    resetNewViewQueryParam();

    if (realtimeActive || (!actionTakenRef.current && !undoRef.current)) {
      GroupStore.loadInitialData([]);

      setIssuesLoading(true);
      setQueryCount(0);
      setError(null);
    }

    const span = getCurrentSentryReactRootSpan();
    span?.setAttribute('query.sort', sort);

    setError(null);

    api.clear();
    pollerRef.current?.disable();

    api.request(`/organizations/${organization.slug}/issues/`, {
      method: 'GET',
      data: qs.stringify(requestParams),
      success: async (data, _, resp) => {
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

          navigate(
            normalizeUrl({
              pathname: redirect,
              query: {
                referrer: 'issue-list',
                ...extractSelectionParameters(location.query),
              },
            }),
            {replace: true}
          );
          return;
        }

        if (undoRef.current) {
          GroupStore.loadInitialData(data);
        }
        GroupStore.add(data);

        if (data.length === 0) {
          trackAnalytics('issue_search.empty', {
            organization,
            search_type: 'issues',
            search_source: 'main_search',
            query,
          });
        }

        const hits = resp.getResponseHeader('X-Hits');
        const newQueryCount =
          typeof hits !== 'undefined' && hits ? parseInt(hits, 10) || 0 : 0;
        const maxHits = resp.getResponseHeader('X-Max-Hits');
        const newQueryMaxCount =
          typeof maxHits !== 'undefined' && maxHits ? parseInt(maxHits, 10) || 0 : 0;
        const newPageLinks = resp.getResponseHeader('Link');

        setError(null);
        setIssuesLoading(false);
        setIssuesSuccessfullyLoaded(true);
        setQueryCount(newQueryCount);
        setQueryMaxCount(newQueryMaxCount);
        setPageLinks(newPageLinks === null ? '' : newPageLinks);

        // Need to wait for stats request to finish before saving to cache
        await fetchStats(data.map((group: BaseGroup) => group.id));
        IssueListCacheStore.save(requestParams, {
          groups: GroupStore.getState() as Group[],
          queryCount: newQueryCount,
          queryMaxCount: newQueryMaxCount,
          pageLinks: newPageLinks ?? '',
        });
      },
      error: err => {
        trackAnalytics('issue_search.failed', {
          organization,
          search_type: 'issues',
          search_source: 'main_search',
          error: parseApiError(err),
        });

        setError(parseApiError(err));
        setIssuesLoading(false);
        setIssuesSuccessfullyLoaded(false);
      },
      complete: () => {
        resumePolling();

        if (!realtimeActive) {
          actionTakenRef.current = false;
          undoRef.current = false;
        }
      },
    });
  }, [
    resetNewViewQueryParam,
    realtimeActive,
    sort,
    api,
    organization,
    requestParams,
    fetchStats,
    navigate,
    location.query,
    query,
    resumePolling,
  ]);

  useDisableRouteAnalytics(issuesLoading);
  useRouteAnalyticsEventNames('issues.viewed', 'Issues: Viewed');
  useRouteAnalyticsParams({
    page: parsePageQueryParam(location, 0),
    query,
    num_issues: groups.length,
    total_issues_count: queryCount,
    sort,
    realtime_active: realtimeActive,
    is_view: urlParams.viewId ? true : false,
  });

  // Update polling status
  useEffect(() => {
    if (realtimeActive) {
      resumePolling();
    } else {
      pollerRef.current?.disable();
    }
  }, [realtimeActive, resumePolling]);

  // Fetch data on mount if necessary
  useEffect(() => {
    if (!shouldFetchOnMount) {
      setIssuesLoading(false);
      return;
    }

    const loadedFromCache = loadFromCache();
    if (!loadedFromCache) {
      // It's possible the projects query parameter is not yet ready and this
      // request will be repeated in componentDidUpdate
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previousSelection = usePrevious(selection);
  const previousIssuesLoading = usePrevious(issuesLoading);

  const previousRequestParams = usePrevious(requestParams);

  // Keep data up to date
  useEffect(() => {
    // If any important url parameter changed or saved search changed
    // reload data.
    if (!isEqual(previousRequestParams, requestParams)) {
      fetchData();
    }
  }, [
    fetchData,
    selection,
    previousSelection,
    organization.features,
    issuesLoading,
    loadFromCache,
    previousIssuesLoading,
    previousRequestParams,
    requestParams,
  ]);

  // Fetch members on mount
  useEffect(() => {
    const projectIds = selection.projects.map(projectId => String(projectId));

    fetchOrgMembers(api, organization.slug, projectIds).then(members => {
      setMemberList(indexMembersByProject(members));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the project selection has changed reload the member list and tag keys
  // allowing autocomplete and tag sidebar to be more accurate.
  useEffect(() => {
    if (isEqual(previousSelection?.projects, selection.projects)) {
      return;
    }

    const projectIds = selection.projects.map(projectId => String(projectId));

    fetchOrgMembers(api, organization.slug, projectIds).then(members => {
      setMemberList(indexMembersByProject(members));
    });
  }, [api, organization.slug, selection.projects, previousSelection?.projects]);

  // Cleanup
  useEffect(() => {
    return () => {
      pollerRef.current?.disable();
      SelectedGroupStore.reset();
      GroupStore.reset();
    };
  }, []);

  const allResultsVisible = useCallback(() => {
    if (!pageLinks) {
      return false;
    }

    const links = parseLinkHeader(pageLinks);
    return links && !links.previous!.results && !links.next!.results;
  }, [pageLinks]);

  const getPageCounts = useCallback(() => {
    const links = parseLinkHeader(pageLinks);
    const queryPageInt = parsePageQueryParam(location, 0);
    // Cursor must be present for the page number to be used
    const page = location.query.cursor ? queryPageInt : 0;

    let numPreviousIssues = Math.min(page * MAX_ITEMS, queryCount);

    // Because the query param `page` is not tied to the request, we need to
    // validate that it's correct at the first and last page
    if (!links?.next?.results || allResultsVisible()) {
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
  }, [pageLinks, location, queryCount, allResultsVisible, groupIds.length]);

  const onRealtimeChange = useCallback(
    (realtime: boolean) => {
      Cookies.set('realtimeActive', realtime.toString());
      setRealtimeActive(realtime);
      trackAnalytics('issues_stream.realtime_clicked', {
        organization,
        enabled: realtime,
      });
    },
    [organization]
  );

  const transitionTo = (newParams: Partial<EndpointParams> = {}) => {
    const queryData = {
      ...omit(location.query, ['page', 'cursor']),
      referrer: 'issue-list',
      ...getEndpointParams(),
      ...newParams,
    };
    if (
      queryData.sort === IssueSortOptions.INBOX &&
      !FOR_REVIEW_QUERIES.includes(queryData.query || '')
    ) {
      delete queryData.sort;
    }

    navigate({
      pathname: location.pathname,
      query: queryData,
    });
  };

  const onSearch = (newQuery: string) => {
    if (newQuery === query) {
      // if query is the same, just re-fetch data
      fetchData();
    } else {
      transitionTo({query: newQuery});
    }
  };

  const onSortChange = (newSort: string) => {
    trackAnalytics('issues_stream.sort_changed', {
      organization,
      sort: newSort,
    });
    transitionTo({sort: newSort});
  };

  const onCursorChange: CursorHandler = (nextCursor, _path, _query, delta) => {
    const queryPageInt = Array.isArray(location.query.page)
      ? NaN
      : parseInt(location.query.page?.toString() ?? '', 10);
    let nextPage: number | undefined = isNaN(queryPageInt) ? delta : queryPageInt + delta;

    let cursor: undefined | string = nextCursor;

    // unset cursor and page when we navigate back to the first page
    // also reset cursor if somehow the previous button is enabled on
    // first page and user attempts to go backwards
    if (nextPage <= 0) {
      cursor = undefined;
      nextPage = undefined;
    }

    transitionTo({cursor, page: nextPage});
  };

  const onSelectStatsPeriod = (period: string) => {
    if (period !== getGroupStatsPeriod()) {
      const cursor = Array.isArray(location.query.cursor)
        ? location.query.cursor[0]
        : (location.query.cursor ?? undefined);
      const queryPageInt = parsePageQueryParam(location, 0);
      const page = location.query.cursor ? queryPageInt : 0;
      transitionTo({cursor, page, groupStatsPeriod: period});
    }
  };

  const undoAction = ({
    data,
    groupItems,
  }: {
    data: IssueUpdateData;
    groupItems: BaseGroup[];
  }) => {
    const projectIds = selection?.projects?.map(p => p.toString());
    const endpoint = `/organizations/${organization.slug}/issues/`;

    api.clear();

    api.request(endpoint, {
      method: 'PUT',
      data,
      query: {
        project: projectIds,
        id: groupItems.map(group => group.id),
      },
      success: response => {
        if (!response) {
          return;
        }
        // If on the Ignore or For Review tab, adding back to the GroupStore will make the issue show up
        // on this page for a second and then be removed (will show up on All Unresolved). This is to
        // stop this from happening and avoid confusion.
        if (!query.includes('is:ignored') && !isForReviewQuery(query)) {
          GroupStore.add(groupItems);
        }
        actionTakenRef.current = true;
      },
      error: err => {
        setError(parseApiError(err as RequestError));
        setIssuesLoading(false);
      },
      complete: () => {
        fetchData();
      },
    });
  };

  const onIssueAction = ({
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

    const links = parseLinkHeader(pageLinks);

    GroupStore.remove(itemIds);

    const newQueryCount = queryCount - itemIds.length;
    actionTakenRef.current = true;
    setQueryCount(newQueryCount);

    if (GroupStore.getAllItemIds().length === 0) {
      // If we run out of issues on the last page, navigate back a page to
      // avoid showing an empty state - if not on the last page, just show a spinner
      const shouldGoBackAPage = links?.previous?.results && !links?.next?.results;
      transitionTo({cursor: shouldGoBackAPage ? links.previous!.cursor : undefined});
      fetchData();
    } else {
      fetchData();
    }
  };

  const onActionTaken = (itemIds: string[], data: IssueUpdateData) => {
    if (realtimeActive) {
      return;
    }

    const groupItems = itemIds.map(id => GroupStore.get(id)).filter(defined);

    if ('status' in data) {
      if (data.status === 'resolved') {
        onIssueAction({
          itemIds,
          actionType: 'Resolved',
          shouldRemove:
            query.includes('is:unresolved') ||
            query.includes('is:ignored') ||
            isForReviewQuery(query),
          undo: () =>
            undoAction({
              data: {status: GroupStatus.UNRESOLVED, statusDetails: {}},
              groupItems,
            }),
        });
        return;
      }

      if (data.status === 'ignored') {
        onIssueAction({
          itemIds,
          actionType: 'Archived',
          shouldRemove: query.includes('is:unresolved') || isForReviewQuery(query),
          undo: () =>
            undoAction({
              data: {status: GroupStatus.UNRESOLVED, statusDetails: {}},
              groupItems,
            }),
        });
        return;
      }
    }

    if ('inbox' in data && data.inbox === false) {
      onIssueAction({
        itemIds,
        actionType: 'Reviewed',
        shouldRemove: isForReviewQuery(query),
      });
      return;
    }

    if ('priority' in data && typeof data.priority === 'string') {
      const priorityValues = parseIssuePrioritySearch(query);
      const priority = data.priority.toLowerCase() as PriorityLevel;

      onIssueAction({
        itemIds,
        actionType: 'Reprioritized',
        shouldRemove: !priorityValues.has(priority),
      });
      return;
    }
  };

  const onDelete = () => {
    actionTakenRef.current = true;
    fetchData();
  };

  const paginationAnalyticsEvent = (direction: string) => {
    trackAnalytics('issues_stream.paginate', {
      organization,
      direction,
    });
  };

  const modifiedQueryCount = Math.max(queryCount, 0);

  const displayReprocessingActions = query === Query.REPROCESSING;

  const {numPreviousIssues, numIssuesOnPage} = getPageCounts();

  return (
    <Layout.Page>
      <IssueViewsHeader
        selectedProjectIds={selection.projects}
        title={title}
        description={titleDescription}
        realtimeActive={realtimeActive}
        onRealtimeChange={onRealtimeChange}
        headerActions={headerActions}
      />
      <StyledBody>
        <StyledMain>
          <IssuesDataConsentBanner source="issues" />
          <IssueListFilters
            query={query}
            sort={sort}
            onSortChange={onSortChange}
            onSearch={onSearch}
          />
          <IssueListTable
            selection={selection}
            query={query}
            queryCount={modifiedQueryCount}
            onSelectStatsPeriod={onSelectStatsPeriod}
            onActionTaken={onActionTaken}
            onDelete={onDelete}
            statsPeriod={getGroupStatsPeriod()}
            groupIds={groupIds}
            allResultsVisible={allResultsVisible()}
            displayReprocessingActions={displayReprocessingActions}
            memberList={memberList}
            selectedProjectIds={selection.projects}
            issuesLoading={issuesLoading}
            statsLoading={statsLoading}
            error={error}
            refetchGroups={fetchData}
            paginationCaption={
              !issuesLoading && modifiedQueryCount > 0
                ? tct('[start]-[end] of [total]', {
                    start: numPreviousIssues + 1,
                    end: numPreviousIssues + numIssuesOnPage,
                    total: (
                      <QueryCount
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
            onCursor={onCursorChange}
            paginationAnalyticsEvent={paginationAnalyticsEvent}
            issuesSuccessfullyLoaded={issuesSuccessfullyLoaded}
            pageSize={MAX_ITEMS}
            onSortChange={onSortChange}
            sort={sort}
          />
        </StyledMain>
      </StyledBody>
    </Layout.Page>
  );
}

export default Sentry.withProfiler(IssueListOverview);

const StyledBody = styled('div')`
  background-color: ${p => p.theme.tokens.background.primary};
  flex: 1;
`;

const StyledMain = styled('section')`
  grid-area: content;
  padding: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: ${space(3)} ${space(4)};
  }
`;
