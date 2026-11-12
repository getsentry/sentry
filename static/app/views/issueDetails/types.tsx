/**
 * Issue details page tabs. Drawers open on top of a page tab and are listed in
 * `IssueDetailsDrawer`.
 */
export enum Tab {
  DETAILS = 'details',
  USER_FEEDBACK = 'user-feedback',
  ATTACHMENTS = 'attachments',
  EVENTS = 'events',
  REPLAYS = 'Replays',
  OPEN_PERIODS = 'open-periods',
  CHECK_INS = 'check-ins',
  UPTIME_CHECKS = 'uptime-checks',
  AUTOFIX = 'autofix',
}

/**
 * The path segment each page tab had before issue details moved its tab into
 * the `tab` query param. The query param uses the same values.
 */
export const TabPaths: Record<Tab, string> = {
  [Tab.DETAILS]: '',
  [Tab.USER_FEEDBACK]: 'feedback/',
  [Tab.ATTACHMENTS]: 'attachments/',
  [Tab.EVENTS]: 'events/',
  [Tab.REPLAYS]: 'replays/',
  [Tab.OPEN_PERIODS]: 'open-periods/',
  [Tab.CHECK_INS]: 'check-ins/',
  [Tab.UPTIME_CHECKS]: 'uptime-checks/',
  [Tab.AUTOFIX]: 'autofix/',
};
