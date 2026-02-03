import type {
  AggregateParameter,
  AggregationOutputType,
  ColumnType,
} from 'sentry/utils/discover/fields';

export type SessionsMeta = {
  name: string;
  operations: SessionsOperation[];
  type: ColumnType;
};

export enum SessionField {
  SESSION = 'session',
  SESSION_DURATION = 'session.duration',
  USER = 'user',
  STATUS = 'session.status',
}

export type SessionsOperation =
  | 'anr_rate'
  | 'count_abnormal'
  | 'count_crashed'
  | 'count_errored'
  | 'count_healthy'
  | 'count_unhandled'
  | 'count_unique'
  | 'crash_free_rate'
  | 'crash_rate'
  | 'foreground_anr_rate'
  | 'sum'
  | 'unhealthy_rate'
  | 'abnormal_rate'
  | 'errored_rate'
  | 'unhandled_rate';

export type SessionAggregationColumn = {
  outputType: AggregationOutputType | null;
  parameters: readonly AggregateParameter[];
};
