/**
 * Basic types that are required to build types in other type modules.
 *
 * Before a type is put here it should be required in multiple other types.
 * or used in multiple views.
 */
import {getInterval} from 'sentry/components/charts/utils';
import {API_ACCESS_SCOPES, DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';

/**
 * Visual representation of a project/team/organization/user
 */
export type Avatar = {
  avatarUuid: string | null;
  avatarType: 'letter_avatar' | 'upload' | 'gravatar' | 'background' | 'default';
  color?: boolean;
};

export type ObjectStatus =
  | 'active'
  | 'disabled'
  | 'pending_deletion'
  | 'deletion_in_progress';

export type Actor = {
  type: 'user' | 'team';
  id: string;
  name: string;
  email?: string;
};

export type Scope = typeof API_ACCESS_SCOPES[number];

export type DateString = Date | string | null;

/**
 * Simple timeseries data used in groups, projects and release health.
 */
export type TimeseriesValue = [timestamp: number, value: number];

// taken from https://stackoverflow.com/questions/46634876/how-can-i-change-a-readonly-property-in-typescript
export type Writable<T> = {-readonly [K in keyof T]: T[K]};

/**
 * The option format used by react-select based components
 */
export type SelectValue<T> = {
  label: string | number | React.ReactElement;
  value: T;
  disabled?: boolean;
  tooltip?: string;
};

/**
 * The 'other' option format used by checkboxes, radios and more.
 */
export type Choices = [
  value: string | number,
  label: string | number | React.ReactElement
][];

// https://github.com/getsentry/relay/blob/master/relay-common/src/constants.rs
// Note: the value of the enum on the frontend is plural,
// but the value of the enum on the backend is singular
export enum DataCategory {
  DEFAULT = 'default',
  ERRORS = 'errors',
  TRANSACTIONS = 'transactions',
  ATTACHMENTS = 'attachments',
}

export type EventType = 'error' | 'transaction' | 'attachment';

export const DataCategoryName = {
  [DataCategory.ERRORS]: 'Errors',
  [DataCategory.TRANSACTIONS]: 'Transactions',
  [DataCategory.ATTACHMENTS]: 'Attachments',
};

export type RelativePeriod = keyof typeof DEFAULT_RELATIVE_PERIODS;
export type IntervalPeriod = ReturnType<typeof getInterval>;

/**
 * Represents a pinned page filter sentinel value
 */
export type PinnedPageFilter = 'projects' | 'environments' | 'datetime';

export type PageFilters = {
  /**
   * Currently selected Project IDs
   */
  projects: number[];
  /**
   * Currently selected environment names
   */
  environments: string[];
  /**
   * Currently selected time filter
   */
  datetime: {
    start: DateString;
    end: DateString;
    period: RelativePeriod | string;
    utc: boolean | null;
  };
};
