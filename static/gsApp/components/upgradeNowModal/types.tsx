import type {DATA_CATEGORY_INFO} from 'sentry/constants';

/**
 * Dynamically generate Reservations type from DATA_CATEGORY_INFO.
 *
 * Generates reservation property names by prefixing 'reserved' to the capitalized plural form
 * of each billed category. This follows the same pattern as ReservedInvoiceItemType but produces
 * camelCase property names for object keys.
 *
 * Includes all categories where isBilledCategory: true, covering reservations across
 * all plan types (AM1, AM2, AM3+).
 *
 * Pattern: `reserved${Capitalize<plural>}`
 * - DATA_CATEGORY_INFO.ERROR (plural: 'errors') -> 'reservedErrors'
 * - DATA_CATEGORY_INFO.LOG_BYTE (plural: 'logBytes') -> 'reservedLogBytes'
 * - DATA_CATEGORY_INFO.SPAN (plural: 'spans') -> 'reservedSpans'
 *
 * Values are `number | undefined` to handle:
 * - Categories that may not be present in a customer's plan
 * - Newer categories that haven't been fully rolled out yet
 * - Optional reservation data
 * - Different plan types having different category subsets
 *
 * @example
 * // Generates from DATA_CATEGORY_INFO where isBilledCategory: true:
 * {
 *   reservedErrors: number | undefined;
 *   reservedTransactions: number | undefined;
 *   reservedAttachments: number | undefined;
 *   reservedReplays: number | undefined;
 *   reservedSpans: number | undefined;
 *   reservedMonitorSeats: number | undefined;
 *   reservedProfileDuration: number | undefined;
 *   reservedProfileDurationUI: number | undefined;
 *   reservedUptime: number | undefined;
 *   reservedLogBytes: number | undefined;
 *   reservedSeerAutofix: number | undefined;
 *   reservedSeerScanner: number | undefined;
 * }
 *
 * @see DATA_CATEGORY_INFO in static/app/constants/index.tsx
 * @see ReservedInvoiceItemType in static/gsApp/types/index.tsx for snake_case equivalent
 * @see getsentry/billing/plans/ for plan definitions
 */
export type Reservations = {
  [K in keyof typeof DATA_CATEGORY_INFO as (typeof DATA_CATEGORY_INFO)[K]['isBilledCategory'] extends true
    ? `reserved${Capitalize<(typeof DATA_CATEGORY_INFO)[K]['plural']>}`
    : never]: number | undefined;
};
