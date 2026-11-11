import type {Location, LocationDescriptorObject} from 'history';
import {
  createLoader,
  createParser,
  parseAsStringEnum,
  parseAsStringLiteral,
  useQueryStates,
  type inferParserType,
  type ParserMap,
} from 'nuqs';

import type {Organization} from 'sentry/types/organization';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import * as qs from 'sentry/utils/url/qs';
import {parseAsScalar} from 'sentry/views/explore/queryParams/parsers';

import {DrawerTab} from './groupDistributions/types';
import {Tab, TabPaths} from './types';

/**
 * Drawers that open on top of the current page tab. The values are their old
 * path segments, so legacy paths map straight onto the `drawer` param.
 */
export enum IssueDetailsDrawer {
  ACTIVITY = 'activity',
  DISTRIBUTIONS = 'distributions',
  SIMILAR_ISSUES = 'similar',
  MERGED = 'merged',
}

/**
 * The `Tab` enum still lists the drawers for the route-based code. They are
 * not page tabs.
 */
export type IssueDetailsPageTab = Exclude<
  Tab,
  Tab.ACTIVITY | Tab.DISTRIBUTIONS | Tab.SIMILAR_ISSUES | Tab.MERGED
>;

/**
 * The URL value of a page tab is its old path segment, e.g. `replays` or
 * `feedback`, so legacy paths map straight onto the `tab` param.
 */
function getPageTabSlug(tab: Tab): string {
  return TabPaths[tab].replace(/\/$/, '');
}

const DRAWER_SLUGS = new Set<string>(Object.values(IssueDetailsDrawer));

export function isIssueDetailsPageTab(tab: Tab): tab is IssueDetailsPageTab {
  return !DRAWER_SLUGS.has(getPageTabSlug(tab));
}

/**
 * The drawer a legacy issue details route opens, e.g. `activity/`.
 */
export function getDrawerForLegacyRoute(tab: Tab): IssueDetailsDrawer | null {
  const slug = getPageTabSlug(tab);
  return DRAWER_SLUGS.has(slug) ? (slug as IssueDetailsDrawer) : null;
}

const PAGE_TABS = Object.values(Tab).filter(isIssueDetailsPageTab);

const PAGE_TABS_BY_SLUG = new Map<string, IssueDetailsPageTab>(
  PAGE_TABS.filter(tab => tab !== Tab.DETAILS).map(tab => [getPageTabSlug(tab), tab])
);

const parseAsPageTab = createParser<IssueDetailsPageTab>({
  parse: value => PAGE_TABS_BY_SLUG.get(value) ?? null,
  serialize: getPageTabSlug,
});

/**
 * The issue details location. Write it with `makeIssueDetailsLocation`.
 *
 * - `tab`: the page tab. Missing means the details tab.
 * - `eventId`: the selected event, which may be `latest`, `oldest` or
 *   `recommended`. Missing means the default event.
 * - `drawer`: the drawer open on top of the page tab.
 *
 * Page tabs and drawers own more params, listed in `ISSUE_DETAILS_TAB_PARAMS`
 * and `ISSUE_DETAILS_DRAWER_PARAMS`.
 */
const ISSUE_DETAILS_QUERY_PARSERS = {
  tab: parseAsPageTab.withDefault(Tab.DETAILS),
  eventId: parseAsScalar,
  drawer: parseAsStringEnum(Object.values(IssueDetailsDrawer)),
};

type IssueDetailsQueryParams = inferParserType<typeof ISSUE_DETAILS_QUERY_PARSERS>;

const loadIssueDetailsQuery = createLoader(ISSUE_DETAILS_QUERY_PARSERS);

/**
 * Reads the issue details params from a location's query.
 */
export function loadIssueDetailsQueryParams(
  query: Location['query'] | Record<string, string | string[] | null | undefined>
): IssueDetailsQueryParams {
  return loadIssueDetailsQuery(qs.stringify(query));
}

