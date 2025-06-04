export enum Tab {
  DETAILS = 'details',
  ACTIVITY = 'activity',
  USER_FEEDBACK = 'user-feedback',
  ATTACHMENTS = 'attachments',
  DISTRIBUTIONS = 'distributions', // Renamed from TAGS so the route may include feature flags.
  EVENTS = 'events',
  MERGED = 'merged',
  SIMILAR_ISSUES = 'similar-issues',
  REPLAYS = 'Replays',
  OPEN_PERIODS = 'open-periods',
  CHECK_INS = 'check-ins',
  UPTIME_CHECKS = 'uptime-checks',
}

export const TabPaths: Record<Tab, string> = {
  [Tab.DETAILS]: '',
  [Tab.ACTIVITY]: 'activity/',
  [Tab.USER_FEEDBACK]: 'feedback/',
  [Tab.ATTACHMENTS]: 'attachments/',
  [Tab.DISTRIBUTIONS]: 'distributions/',
  [Tab.EVENTS]: 'events/',
  [Tab.MERGED]: 'merged/',
  [Tab.SIMILAR_ISSUES]: 'similar/',
  [Tab.REPLAYS]: 'replays/',
  [Tab.OPEN_PERIODS]: 'open-periods/',
  [Tab.CHECK_INS]: 'check-ins/',
  [Tab.UPTIME_CHECKS]: 'uptime-checks/',
};
