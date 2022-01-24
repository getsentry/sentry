export type ColumnType =
  | 'boolean'
  | 'date'
  | 'duration'
  | 'integer'
  | 'number'
  | 'percentage'
  | 'string';

export enum FieldKey {
  ASSIGNEE = 'assignee',
  TITLE = 'title',
  ISSUE = 'issue',
  LEVEL = 'level',
  STATUS = 'status',
  PLATFORM = 'platform',
  IS_BOOKMARKED = 'isBookmarked',
  IS_SUBSCRIBED = 'isSubscribed',
  IS_HANDLED = 'isHandled',
  LAST_SEEN = 'lastSeen',
  FIRST_SEEN = 'firstSeen',
  COUNT = 'events',
  USER_COUNT = 'users',
  LIFETIME_COUNT = 'lifetimeEvents',
  LIFETIME_USER_COUNT = 'lifetimeUsers',
}

export const ISSUE_FIELDS: Readonly<Record<FieldKey, ColumnType>> = {
  [FieldKey.ASSIGNEE]: 'string',
  [FieldKey.TITLE]: 'string',
  [FieldKey.ISSUE]: 'string',
  [FieldKey.LEVEL]: 'string',
  [FieldKey.STATUS]: 'string',
  [FieldKey.PLATFORM]: 'string',
  [FieldKey.IS_BOOKMARKED]: 'boolean',
  [FieldKey.IS_SUBSCRIBED]: 'boolean',
  [FieldKey.IS_HANDLED]: 'boolean',
  [FieldKey.LAST_SEEN]: 'string',
  [FieldKey.FIRST_SEEN]: 'string',
  [FieldKey.COUNT]: 'string',
  [FieldKey.USER_COUNT]: 'string',
  [FieldKey.LIFETIME_COUNT]: 'string',
  [FieldKey.LIFETIME_USER_COUNT]: 'string',
};
