import type {Aggregation} from 'sentry/utils/discover/fields';
import {AggregationKey} from 'sentry/utils/fields';

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
  EVENTS = 'events',
  USERS = 'users',
  LIFETIME_EVENTS = 'lifetimeEvents',
  LIFETIME_USERS = 'lifetimeUsers',
  PROJECT = 'project',
  LINKS = 'links',
  NEW_ISSUES = 'new_issues',
  RESOLVED_ISSUES = 'resolved_issues',
}

export const ISSUE_TABLE_FIELDS: Readonly<Partial<Record<FieldKey, ColumnType>>> = {
  [FieldKey.ASSIGNEE]: 'string',
  [FieldKey.TITLE]: 'string',
  [FieldKey.ISSUE]: 'string',
  [FieldKey.LEVEL]: 'string',
  [FieldKey.STATUS]: 'string',
  [FieldKey.PLATFORM]: 'string',
  [FieldKey.IS_BOOKMARKED]: 'boolean',
  [FieldKey.IS_SUBSCRIBED]: 'boolean',
  [FieldKey.IS_HANDLED]: 'boolean',
  [FieldKey.LAST_SEEN]: 'date',
  [FieldKey.FIRST_SEEN]: 'date',
  [FieldKey.EVENTS]: 'string',
  [FieldKey.USERS]: 'string',
  [FieldKey.LIFETIME_EVENTS]: 'string',
  [FieldKey.LIFETIME_USERS]: 'string',
  [FieldKey.PROJECT]: 'string',
  [FieldKey.LINKS]: 'string',
};

export const ISSUE_SERIES_FIELDS: Readonly<Partial<Record<FieldKey, ColumnType>>> = {
  [FieldKey.NEW_ISSUES]: 'integer',
  [FieldKey.RESOLVED_ISSUES]: 'integer',
};

export const ISSUE_FIELD_TO_HEADER_MAP = {
  [FieldKey.LIFETIME_EVENTS]: 'Lifetime Events',
  [FieldKey.LIFETIME_USERS]: 'Lifetime Users',
};

// issues-timeseries endpoint only supports count(new_issues) and count(resolved_issues)
export const ISSUE_AGGREGATIONS: Readonly<Partial<Record<AggregationKey, Aggregation>>> =
  {
    [AggregationKey.COUNT]: {
      isSortable: true,
      outputType: null,
      parameters: [
        {
          kind: 'column',
          columnTypes: ['integer'],
          defaultValue: FieldKey.NEW_ISSUES,
          required: true,
        },
      ],
    },
  };
