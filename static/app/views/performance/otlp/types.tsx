import {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import type {EAPSpanResponse} from 'sentry/views/insights/types';

// TODO: When supported, also add span operation breakdown as a field
export type ServiceEntrySpansRow = Pick<
  EAPSpanResponse,
  | 'span_id'
  | 'user.display'
  | 'user.id'
  | 'user.email'
  | 'user.username'
  | 'user.ip'
  | 'span.duration'
  | 'trace'
  | 'timestamp'
  | 'replayId'
  | 'profile.id'
  | 'profiler.id'
  | 'thread.id'
  | 'precise.start_ts'
  | 'precise.finish_ts'
>;

export type ServiceEntrySpansColumn = GridColumnHeader<
  | 'span_id'
  | 'user.display'
  | 'span.duration'
  | 'trace'
  | 'timestamp'
  | 'replayId'
  | 'profile.id'
>;

export const SERVICE_ENTRY_SPANS_COLUMN_ORDER: ServiceEntrySpansColumn[] = [
  {
    key: 'trace',
    name: t('Trace ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'span_id',
    name: t('Span ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'user.display',
    name: t('User'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'span.duration',
    name: t('Total Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'timestamp',
    name: t('Timestamp'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'replayId',
    name: t('Replay'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'profile.id',
    name: t('Profile'),
    width: COL_WIDTH_UNDEFINED,
  },
];
