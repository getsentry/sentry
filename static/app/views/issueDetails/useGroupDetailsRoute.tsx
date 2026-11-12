import {useMemo} from 'react';

import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {useGroupId} from './groupIdContext';
import {
  loadIssueDetailsQueryParams,
  makeIssueDetailsLocation,
  type IssueDetailsDrawer,
  type IssueDetailsDrawerParams,
  type IssueDetailsTabParams,
} from './issueDetailsQueryParams';
import {Tab} from './types';

export interface IssueDetailsParams {
  /**
   * The page tab. Opening a drawer leaves it as is.
   */
  currentTab: Tab;
  drawer: IssueDetailsDrawer | null;
  /**
   * The selected event, which may be `latest`, `oldest` or `recommended`.
   */
  eventId: string | undefined;
}

function resolveIssueDetailsParams({
  groupId,
  query,
}: {
  groupId: string | undefined;
  query: ReturnType<typeof useLocation>['query'];
}): IssueDetailsParams {
  // Issue details components also render on other pages, such as the
  // feedback list, where these params mean something else.
  if (!groupId) {
    return {currentTab: Tab.DETAILS, drawer: null, eventId: undefined};
  }

  const {tab, drawer, eventId} = loadIssueDetailsQueryParams(query);
  return {currentTab: tab, drawer, eventId: eventId ?? undefined};
}

/**
 * The page tab, drawer and event of the current issue details location. Read a
 * page tab's or drawer's own params with `useIssueDetailsTabParams` or
 * `useIssueDetailsDrawerParams`.
 *
 * This needs no `GroupIdProvider`, so it also works in drawers, the sidebar
 * and other places mounted beside the group route.
 */
export function useIssueDetailsParams(): IssueDetailsParams {
  const {groupId} = useParams<{groupId?: string}>();
  const {query} = useLocation();

  return useMemo(() => resolveIssueDetailsParams({groupId, query}), [groupId, query]);
}

/**
 * The page tab on its own, for components that only need to know where they
 * are.
 */
export function useCurrentTab(): Tab {
  return useIssueDetailsParams().currentTab;
}

interface IssueDetailsLinkOptions {
  /** Shared params to set on top of the current query, e.g. `referrer`. */
  query?: Record<string, unknown>;
}

/**
 * Builds links within the current issue. Each link starts from the current
 * page tab, event, drawer and query, and changes one of them:
 *
 * - `event` selects an event and keeps the page tab and drawer.
 * - `tab` switches the page tab and keeps the event and drawer.
 * - `drawer` opens a drawer over the current page tab and event.
 * - `closeDrawer` drops the drawer and its params.
 *
 * Params owned by a page tab or drawer carry over while it stays open, and
 * `params` are set on top.
 *
 * Pass `groupId` when rendering outside a `GroupIdProvider`.
 */
export function useIssueDetailsLinks({groupId: groupIdProp}: {groupId?: string} = {}) {
  const organization = useOrganization();
  const contextGroupId = useGroupId({allowNull: true});
  const groupId = groupIdProp ?? contextGroupId;
  if (!groupId) {
    throw new Error('useIssueDetailsLinks needs a groupId or a GroupIdProvider');
  }
  const {query} = useLocation();
  const {currentTab, drawer, eventId} = useIssueDetailsParams();

  return useMemo(() => {
    const current = {organization, groupId, tab: currentTab, eventId, drawer};
    const withQuery = (options?: IssueDetailsLinkOptions) =>
      options?.query ? {...query, ...options.query} : query;

    return {
      event: (nextEventId: string | null, options?: IssueDetailsLinkOptions) =>
        makeIssueDetailsLocation({
          ...current,
          eventId: nextEventId,
          query: withQuery(options),
        }),
      tab: <T extends Tab>(
        tab: T,
        params?: IssueDetailsTabParams<T>,
        options?: IssueDetailsLinkOptions
      ) =>
        makeIssueDetailsLocation({
          ...current,
          tab,
          tabParams: params,
          query: withQuery(options),
        }),
      drawer: <D extends IssueDetailsDrawer>(
        nextDrawer: D,
        params?: IssueDetailsDrawerParams<D>,
        options?: IssueDetailsLinkOptions
      ) =>
        makeIssueDetailsLocation({
          ...current,
          drawer: nextDrawer,
          drawerParams: params,
          query: withQuery(options),
        }),
      closeDrawer: (options?: IssueDetailsLinkOptions) =>
        makeIssueDetailsLocation({...current, drawer: null, query: withQuery(options)}),
    };
  }, [organization, groupId, query, currentTab, eventId, drawer]);
}

/**
 * The drawer a location opens, for checks like a drawer's
 * `shouldCloseOnLocationChange` that only get the next location.
 */
export function getIssueDetailsDrawer(location: {
  query: Record<string, string | string[] | null | undefined>;
}): IssueDetailsDrawer | null {
  return loadIssueDetailsQueryParams(location.query).drawer;
}
