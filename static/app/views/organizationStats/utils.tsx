import type {DateTimeObject} from 'sentry/components/charts/utils';
import {getSeriesApiInterval} from 'sentry/components/charts/utils';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import type {DataCategoryInfo} from 'sentry/types/core';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';

const MILLION = 10 ** 6;
const BILLION = 10 ** 9;
const GIGABYTE = 10 ** 9;

type FormatOptions = {
  /**
   * Truncate 1234 => 1.2k or 1,234,000 to 1.23M
   */
  isAbbreviated?: boolean;

  /**
   * Convert attachments to use the most appropriate unit KB/MB/GB/TB/etc.
   * Otherwise, it will default to GB
   */
  useUnitScaling?: boolean;
};

/**
 * This expects usage values/quantities for the data categories that we sell.
 *
 * Note: usageQuantity for Attachments should be in BYTES
 */
export function formatUsageWithUnits(
  usageQuantity: number = 0,
  dataCategory: DataCategoryInfo['plural'],
  options: FormatOptions = {isAbbreviated: false, useUnitScaling: false}
): string {
  if (dataCategory === DATA_CATEGORY_INFO.attachment.plural) {
    if (options.useUnitScaling) {
      return formatBytesBase10(usageQuantity);
    }

    const usageGb = usageQuantity / GIGABYTE;
    return options.isAbbreviated
      ? `${abbreviateUsageNumber(usageGb)} GB`
      : `${usageGb.toLocaleString(undefined, {maximumFractionDigits: 2})} GB`;
  }

  if (
    dataCategory === DATA_CATEGORY_INFO.profileDuration.plural &&
    Number.isFinite(usageQuantity)
  ) {
    // Profile duration is in milliseconds, convert to hours
    return (usageQuantity / 1000 / 60 / 60).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
  }

  return options.isAbbreviated
    ? abbreviateUsageNumber(usageQuantity)
    : usageQuantity.toLocaleString();
}

/**
 * Good default for "formatUsageWithUnits"
 */
export function getFormatUsageOptions(
  dataCategory: DataCategoryInfo['plural']
): FormatOptions {
  return {
    isAbbreviated: dataCategory !== DATA_CATEGORY_INFO.attachment.plural,
    useUnitScaling: dataCategory === DATA_CATEGORY_INFO.attachment.plural,
  };
}

/**
 * Instead of using this function directly, use formatReservedWithUnits or
 * formatUsageWithUnits with options.isAbbreviated to true instead.
 *
 * This function display different precision for billion/million/thousand to
 * provide clarity on usage of errors/transactions/attachments to the user.
 *
 * If you are not displaying usage numbers, it might be better to use
 * `formatAbbreviatedNumber` in 'sentry/utils/formatters'
 */
export function abbreviateUsageNumber(n: number) {
  if (n >= BILLION) {
    return (n / BILLION).toLocaleString(undefined, {maximumFractionDigits: 2}) + 'B';
  }

  if (n >= MILLION) {
    return (n / MILLION).toLocaleString(undefined, {maximumFractionDigits: 1}) + 'M';
  }

  if (n >= 1000) {
    return (n / 1000).toFixed().toLocaleString() + 'K';
  }

  // Do not show decimals
  return n.toFixed().toLocaleString();
}

/**
 * We want to display datetime in UTC in the following situations:
 *
 * 1) The user selected an absolute date range with UTC
 * 2) The user selected a wide date range with 1d interval
 *
 * When the interval is 1d, we need to use UTC because the 24 hour range might
 * shift forward/backward depending on the user's timezone, or it might be
 * displayed as a day earlier/later
 */
export function isDisplayUtc(datetime: DateTimeObject): boolean {
  if (datetime.utc) {
    return true;
  }

  const interval = getSeriesApiInterval(datetime);
  const hours = parsePeriodToHours(interval);
  return hours >= 24;
}

/**
 * HACK(dlee): client-side pagination
 */
export function getOffsetFromCursor(cursor?: string) {
  const offset = Number(cursor?.split(':')[1]);
  return isNaN(offset) ? 0 : offset;
}

/**
 * HACK(dlee): client-side pagination
 */
export function getPaginationPageLink({
  numRows,
  pageSize,
  offset,
}: {
  numRows: number;
  offset: number;
  pageSize: number;
}) {
  const prevOffset = offset - pageSize;
  const nextOffset = offset + pageSize;

  return `<link>; rel="previous"; results="${prevOffset >= 0}"; cursor="0:${Math.max(
    0,
    prevOffset
  )}:1", <link>; rel="next"; results="${
    nextOffset < numRows
  }"; cursor="0:${nextOffset}:0"`;
}

