/**
 * Basic types that are required to build types in other type modules.
 *
 * Before a type is put here it should be required in multiple other types.
 * or used in multiple views.
 */
import type {getInterval} from 'sentry/components/charts/utils';
import type {MenuListItemProps} from 'sentry/components/core/menuListItem';
import type {ALLOWED_SCOPES} from 'sentry/constants';
import type {Organization} from 'sentry/types/organization';

/**
 * Visual representation of a project/team/organization/user
 */
export type Avatar = {
  avatarType: 'letter_avatar' | 'upload' | 'gravatar' | 'default';
  avatarUuid: string | null;
  avatarUrl?: string | null;
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

export type Scope = (typeof ALLOWED_SCOPES)[number];

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
  label: string | number | React.ReactElement,
];

export type Choices = Choice[];

/**
 * These are used in billing, stats, and other places to consistently refer to categories.
 *
 * These should always be in plural camelCase form.
 */
export enum DataCategory {
  ERRORS = 'errors',
  TRANSACTIONS = 'transactions',
  TRANSACTIONS_PROCESSED = 'transactionsProcessed',
  TRANSACTIONS_INDEXED = 'transactionsIndexed',
  ATTACHMENTS = 'attachments',
  PROFILES = 'profiles',
  PROFILES_INDEXED = 'profilesIndexed',
  REPLAYS = 'replays',
  MONITOR = 'monitors',
  MONITOR_SEATS = 'monitorSeats',
  PROFILE_DURATION = 'profileDuration',
  PROFILE_DURATION_UI = 'profileDurationUI',
  SPANS = 'spans',
  SPANS_INDEXED = 'spansIndexed',
  PROFILE_CHUNKS = 'profileChunks',
  PROFILE_CHUNKS_UI = 'profileChunksUI',
  UPTIME = 'uptime',
  LOG_ITEM = 'logItems',
  LOG_BYTE = 'logBytes',
  SEER_AUTOFIX = 'seerAutofix',
  SEER_SCANNER = 'seerScanner',
  SEER_USER = 'seerUsers',
  PREVENT_USER = 'preventUsers',
  PREVENT_REVIEW = 'preventReviews',
  USER_REPORT_V2 = 'feedback',
  TRACE_METRICS = 'traceMetrics',
}

/**
 * https://github.com/getsentry/relay/blob/master/relay-base-schema/src/data_category.rs
 * Matches the backend singular backend enum directly.
 * For display variations, refer to `DATA_CATEGORY_INFO` rather than manipulating these strings
 */
export enum DataCategoryExact {
  ERROR = 'error',
  TRANSACTION = 'transaction',
  ATTACHMENT = 'attachment',
  PROFILE = 'profile',
  PROFILE_INDEXED = 'profile_indexed',
  REPLAY = 'replay',
  TRANSACTION_PROCESSED = 'transaction_processed',
  TRANSACTION_INDEXED = 'transaction_indexed',
  MONITOR = 'monitor',
  MONITOR_SEAT = 'monitor_seat',
  PROFILE_DURATION = 'profile_duration',
  PROFILE_DURATION_UI = 'profile_duration_ui',
  PROFILE_CHUNK = 'profile_chunk',
  PROFILE_CHUNK_UI = 'profile_chunk_ui',
  SPAN = 'span',
  SPAN_INDEXED = 'span_indexed',
  UPTIME = 'uptime',
  LOG_ITEM = 'log_item',
  LOG_BYTE = 'log_byte',
  SEER_AUTOFIX = 'seer_autofix',
  SEER_SCANNER = 'seer_scanner',
  SEER_USER = 'seer_user',
  USER_REPORT_V2 = 'feedback',
  TRACE_METRIC = 'trace_metric',
}

/**
 * Unit type for data category formatting.
 * - 'bytes': Categories measured in bytes (e.g., attachments, logs)
 * - 'durationHours': Categories measured in hours (e.g., continuous profiling)
 * - 'count': Categories measured as simple counts (e.g., errors, transactions)
 */
type DataCategoryUnitType = 'bytes' | 'durationHours' | 'count';

/**
 * Formatting configuration for data categories.
 * This centralizes category-specific formatting logic that was previously
 * scattered across helper functions like isByteCategory() and isContinuousProfiling().
 */
interface DataCategoryFormattingInfo {
  /**
   * BigNum unit type for formatting large numbers.
   * 0 = numbers (standard numeric formatting)
   * 1 = kiloBytes (byte-based formatting with KB/MB/GB suffixes)
   */
  bigNumUnit: 0 | 1;
  /**
   * Formatting options for price display.
   * minIntegerDigits: minimum integer digits (bytes use 2, counts use 5)
   * maxIntegerDigits: maximum integer digits (bytes use 2, counts use 7)
   */
  priceFormatting: {
    maxIntegerDigits: number;
    minIntegerDigits: number;
  };
  /**
   * Whether to use abbreviated formatting for projected values.
   * Most categories use true, but ATTACHMENTS uses false for full precision.
   */
  projectedAbbreviated: boolean;
  /**
   * Multiplier to convert reserved/prepaid units to raw values.
   * - bytes: GIGABYTE (10^9) - reserved is in GB, raw is in bytes
   * - durationHours: MILLISECONDS_IN_HOUR (3,600,000) - reserved is in hours, raw is in ms
   * - count: 1 - no conversion needed
   */
  reservedMultiplier: number;
  /**
   * The unit type for this category, determining how values are formatted and displayed.
   */
  unitType: DataCategoryUnitType;
}

export interface DataCategoryInfo {
  displayName: string;
  formatting: DataCategoryFormattingInfo;
  isBilledCategory: boolean;
  name: DataCategoryExact;
  plural: DataCategory;
  productName: string;
  singular: string; // singular form of `plural`
  statsInfo: {
    showExternalStats: boolean;
    showInternalStats: boolean;
    yAxisMinInterval: number;
  };
  titleName: string;
  uid: number;
  docsUrl?: string;
  getProductLink?: (organization: Organization) => string;
}

export enum Outcome {
  ACCEPTED = 'accepted',
  FILTERED = 'filtered',
  INVALID = 'invalid',
  ABUSE = 'abuse',
  RATE_LIMITED = 'rate_limited',
  CLIENT_DISCARD = 'client_discard',
  CARDINALITY_LIMITED = 'cardinality_limited',
  DROPPED = 'dropped', // this is not a real outcome coming from the server
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
    end: DateString | null;
    period: string | null;
    start: DateString | null;
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

type EmptyState = {type: 'empty'};

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
  | EmptyState
  | InitialState
  | LoadingState
  | ResolvedState<T>
  | ErroredState;
