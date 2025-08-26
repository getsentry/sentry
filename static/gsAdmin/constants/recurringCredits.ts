import {DataCategory} from 'sentry/types/core';

export enum CreditType {
  ERROR = 0,
  TRANSACTION = 1,
  ATTACHMENT = 2,
  DISCOUNT = 3,
  PERCENT = 4,
  REPLAY = 5,
  SPAN = 6,
  PROFILE_DURATION = 7,
  PROFILE_DURATION_UI = 8,
  LOG_BYTE = 9,
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
