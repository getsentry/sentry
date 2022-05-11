import {
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
  | 'avg'
  | 'max'
  | 'p50'
  | 'p75'
  | 'p95'
  | 'p99'
  | 'crash_rate'
  | 'crash_free_rate'
  | 'count_abnormal'
  | 'count_errored'
  | 'count_healthy'
  | 'count_crashed';

export type SessionAggregationColumn = {
  columnTypes: string[];
  defaultValue: SessionsMeta['name'];
  outputType: AggregationOutputType | null;
  parameters: Readonly<AggregateParameter[]>;
};
