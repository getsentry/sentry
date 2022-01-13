export type ColumnType =
  | 'boolean'
  | 'date'
  | 'duration'
  | 'integer'
  | 'number'
  | 'percentage'
  | 'string';

enum FieldKey {
  ASSIGNEE = 'assignee',
  TITLE = 'title',
  ISSUE = 'issue',
  LEVEL = 'level',
  STATUS = 'status',
  PLATFORM = 'platform',
  PERMALINK = 'permalink',
  IS_BOOKMARKED = 'isBookmarked',
  IS_SUBSCRIBED = 'isSubscribed',
  IS_HANDLED = 'isHandled',
  LAST_SEEN = 'lastSeen',
  FIRST_SEEN = 'firstSeen',
  EVENT_COUNT = 'eventCount',
  USER_COUNT = 'userCount',
  LIFETIME_EVENT_COUNT = 'lifetimeEventCount',
  LIFETIME_USER_COUNT = 'lifetimeUserCount',
}

export const ISSUE_FIELDS: Readonly<Record<FieldKey, ColumnType>> = {
  [FieldKey.ASSIGNEE]: 'string',
  [FieldKey.TITLE]: 'string',
  [FieldKey.ISSUE]: 'string',
  [FieldKey.LEVEL]: 'string',
  [FieldKey.STATUS]: 'string',
  [FieldKey.PLATFORM]: 'string',
  [FieldKey.PERMALINK]: 'string',
  [FieldKey.IS_BOOKMARKED]: 'boolean',
  [FieldKey.IS_SUBSCRIBED]: 'boolean',
  [FieldKey.IS_HANDLED]: 'boolean',
  [FieldKey.LAST_SEEN]: 'string',
  [FieldKey.FIRST_SEEN]: 'string',
  [FieldKey.EVENT_COUNT]: 'string',
  [FieldKey.USER_COUNT]: 'string',
  [FieldKey.LIFETIME_EVENT_COUNT]: 'string',
  [FieldKey.LIFETIME_USER_COUNT]: 'string',
};
