import {Tab} from 'sentry/views/issueDetails/types';

export const ERROR_TYPES = {
  GROUP_NOT_FOUND: 'GROUP_NOT_FOUND',
  MISSING_MEMBERSHIP: 'MISSING_MEMBERSHIP',
} as const;

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