/**
 * The query params each page tab owns, such as its pagination cursor. They
 * carry over only while that page tab is open, so a cursor from the events
 * list doesn't page the next tab. Adding a page tab means adding an entry.
 */
const ISSUE_DETAILS_TAB_PARAMS = {
  [Tab.DETAILS]: {},
  [Tab.EVENTS]: {cursor: parseAsScalar},
  [Tab.REPLAYS]: {},
  [Tab.OPEN_PERIODS]: {cursor: parseAsScalar},
  [Tab.CHECK_INS]: {cursor: parseAsScalar},
  [Tab.UPTIME_CHECKS]: {cursor: parseAsScalar},
  [Tab.AUTOFIX]: {},
  [Tab.USER_FEEDBACK]: {cursor: parseAsScalar},
  [Tab.ATTACHMENTS]: {cursor: parseAsScalar, attachmentFilter: parseAsScalar},
} satisfies Record<IssueDetailsPageTab, ParserMap>;

/**
 * The query params each drawer owns. They carry over only while that drawer is
 * open. Adding a drawer means adding an entry.
 */
export const ISSUE_DETAILS_DRAWER_PARAMS = {
  [IssueDetailsDrawer.ACTIVITY]: {filter: parseAsStringLiteral(['comments'])},
  [IssueDetailsDrawer.DISTRIBUTIONS]: {
    /** The tag or feature flag key to show. Missing means the list. */
    tagKey: parseAsScalar,
    /** Whether to list tags or feature flags. */
    type: parseAsStringLiteral(Object.values(DrawerTab)),
    tagDrawerCursor: parseAsScalar,
    tagDrawerSort: parseAsScalar,
    flagDrawerCursor: parseAsScalar,
  },
  [IssueDetailsDrawer.SIMILAR_ISSUES]: {},
  [IssueDetailsDrawer.MERGED]: {mergedCursor: parseAsScalar},
} satisfies Record<IssueDetailsDrawer, ParserMap>;

type ParamValues<Parsers> = Parsers extends ParserMap
  ? keyof Parsers extends never
    ? Record<string, never>
    : Partial<inferParserType<Parsers>>
  : never;

/**
 * The params a page tab owns. Set one to `null` to remove it.
 */
export type IssueDetailsTabParams<T extends IssueDetailsPageTab> = ParamValues<
  (typeof ISSUE_DETAILS_TAB_PARAMS)[T]
>;

/**
 * The params a drawer owns. Set one to `null` to remove it.
 */
export type IssueDetailsDrawerParams<D extends IssueDetailsDrawer> = ParamValues<
  (typeof ISSUE_DETAILS_DRAWER_PARAMS)[D]
>;

/**
 * Reads and writes the params of a page tab, e.g. its pagination cursor.
 */
export function useIssueDetailsTabParams<T extends IssueDetailsPageTab>(tab: T) {
  return useQueryStates(ISSUE_DETAILS_TAB_PARAMS[tab]);
}

/**
 * Reads and writes the params of a drawer, e.g. the distributions drawer's
 * tag key.
 */
export function useIssueDetailsDrawerParams<D extends IssueDetailsDrawer>(drawer: D) {
  return useQueryStates(ISSUE_DETAILS_DRAWER_PARAMS[drawer]);
}

/**
 * Reads a drawer's params from a location's query.
 */
export function loadIssueDetailsDrawerParams<D extends IssueDetailsDrawer>(
  drawer: D,
  query: Location['query'] | Record<string, string | string[] | null | undefined>
) {
  return createLoader(ISSUE_DETAILS_DRAWER_PARAMS[drawer])(qs.stringify(query));
}

const SCOPED_QUERY_PARAMS = new Set<string>(
  [
    ...Object.values(ISSUE_DETAILS_TAB_PARAMS),
    ...Object.values(ISSUE_DETAILS_DRAWER_PARAMS),
  ].flatMap(parsers => Object.keys(parsers))
);

