/**
 * Basic types that are required to build types in other type modules.
 *
 * Before a type is put here it should be required in multiple other types.
 * or used in multiple views.
 */
import type {getInterval} from 'sentry/components/charts/utils';
import {MenuListItemProps} from 'sentry/components/menuListItem';
import type {API_ACCESS_SCOPES} from 'sentry/constants';

/**
 * Visual representation of a project/team/organization/user
 */
export type Avatar = {
  avatarType: 'letter_avatar' | 'upload' | 'gravatar' | 'background' | 'default';
  avatarUuid: string | null;
  color?: boolean;
};

export type ObjectStatus =
  | 'active'
  | 'disabled'
  | 'pending_deletion'
  | 'deletion_in_progress';

export type Actor = {
  id: string;
  name: string;
  type: 'user' | 'team';
  email?: string;
};

export type Scope = (typeof API_ACCESS_SCOPES)[number];

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
export interface SelectValue<T> extends MenuListItemProps {
  value: T;
  /**
   * In scenarios where you're using a react element as the label react-select
   * will be unable to filter to that label. Use this to specify the plain text of
   * the label.
   */
  textValue?: string;
}

/**
 * The 'other' option format used by checkboxes, radios and more.
 */
export type Choice = [
  value: string | number,
  label: string | number | React.ReactElement
];

export type Choices = Choice[];

/**
 * @deprecated in favour of `DataCategoryExact` and `DATA_CATEGORY_INFO`.
 * This legacy type used plurals which will cause compatibility issues when categories
 * become more complex, e.g. processed transactions, session replays. Instead, access these values
 * with `DATA_CATEGORY_INFO[category].plural`, where category is the `DataCategoryExact` enum value.
 */
export enum DataCategory {
  DEFAULT = 'default',
  ERRORS = 'errors',
  TRANSACTIONS = 'transactions',
  ATTACHMENTS = 'attachments',
  PROFILES = 'profiles',
  REPLAYS = 'replays',
}

/**
 * https://github.com/getsentry/relay/blob/master/relay-common/src/constants.rs
 * Matches the backend singular backend enum directly.
 * For display variations, refer to `DATA_CATEGORY_INFO` rather than manipulating these strings
 */
export enum DataCategoryExact {
  ERROR = 'error',
  TRANSACTION = 'transaction',
  ATTACHMENT = 'attachment',
  PROFILE = 'profile',
  REPLAY = 'replay',
  TRANSACTION_PROCESSED = 'transaction_processed',
  TRANSACTION_INDEXED = 'transaction_indexed',
}

export interface DataCategoryInfo {
  apiName: string;
  displayName: string;
  name: DataCategoryExact;
  plural: string;
  titleName: string;
  uid: number;
}

export type EventType = 'error' | 'transaction' | 'attachment';

export enum Outcome {
  ACCEPTED = 'accepted',
  FILTERED = 'filtered',
  INVALID = 'invalid',
  DROPPED = 'dropped', // this is not a real outcome coming from the server
  RATE_LIMITED = 'rate_limited',
  CLIENT_DISCARD = 'client_discard',
}

export type IntervalPeriod = ReturnType<typeof getInterval>;

/**
 * Represents a pinned page filter sentinel value
 */
export type PinnedPageFilter = 'projects' | 'environments' | 'datetime';

export type PageFilters = {
  /**
   * Currently selected time filter
   */
  datetime: {
    end: DateString;
    period: string | null;
    start: DateString;
    utc: boolean | null;
  };
  /**
   * Currently selected environment names
   */
  environments: string[];
  /**
   * Currently selected Project IDs
   */
  projects: number[];
};

type InitialState = {type: 'initial'};

type LoadingState = {type: 'loading'};

type ResolvedState<T> = {
  data: T;
  type: 'resolved';
};

type ErroredState = {
  error: string;
  type: 'errored';
};

export type RequestState<T> =
  | InitialState
  | LoadingState
  | ResolvedState<T>
  | ErroredState;
