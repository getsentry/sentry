import {DataCategory} from 'sentry/types/core';

export enum CreditType {
  ERROR = 'error',
  TRANSACTION = 'transaction',
  SPAN = 'span',
  PROFILE_DURATION = 'profile_duration',
  PROFILE_DURATION_UI = 'profile_duration_ui',
  ATTACHMENT = 'attachment',
  REPLAY = 'replay',
  DISCOUNT = 'discount',
  PERCENT = 'percent',
  LOG_BYTE = 'log_byte',
}

export const RECURRING_CREDIT_LIMITS = {
  DISCOUNT_MAX: 100000,
  DISCOUNT_MIN: 0,
  PERCENTAGE_MAX: 100,
  PERCENTAGE_MIN: 0,
  NOTES_MAX_LENGTH: 500,
} as const;

export const CENTS_MULTIPLIER = 100;

export const CATEGORY_TO_CREDIT_TYPE: Record<string, CreditType> = {
  [DataCategory.ERRORS]: CreditType.ERROR,
  [DataCategory.TRANSACTIONS]: CreditType.TRANSACTION,
  [DataCategory.SPANS]: CreditType.SPAN,
  [DataCategory.PROFILES]: CreditType.PROFILE_DURATION,
  [DataCategory.PROFILE_CHUNKS]: CreditType.PROFILE_DURATION_UI,
  [DataCategory.ATTACHMENTS]: CreditType.ATTACHMENT,
  [DataCategory.REPLAYS]: CreditType.REPLAY,
  [DataCategory.LOG_BYTE]: CreditType.LOG_BYTE,
} as const;

export const CREDIT_TYPE_OPTIONS = [
  {value: CreditType.DISCOUNT, label: 'Fixed Discount'},
  {value: CreditType.PERCENT, label: 'Percentage Discount'},
  {value: 'event', label: 'Event Credit'},
];

export const EVENT_CATEGORY_OPTIONS = [
  {value: DataCategory.ERRORS, label: 'Errors'},
  {value: DataCategory.TRANSACTIONS, label: 'Transactions'},
  {value: DataCategory.SPANS, label: 'Spans'},
  {value: DataCategory.PROFILES, label: 'Profiles'},
  {value: DataCategory.ATTACHMENTS, label: 'Attachments'},
  {value: DataCategory.REPLAYS, label: 'Replays'},
  {value: DataCategory.PROFILE_CHUNKS, label: 'Continuous Profiling'},
  {value: DataCategory.LOG_BYTE, label: 'Log Bytes'},
];
