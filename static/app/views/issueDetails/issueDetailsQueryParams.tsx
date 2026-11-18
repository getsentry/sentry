import {parseAsStringLiteral, useQueryStates, type ParserMap} from 'nuqs';

import {parseAsScalar} from 'sentry/views/explore/queryParams/parsers';

import {DrawerTab} from './groupDistributions/types';
import {Tab} from './types';

/**
 * Drawers that open on top of the issue details page.
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
type IssueDetailsPageTab = Exclude<
  Tab,
  Tab.ACTIVITY | Tab.DISTRIBUTIONS | Tab.SIMILAR_ISSUES | Tab.MERGED
>;

/**
 * The query params each page tab owns, such as its pagination cursor. Adding a
 * page tab means adding an entry.
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
 * The query params each drawer owns. Adding a drawer means adding an entry.
 */
export const ISSUE_DETAILS_DRAWER_PARAMS = {
  [IssueDetailsDrawer.ACTIVITY]: {filter: parseAsStringLiteral(['comments'])},
  [IssueDetailsDrawer.DISTRIBUTIONS]: {
    /** Whether to list tags or feature flags. */
    type: parseAsStringLiteral(Object.values(DrawerTab)),
    tagDrawerCursor: parseAsScalar,
    tagDrawerSort: parseAsScalar,
    flagDrawerCursor: parseAsScalar,
  },
  [IssueDetailsDrawer.SIMILAR_ISSUES]: {},
  [IssueDetailsDrawer.MERGED]: {mergedCursor: parseAsScalar},
} satisfies Record<IssueDetailsDrawer, ParserMap>;

/**
 * Reads and writes the params of a page tab, e.g. its pagination cursor.
 */
export function useIssueDetailsTabParams<T extends IssueDetailsPageTab>(tab: T) {
  return useQueryStates(ISSUE_DETAILS_TAB_PARAMS[tab]);
}

/**
 * Reads and writes the params of a drawer, e.g. the distributions drawer's
 * cursor.
 */
export function useIssueDetailsDrawerParams<D extends IssueDetailsDrawer>(drawer: D) {
  return useQueryStates(ISSUE_DETAILS_DRAWER_PARAMS[drawer]);
}