// List of Relay's current invalid reasons - https://github.com/getsentry/relay/blob/89a8dd7caaad1f126e1cacced0d73bb50fcd4f5a/relay-server/src/services/outcome.rs#L333
const DiscardReason = {
  DUPLICATE: 'duplicate',
  PROJECT_ID: 'project_id',
  AUTH_VERSION: 'auth_version',
  AUTH_CLIENT: 'auth_client',
  NO_DATA: 'no_data',
  DISALLOWED_METHOD: 'disallowed_method',
  CONTENT_TYPE: 'content_type',
  INVALID_MULTIPART: 'invalid_multipart',
  INVALID_MSGPACK: 'invalid_msgpack',
  INVALID_JSON: 'invalid_json',
  INVALID_ENVELOPE: 'invalid_envelope',
  TIMESTAMP: 'timestamp',
  DUPLICATE_ITEM: 'duplicate_item',
  INVALID_TRANSACTION: 'invalid_transaction',
  INVALID_SPAN: 'invalid_span',
  INVALID_REPLAY: 'invalid_replay',
  INVALID_REPLAY_RECORDING: 'invalid_replay_recording',
  INVALID_REPLAY_VIDEO: 'invalid_replay_video',
  PAYLOAD: 'payload',
  INVALID_COMPRESSION: 'invalid_compression',
  TOO_LARGE: 'too_large',
  MISSING_MINIDUMP_UPLOAD: 'missing_minidump_upload',
  INVALID_MINIDUMP: 'invalid_minidump',
  SECURITY_REPORT: 'security_report',
  SECURITY_REPORT_TYPE: 'security_report_type',
  PROCESS_UNREAL: 'process_unreal',
  CORS: 'cors',
  NO_EVENT_PAYLOAD: 'no_event_payload',
  EMPTY_ENVELOPE: 'empty_envelope',
  INVALID_REPLAY_NO_PAYLOAD: 'invalid_replay_no_payload',
  TRANSACTION_SAMPLED: 'transaction_sampled',
  INTERNAL: 'internal',
  MULTI_PROJECT_ID: 'multi_project_id',
  PROJECT_STATE: 'project_state',
  PROJECT_STATE_PII: 'project_state_pii',
  INVALID_REPLAY_PII_SCRUBBER_FAILED: 'invalid_replay_pii_scrubber_failed',
  FEATURE_DISABLED: 'feature_disabled',
};

// Invalid reasons should not be exposed directly, but instead in the following groups:
const invalidReasonsGroup = {
  duplicate: [DiscardReason.DUPLICATE],
  project_missing: [DiscardReason.PROJECT_ID],
  invalid_request: [
    DiscardReason.AUTH_VERSION,
    DiscardReason.AUTH_CLIENT,
    DiscardReason.NO_DATA,
    DiscardReason.DISALLOWED_METHOD,
    DiscardReason.CONTENT_TYPE,
    DiscardReason.INVALID_MULTIPART,
    DiscardReason.INVALID_MSGPACK,
    DiscardReason.INVALID_JSON,
    DiscardReason.INVALID_ENVELOPE,
    DiscardReason.TIMESTAMP,
    DiscardReason.DUPLICATE_ITEM,
  ],
  invalid_data: [
    DiscardReason.INVALID_TRANSACTION,
    DiscardReason.INVALID_SPAN,
    DiscardReason.INVALID_REPLAY,
    DiscardReason.INVALID_REPLAY_RECORDING,
    DiscardReason.INVALID_REPLAY_VIDEO,
  ],
  payload: [DiscardReason.PAYLOAD, DiscardReason.INVALID_COMPRESSION],
  too_large: [DiscardReason.TOO_LARGE],
  minidump: [DiscardReason.MISSING_MINIDUMP_UPLOAD, DiscardReason.INVALID_MINIDUMP],
  security_report: [DiscardReason.SECURITY_REPORT, DiscardReason.SECURITY_REPORT_TYPE],
  unreal: [DiscardReason.PROCESS_UNREAL],
  cors: [DiscardReason.CORS],
  empty: [
    DiscardReason.NO_EVENT_PAYLOAD,
    DiscardReason.EMPTY_ENVELOPE,
    DiscardReason.INVALID_REPLAY_NO_PAYLOAD,
  ],
  sampling: [DiscardReason.TRANSACTION_SAMPLED],
  other: [
    DiscardReason.INTERNAL,
    DiscardReason.MULTI_PROJECT_ID,
    DiscardReason.PROJECT_STATE,
    DiscardReason.PROJECT_STATE_PII,
    DiscardReason.INVALID_REPLAY_PII_SCRUBBER_FAILED,
    DiscardReason.FEATURE_DISABLED,
  ],
};

export function getInvalidReasonGroupName(reason: string) {
  for (const [group, reasons] of Object.entries(invalidReasonsGroup)) {
    if (reasons.includes(reason)) {
      return group;
    }
  }
  return reason;
}
