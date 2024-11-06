export enum Tab {
  DETAILS = 'details',
  ACTIVITY = 'activity',
  USER_FEEDBACK = 'user-feedback',
  ATTACHMENTS = 'attachments',
  TAGS = 'tags',
  EVENTS = 'events',
  MERGED = 'merged',
  SIMILAR_ISSUES = 'similar-issues',
  REPLAYS = 'Replays',
}

export const TabPaths: Record<Tab, string> = {
  [Tab.DETAILS]: '',
  [Tab.ACTIVITY]: 'activity/',
  [Tab.USER_FEEDBACK]: 'feedback/',
  [Tab.ATTACHMENTS]: 'attachments/',
  [Tab.TAGS]: 'tags/',
  [Tab.EVENTS]: 'events/',
  [Tab.MERGED]: 'merged/',
  [Tab.SIMILAR_ISSUES]: 'similar/',
  [Tab.REPLAYS]: 'replays/',
};

export const tabComponentMap: Record<Tab, () => Promise<any>> = {
  [Tab.DETAILS]: () =>
    import('sentry/views/issueDetails/groupEventDetails/groupEventDetails'),
  [Tab.REPLAYS]: () => import('sentry/views/issueDetails/groupReplays'),
  [Tab.ACTIVITY]: () => import('sentry/views/issueDetails/groupActivity'),
  [Tab.EVENTS]: () => import('sentry/views/issueDetails/groupEvents'),
  [Tab.TAGS]: () => import('sentry/views/issueDetails/groupTags/groupTagsTab'),
  [Tab.USER_FEEDBACK]: () => import('sentry/views/issueDetails/groupUserFeedback'),
  [Tab.ATTACHMENTS]: () => import('sentry/views/issueDetails/groupEventAttachments'),
  [Tab.SIMILAR_ISSUES]: () =>
    import('sentry/views/issueDetails/groupSimilarIssues/groupSimilarIssuesTab'),
  [Tab.MERGED]: () => import('sentry/views/issueDetails/groupMerged/groupMergedTab'),
};

/**
 * Tag Details is a sub route of Tab.Tags, but exported here to keep them consistent
 */
export const tagDetailsRoute = () =>
  import('sentry/views/issueDetails/groupTags/groupTagsTab');
