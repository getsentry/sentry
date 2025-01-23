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
}

export type SessionsOperation =
  | 'sum'
  | 'count_unique'
  | 'crash_rate'
  | 'crash_free_rate'
  | 'count_abnormal'
  | 'count_errored'
  | 'count_healthy'
  | 'count_crashed'
  | 'anr_rate'
  | 'foreground_anr_rate';

export type SessionAggregationColumn = {
  outputType: AggregationOutputType | null;
  parameters: readonly AggregateParameter[];
};
