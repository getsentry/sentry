export enum TraceMetricKnownFieldKey {
  ID = 'id',
  PROJECT_ID = 'project.id',
  ORGANIZATION_ID = 'organization.id',
  TIMESTAMP = 'timestamp',
  TIMESTAMP_PRECISE = 'timestamp_precise',
  OBSERVED_TIMESTAMP_PRECISE = 'observed_timestamp_precise',
  TRACE_ID = 'trace.id',
  SPAN_ID = 'span.id',
  METRIC_NAME = 'metric.name',
  METRIC_TYPE = 'sentry.metric_type',
  METRIC_VALUE = 'metric.value',
  METRIC_UNIT = 'metric.unit',
  ENVIRONMENT = 'environment',
  RELEASE = 'release',
  SDK_NAME = 'sdk.name',
  SDK_VERSION = 'sdk.version',
  TAGS = 'tags',
}

export type MetricsResponseItem = {
  [TraceMetricKnownFieldKey.ID]: string;
  [TraceMetricKnownFieldKey.PROJECT_ID]: string;
  [TraceMetricKnownFieldKey.ORGANIZATION_ID]: number;
  [TraceMetricKnownFieldKey.TIMESTAMP]: string;
  [TraceMetricKnownFieldKey.TIMESTAMP_PRECISE]: number;
  [TraceMetricKnownFieldKey.OBSERVED_TIMESTAMP_PRECISE]: number;
  [TraceMetricKnownFieldKey.TRACE_ID]: string | null;
  [TraceMetricKnownFieldKey.SPAN_ID]: string | null;
  [TraceMetricKnownFieldKey.METRIC_NAME]: string;
  [TraceMetricKnownFieldKey.METRIC_TYPE]: 'count' | 'gauge' | 'distribution' | 'set';
  [TraceMetricKnownFieldKey.METRIC_VALUE]: number;
  [TraceMetricKnownFieldKey.METRIC_UNIT]: string | null;
  [TraceMetricKnownFieldKey.ENVIRONMENT]: string | null;
  [TraceMetricKnownFieldKey.RELEASE]: string | null;
  [TraceMetricKnownFieldKey.SDK_NAME]: string | null;
  [TraceMetricKnownFieldKey.SDK_VERSION]: string | null;
  [TraceMetricKnownFieldKey.TAGS]: Record<string, string> | null;
} & Record<string, any>;

export type MetricsAggregatesResult = {
  data: Array<Record<string, any>>;
  meta: {
    fields: Record<
      string,
      'string' | 'number' | 'integer' | 'duration' | 'date' | 'boolean'
    >;
    units?: Record<string, string | null>;
  };
};

export type EventsMetricsResult = {
  data: MetricsResponseItem[];
  meta: {
    fields: Record<
      string,
      'string' | 'number' | 'integer' | 'duration' | 'date' | 'boolean'
    >;
    units?: Record<string, string | null>;
  };
};
