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
  CULPRIT = 'culprit',
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
  [FieldKey.CULPRIT]: 'string',
};
