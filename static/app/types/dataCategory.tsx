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
  USER_REPORT_V2 = 'feedback',
  TRACE_METRICS = 'traceMetrics',
  TRACE_METRIC_BYTE = 'traceMetricBytes',
  SIZE_ANALYSIS = 'sizeAnalyses',
  INSTALLABLE_BUILD = 'installableBuilds',
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
  TRACE_METRIC_BYTE = 'trace_metric_byte',
  SIZE_ANALYSIS = 'size_analysis',
  INSTALLABLE_BUILD = 'installable_build',
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
   * Formatting options for price display (decimal places).
   * minFractionDigits: minimum fraction digits (bytes use 2, counts use 5)
   * maxFractionDigits: maximum fraction digits (bytes use 2, counts use 7)
   */
  priceFormatting: {
    maxFractionDigits: number;
    minFractionDigits: number;
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
  getProductLink?: (organization: {slug: string}) => string;
}
