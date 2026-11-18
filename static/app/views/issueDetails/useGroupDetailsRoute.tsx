import {useMemo} from 'react';
import {useMatches, type UIMatch} from 'react-router';

import type {Organization} from 'sentry/types/organization';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {useGroupId} from './groupIdContext';
import {
  getDrawerForLegacyRoute,
  isIssueDetailsPageTab,
  IssueDetailsDrawer,
  loadIssueDetailsDrawerParams,
  loadIssueDetailsQueryParams,
  type IssueDetailsPageTab,
} from './issueDetailsQueryParams';
import {Tab, TabPaths} from './types';

type RouteParams = {eventId?: string; groupId?: string; tagKey?: string};

/**
 * The tab of a path-based issue details route, e.g. `/issues/1/activity/`.
 */
function getLegacyRouteTab({
  matches,
  params,
}: {
  matches: UIMatch[];
  params: RouteParams;
}): Tab {
  const currentMatch = matches[matches.length - 1];
  const currentPath = (currentMatch?.handle as {path?: string} | undefined)?.path;

  // If we're in the tag details page ("/distributions/:tagKey/")
  if (params.tagKey) {
    return Tab.DISTRIBUTIONS;
  }
  return Object.values(Tab).find(tab => currentPath === TabPaths[tab]) ?? Tab.DETAILS;
}

export interface IssueDetailsParams {
  /**
   * The page tab. Opening a drawer leaves it as is.
   */
  currentTab: IssueDetailsPageTab;
  drawer: IssueDetailsDrawer | null;
  /**
   * The selected event, which may be `latest`, `oldest` or `recommended`.
   */
  eventId: string | undefined;
  /**
   * The key shown in the distributions drawer. Also read from the path until
   * the path-based routes redirect.
   */
  tagKey: string | undefined;
}

/**
 * Query params win. Path-based routes are still read until they redirect.
 */
function resolveIssueDetailsParams({
  matches,
  params,
  query,
}: {
  matches: UIMatch[];
  params: RouteParams;
  query: ReturnType<typeof useLocation>['query'];
}): IssueDetailsParams {
  // Issue details components also render on other pages, such as the
  // feedback list, where these params and routes mean something else.
  if (!params.groupId) {
    return {
      currentTab: Tab.DETAILS,
      drawer: null,
      eventId: undefined,
      tagKey: undefined,
    };
  }

  const queryParams = loadIssueDetailsQueryParams(query);
  const routeTab = getLegacyRouteTab({matches, params});
  const routeDrawer = getDrawerForLegacyRoute(routeTab);
  const drawer = queryParams.drawer ?? routeDrawer;

  let currentTab: IssueDetailsPageTab = Tab.DETAILS;
  if (queryParams.tab !== Tab.DETAILS) {
    currentTab = queryParams.tab;
  } else if (isIssueDetailsPageTab(routeTab)) {
    currentTab = routeTab;
  }

  return {
    currentTab,
    drawer,
    eventId: queryParams.eventId ?? params.eventId,
    tagKey:
      drawer === IssueDetailsDrawer.DISTRIBUTIONS
        ? (loadIssueDetailsDrawerParams(IssueDetailsDrawer.DISTRIBUTIONS, query).tagKey ??
          params.tagKey)
        : undefined,
  };
}

/**
 * The page tab, drawer, event and tag key of the current issue details
 * location. Unlike `useGroupDetailsRoute()` this needs no `GroupIdProvider`,
 * so it also works in drawers, the sidebar and other places mounted beside the
 * group route.
 */
export function useIssueDetailsParams(): IssueDetailsParams {
  const params = useParams<RouteParams>();
  const matches = useMatches();
  const {query} = useLocation();
  const {eventId, groupId, tagKey} = params;

  return useMemo(
    () => resolveIssueDetailsParams({matches, params: {eventId, groupId, tagKey}, query}),
    [matches, eventId, groupId, tagKey, query]
  );
}

/**
 * The page tab on its own, for components that only need to know where they
 * are.
 */
export function useCurrentTab(): IssueDetailsPageTab {
  return useIssueDetailsParams().currentTab;
}

const LEGACY_DRAWER_PATH =
  /\/issues\/[^/]+\/(?:events\/[^/]+\/)?(activity|distributions|similar|merged)\//;

/**
 * The drawer a location opens, for checks like a drawer's
 * `shouldCloseOnLocationChange` that only get the next location.
 */
export function getIssueDetailsDrawer(location: {
  pathname: string;
  query: Record<string, string | string[] | null | undefined>;
}): IssueDetailsDrawer | null {
  const {drawer} = loadIssueDetailsQueryParams(location.query);
  if (drawer) {
    return drawer;
  }
  const legacyDrawer = location.pathname.match(LEGACY_DRAWER_PATH)?.[1];
  return legacyDrawer ? (legacyDrawer as IssueDetailsDrawer) : null;
}

function getBaseUrl({
  eventId,
  groupId,
  organization,
}: {
  eventId: string | undefined;
  groupId: string;
  organization: Organization;
}) {
  return normalizeUrl(
    `/organizations/${organization.slug}/issues/${groupId}/${
      eventId ? `events/${eventId}/` : ''
    }`
  );
}

export function useGroupDetailsRoute(): IssueDetailsParams & {baseUrl: string} {
  const organization = useOrganization();
  const groupId = useGroupId();
  const issueDetailsParams = useIssueDetailsParams();
  // Path-based links are built on this until they move to
  // `makeIssueDetailsLocation`, so only a path-based event belongs in it. An
  // event from the query carries over with the query.
  const {eventId: routeEventId} = useParams<RouteParams>();

  return {
    ...issueDetailsParams,
    baseUrl: getBaseUrl({eventId: routeEventId, groupId, organization}),
  };
}