function applyParams(
  query: Record<string, unknown>,
  parsers: ParserMap,
  values: Record<string, unknown> | undefined
) {
  for (const [key, value] of Object.entries(values ?? {})) {
    if (value === undefined || !(key in parsers)) {
      continue;
    }
    if (value === null) {
      delete query[key];
      continue;
    }
    query[key] = parsers[key]!.serialize(value);
  }
}

interface IssueDetailsLocationOptions<
  T extends IssueDetailsPageTab = never,
  D extends IssueDetailsDrawer = never,
> {
  groupId: string;
  organization: Pick<Organization, 'slug'>;
  /** The drawer to open on top of the page tab. */
  drawer?: D | null;
  /** Params for the drawer, e.g. the distributions drawer's `tagKey`. */
  drawerParams?: IssueDetailsDrawerParams<D>;
  /** The event to select. Omit for the default event. */
  eventId?: string | null;
  /**
   * The query to carry over, usually the current `location.query`. The page
   * tab, event and drawer are never copied from it, so pass them explicitly to
   * keep them.
   */
  query?: Record<string, unknown>;
  /** The page tab. Defaults to the details tab. */
  tab?: T;
  /** Params for the page tab, e.g. the attachments tab's `attachmentFilter`. */
  tabParams?: IssueDetailsTabParams<T>;
}

export interface IssueDetailsLocation extends LocationDescriptorObject {
  pathname: string;
  query: Location['query'];
}

/**
 * Single source of truth for links within issue details.
 *
 * Shared params like the page filters and the event search carry over from
 * `query`. Params owned by a page tab or drawer only carry over when the
 * destination has the same page tab or drawer. `tabParams` and `drawerParams`
 * are set on top.
 */
export function makeIssueDetailsLocation<
  T extends IssueDetailsPageTab = never,
  D extends IssueDetailsDrawer = never,
>({
  organization,
  groupId,
  tab,
  tabParams,
  eventId,
  drawer,
  drawerParams,
  query,
}: IssueDetailsLocationOptions<T, D>): IssueDetailsLocation {
  const pageTab: IssueDetailsPageTab = tab ?? Tab.DETAILS;
  const tabParsers: ParserMap = ISSUE_DETAILS_TAB_PARAMS[pageTab];
  const drawerParsers: ParserMap = drawer ? ISSUE_DETAILS_DRAWER_PARAMS[drawer] : {};
  const ownedParams = new Set([
    ...Object.keys(tabParsers),
    ...Object.keys(drawerParsers),
  ]);

  const nextQuery: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query ?? {})) {
    if (key in ISSUE_DETAILS_QUERY_PARSERS) {
      continue;
    }
    if (SCOPED_QUERY_PARAMS.has(key) && !ownedParams.has(key)) {
      continue;
    }
    nextQuery[key] = value;
  }

  if (pageTab !== Tab.DETAILS) {
    nextQuery.tab = ISSUE_DETAILS_QUERY_PARSERS.tab.serialize(pageTab);
  }
  if (eventId) {
    nextQuery.eventId = eventId;
  }
  if (drawer) {
    nextQuery.drawer = drawer;
  }
  applyParams(nextQuery, tabParsers, tabParams);
  applyParams(nextQuery, drawerParsers, drawerParams);

  return {
    pathname: normalizeUrl(`/organizations/${organization.slug}/issues/${groupId}/`),
    query: nextQuery as Location['query'],
  };
}

/**
 * `makeIssueDetailsLocation` as a path with its query string, for links that
 * need a string.
 */
export function makeIssueDetailsPath<
  T extends IssueDetailsPageTab = never,
  D extends IssueDetailsDrawer = never,
>(options: IssueDetailsLocationOptions<T, D>): string {
  const {pathname, query} = makeIssueDetailsLocation(options);
  const search = qs.stringify(query);
  return search ? `${pathname}?${search}` : pathname;
}
