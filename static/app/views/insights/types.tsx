export enum StarfishType {
  BACKEND = 'backend',
  MOBILE = 'mobile',
  FRONTEND = 'frontend',
}

export enum ModuleName {
  HTTP = 'http',
  DB = 'db',
  CACHE = 'cache',
  VITAL = 'vital',
  QUEUE = 'queue',
  SCREEN_LOAD = 'screen_load',
  APP_START = 'app_start',
  RESOURCE = 'resource',
  AI = 'ai',
  MOBILE_UI = 'mobile-ui',
  MOBILE_VITALS = 'mobile-vitals',
  SCREEN_RENDERING = 'screen-rendering',
  CRONS = 'crons',
  UPTIME = 'uptime',
  SESSIONS = 'sessions',
  OTHER = 'other',
}

export enum SpanMetricsField {
  SPAN_OP = 'span.op',
  NORMALIZED_DESCRIPTION = 'sentry.normalized_description',
  SPAN_DESCRIPTION = 'span.description',
  SPAN_MODULE = 'span.module',
  SPAN_ACTION = 'span.action',
  SPAN_DOMAIN = 'span.domain',
  SPAN_GROUP = 'span.group',
  SPAN_DURATION = 'span.duration',
  SPAN_SELF_TIME = 'span.self_time',
  SPAN_SYSTEM = 'span.system',
  PROJECT = 'project',
  PROJECT_ID = 'project.id',
  TRANSACTION = 'transaction',
  RESOURCE_RENDER_BLOCKING_STATUS = 'resource.render_blocking_status',
  HTTP_RESPONSE_CONTENT_LENGTH = 'http.response_content_length',
  HTTP_DECODED_RESPONSE_CONTENT_LENGTH = 'http.decoded_response_content_length',
  HTTP_RESPONSE_TRANSFER_SIZE = 'http.response_transfer_size',
  FILE_EXTENSION = 'file_extension',
  AI_TOTAL_TOKENS_USED = 'ai.total_tokens.used',
  AI_PROMPT_TOKENS_USED = 'ai.prompt_tokens.used',
  AI_COMPLETION_TOKENS_USED = 'ai.completion_tokens.used',
  AI_INPUT_MESSAGES = 'ai.input_messages',
  AI_TOTAL_COST = 'ai.total_cost',
  OS_NAME = 'os.name',
  APP_START_TYPE = 'app_start_type',
  DEVICE_CLASS = 'device.class',
  CACHE_HIT = 'cache.hit',
  CACHE_KEY = 'cache.key',
  CACHE_ITEM_SIZE = 'cache.item_size',
  MESSAGING_MESSAGE_RECEIVE_LATENCY = 'messaging.message.receive.latency',
  THREAD_ID = 'thread.id',
  SENTRY_FRAMES_SLOW = 'sentry.frames.slow',
  SENTRY_FRAMES_FROZEN = 'sentry.frames.frozen',
  SENTRY_FRAMES_TOTAL = 'sentry.frames.total',
  FRAMES_DELAY = 'frames.delay',
  URL_FULL = 'url.full',
  USER_AGENT_ORIGINAL = 'user_agent.original',
  CLIENT_ADDRESS = 'client.address',
  BROWSER_NAME = 'browser.name',
  USER_GEO_SUBREGION = 'user.geo.subregion',
  PRECISE_START_TS = 'precise.start_ts',
  PRECISE_FINISH_TS = 'precise.finish_ts',
  MOBILE_FRAMES_DELAY = 'mobile.frames_delay',
  MOBILE_FROZEN_FRAMES = 'mobile.frozen_frames',
  MOBILE_TOTAL_FRAMES = 'mobile.total_frames',
  MOBILE_SLOW_FRAMES = 'mobile.slow_frames',
}

// TODO: This will be the final field type for eap spans
export enum SpanFields {
  IS_TRANSACTION = 'is_transaction',
  CACHE_HIT = 'cache.hit',
  IS_STARRED_TRANSACTION = 'is_starred_transaction',
}

export type SpanBooleanFields =
  | SpanFields.CACHE_HIT
  | SpanFields.IS_TRANSACTION
  | SpanFields.IS_STARRED_TRANSACTION;

export type SpanNumberFields =
  | SpanMetricsField.AI_TOTAL_COST
  | SpanMetricsField.AI_TOTAL_TOKENS_USED
  | SpanMetricsField.SPAN_SELF_TIME
  | SpanMetricsField.SPAN_DURATION
  | SpanMetricsField.HTTP_DECODED_RESPONSE_CONTENT_LENGTH
  | SpanMetricsField.HTTP_RESPONSE_CONTENT_LENGTH
  | SpanMetricsField.HTTP_RESPONSE_TRANSFER_SIZE
  | SpanMetricsField.MESSAGING_MESSAGE_RECEIVE_LATENCY
  | SpanMetricsField.CACHE_ITEM_SIZE
  | SpanMetricsField.PRECISE_START_TS
  | SpanMetricsField.PRECISE_FINISH_TS
  | SpanMetricsField.MOBILE_FRAMES_DELAY
  | SpanMetricsField.MOBILE_FROZEN_FRAMES
  | SpanMetricsField.MOBILE_TOTAL_FRAMES
  | SpanMetricsField.MOBILE_SLOW_FRAMES
  | DiscoverNumberFields;

export type SpanStringFields =
  | SpanMetricsField.RESOURCE_RENDER_BLOCKING_STATUS
  | 'id'
  | 'span_id'
  | 'span.op'
  | 'span.description'
  | 'sentry.normalized_description'
  | 'span.module'
  | 'span.action'
  | 'span.group'
  | 'span.category'
  | 'span.system'
  | 'timestamp'
  | 'trace'
  | 'transaction'
  | 'transaction.span_id'
  | 'transaction.id'
  | 'transaction.method'
  | 'release'
  | 'request.method'
  | 'os.name'
  | 'span.status_code'
  | 'span.ai.pipeline.group'
  | 'project'
  | 'messaging.destination.name'
  | 'user'
  | 'user.display'
  | 'user.id'
  | 'user.email'
  | 'user.username'
  | 'user.ip'
  | 'replayId'
  | 'profile.id'
  | 'profiler.id'
  | 'thread.id';

export type SpanMetricsQueryFilters = Partial<Record<SpanStringFields, string>> & {
  [SpanMetricsField.PROJECT_ID]?: string;
  [SpanMetricsField.SPAN_DOMAIN]?: string;
};

export type SpanIndexedQueryFilters = Partial<Record<SpanStringFields, string>> & {
  [SpanIndexedField.PROJECT_ID]?: string;
};

export type SpanStringArrayFields = 'span.domain';

export const COUNTER_AGGREGATES = ['sum', 'avg', 'min', 'max', 'p100'] as const;
export const DISTRIBUTION_AGGREGATES = ['p50', 'p75', 'p90', 'p95', 'p99'] as const;

export const AGGREGATES = [...COUNTER_AGGREGATES, ...DISTRIBUTION_AGGREGATES] as const;

export type Aggregate = (typeof AGGREGATES)[number];

export type ConditionalAggregate =
  | `avg_if`
  | `count_op`
  | 'trace_status_rate'
  | 'time_spent_percentage';

export const SPAN_FUNCTIONS = [
  'sps',
  'spm',
  'epm',
  'count',
  'time_spent_percentage',
  'http_response_rate',
  'http_response_count',
  'cache_hit_rate',
  'cache_miss_rate',
  'sum',
  'failure_rate',
] as const;

type BreakpointCondition = 'less' | 'greater';

type RegressionFunctions = [
  `regression_score(${string},${string})`,
  `avg_by_timestamp(${string},${BreakpointCondition},${string})`,
  `epm_by_timestamp(${BreakpointCondition},${string})`,
][number];

type SpanAnyFunction = `any(${string})`;

export type SpanFunctions = (typeof SPAN_FUNCTIONS)[number];

export type SpanMetricsResponse = {
  [Property in SpanNumberFields as `${Aggregate}(${Property})`]: number;
} & {
  [Property in SpanFunctions as `${Property}()`]: number;
} & {
  [Property in SpanStringFields as `${Property}`]: string;
} & {
  [Property in SpanStringArrayFields as `${Property}`]: string[];
  // TODO: We should allow a nicer way to define functions with multiple arguments and different arg types
} & Record<`division(${SpanNumberFields},${SpanNumberFields})`, number> & {
    // TODO: This should include all valid HTTP codes or just all integers
    'http_response_count(2)': number;
    'http_response_count(3)': number;
    'http_response_count(4)': number;
    'http_response_count(5)': number;
    'http_response_rate(2)': number;
    'http_response_rate(3)': number;
    'http_response_rate(4)': number;
    'http_response_rate(5)': number;
  } & {
    ['project']: string;
    ['project.id']: number;
  } & Record<RegressionFunctions, number> &
  Record<SpanAnyFunction, string> & {
    [Property in ConditionalAggregate as
      | `${Property}(${string})`
      | `${Property}(${string},${string})`
      | `${Property}(${string},${string},${string})`]: number;
  } & {
    [SpanMetricsField.USER_GEO_SUBREGION]: SubregionCode;
  };
export type MetricsFilters = {
  [Property in SpanStringFields as `${Property}`]?: string | string[];
};

export type SpanMetricsProperty = keyof SpanMetricsResponse;

export type EAPSpanResponse = {
  [Property in SpanNumberFields as `${Aggregate}(${Property})`]: number;
} & {
  [Property in SpanFunctions as `${Property}()`]: number;
} & {
  [Property in SpanStringFields as `${Property}`]: string;
} & {
  [Property in SpanNumberFields as `${Property}`]: number;
} & {
  [Property in SpanStringArrayFields as `${Property}`]: string[];
} & {} & {
  [Property in SpanBooleanFields as `${Property}`]: boolean;
} & {
  ['project']: string;
  ['project.id']: number;
} & Record<RegressionFunctions, number> &
  Record<SpanAnyFunction, string> & {
    [Property in ConditionalAggregate as
      | `${Property}(${string})`
      | `${Property}(${string},${string})`
      | `${Property}(${string},${string},${string})`]: number;
  } & {
    [SpanMetricsField.USER_GEO_SUBREGION]: SubregionCode;
    [SpanIndexedField.SPAN_AI_PIPELINE_GROUP_TAG]: string;
  };

export type EAPSpanProperty = keyof EAPSpanResponse;

export enum SpanIndexedField {
  ENVIRONMENT = 'environment',
  RESOURCE_RENDER_BLOCKING_STATUS = 'resource.render_blocking_status',
  HTTP_RESPONSE_CONTENT_LENGTH = 'http.response_content_length',
  SPAN_CATEGORY = 'span.category',
  SPAN_DURATION = 'span.duration',
  SPAN_SELF_TIME = 'span.self_time',
  SPAN_GROUP = 'span.group', // Span group computed from the normalized description. Matches the group in the metrics data set
  SPAN_MODULE = 'span.module',
  SPAN_DESCRIPTION = 'span.description',
  SPAN_STATUS = 'span.status',
  SPAN_OP = 'span.op',
  ID = 'id',
  SPAN_ID = 'span_id',
  SPAN_ACTION = 'span.action',
  SPAN_AI_PIPELINE_GROUP = 'span.ai.pipeline.group',
  SPAN_AI_PIPELINE_GROUP_TAG = 'ai_pipeline_group',
  SDK_NAME = 'sdk.name',
  SDK_VERSION = 'sdk.version',
  TRACE = 'trace',
  TRANSACTION_ID = 'transaction.id', // TODO - remove this with `useInsightsEap`
  TRANSACTION_SPAN_ID = 'transaction.span_id',
  TRANSACTION_METHOD = 'transaction.method',
  TRANSACTION_OP = 'transaction.op',
  SPAN_DOMAIN = 'span.domain',
  TIMESTAMP = 'timestamp',
  RAW_DOMAIN = 'raw_domain',
  PROJECT = 'project',
  PROJECT_ID = 'project_id',
  PROFILE_ID = 'profile_id',
  RELEASE = 'release',
  TRANSACTION = 'transaction',
  ORIGIN_TRANSACTION = 'origin.transaction',
  REPLAY_ID = 'replay.id',
  REPLAY = 'replay', // Field alias that coalesces `replay.id` and `replayId`
  BROWSER_NAME = 'browser.name',
  USER = 'user',
  USER_ID = 'user.id',
  USER_IP = 'user.ip',
  USER_EMAIL = 'user.email',
  USER_USERNAME = 'user.username',
  USER_DISPLAY = 'user.display', // Field alias that coalesces `user.id`, `user.email`, `user.username`, `user.ip`, and `user`
  INP = 'measurements.inp',
  INP_SCORE = 'measurements.score.inp',
  INP_SCORE_RATIO = 'measurements.score.ratio.inp',
  INP_SCORE_WEIGHT = 'measurements.score.weight.inp',
  LCP = 'measurements.lcp',
  LCP_SCORE = 'measurements.score.lcp',
  LCP_SCORE_RATIO = 'measurements.score.ratio.lcp',
  CLS = 'measurements.cls',
  CLS_SCORE = 'measurements.score.cls',
  CLS_SCORE_RATIO = 'measurements.score.ratio.cls',
  TTFB = 'measurements.ttfb',
  TTFB_SCORE = 'measurements.score.ttfb',
  TTFB_SCORE_RATIO = 'measurements.score.ratio.ttfb',
  FCP = 'measurements.fcp',
  FCP_SCORE = 'measurements.score.fcp',
  FCP_SCORE_RATIO = 'measurements.score.ratio.fcp',
  TOTAL_SCORE = 'measurements.score.total',
  RESPONSE_CODE = 'span.status_code',
  CACHE_HIT = 'cache.hit',
  CACHE_ITEM_SIZE = 'measurements.cache.item_size',
  TRACE_STATUS = 'trace.status',
  MESSAGING_MESSAGE_ID = 'messaging.message.id',
  MESSAGING_MESSAGE_BODY_SIZE = 'measurements.messaging.message.body.size',
  MESSAGING_MESSAGE_RECEIVE_LATENCY = 'measurements.messaging.message.receive.latency',
  MESSAGING_MESSAGE_RETRY_COUNT = 'measurements.messaging.message.retry.count',
  MESSAGING_MESSAGE_DESTINATION_NAME = 'messaging.destination.name',
  USER_GEO_SUBREGION = 'user.geo.subregion',
  IS_TRANSACTION = 'is_transaction',
  LCP_ELEMENT = 'lcp.element',
  CLS_SOURCE = 'cls.source.1',
  NORMALIZED_DESCRIPTION = 'sentry.normalized_description',
  MEASUREMENT_HTTP_RESPONSE_CONTENT_LENGTH = 'measurements.http.response_content_length',
}

export type SpanIndexedResponse = {
  [SpanIndexedField.ID]: string;
  [SpanIndexedField.SPAN_ID]: string;
  [SpanIndexedField.ENVIRONMENT]: string;
  [SpanIndexedField.RELEASE]: string;
  [SpanIndexedField.SDK_NAME]: string;
  [SpanIndexedField.SDK_VERSION]: string;
  [SpanIndexedField.SPAN_CATEGORY]: string;
  [SpanIndexedField.SPAN_DURATION]: number;
  [SpanIndexedField.SPAN_SELF_TIME]: number;
  [SpanIndexedField.SPAN_GROUP]: string;
  [SpanIndexedField.SPAN_MODULE]: string;
  [SpanIndexedField.SPAN_DESCRIPTION]: string;
  [SpanIndexedField.SPAN_OP]: string;
  [SpanIndexedField.SPAN_AI_PIPELINE_GROUP]: string;
  [SpanIndexedField.SPAN_STATUS]:
    | 'ok'
    | 'cancelled'
    | 'unknown'
    | 'invalid_argument'
    | 'deadline_exceeded'
    | 'not_found'
    | 'already_exists'
    | 'permission_denied'
    | 'resource_exhausted'
    | 'failed_precondition'
    | 'aborted'
    | 'out_of_range'
    | 'unimplemented'
    | 'internal_error'
    | 'unavailable'
    | 'data_loss'
    | 'unauthenticated';
  [SpanIndexedField.SPAN_ID]: string;
  [SpanIndexedField.SPAN_ACTION]: string;
  [SpanIndexedField.TRACE]: string;
  [SpanIndexedField.TRANSACTION]: string;
  [SpanIndexedField.TRANSACTION_ID]: string;
  [SpanIndexedField.TRANSACTION_SPAN_ID]: string;
  [SpanIndexedField.TRANSACTION_METHOD]: string;
  [SpanIndexedField.TRANSACTION_OP]: string;
  [SpanIndexedField.SPAN_DOMAIN]: string[];
  [SpanIndexedField.RAW_DOMAIN]: string;
  [SpanIndexedField.TIMESTAMP]: string;
  [SpanIndexedField.PROJECT]: string;
  [SpanIndexedField.PROJECT_ID]: number;
  [SpanIndexedField.PROFILE_ID]: string;
  [SpanIndexedField.RESOURCE_RENDER_BLOCKING_STATUS]: '' | 'non-blocking' | 'blocking';
  [SpanIndexedField.HTTP_RESPONSE_CONTENT_LENGTH]: string;
  [SpanIndexedField.ORIGIN_TRANSACTION]: string;
  [SpanIndexedField.REPLAY_ID]: string;
  [SpanIndexedField.REPLAY]: string;
  [SpanIndexedField.BROWSER_NAME]: string;
  [SpanIndexedField.USER]: string;
  [SpanIndexedField.USER_ID]: string;
  [SpanIndexedField.USER_EMAIL]: string;
  [SpanIndexedField.USER_USERNAME]: string;
  [SpanIndexedField.USER_IP]: string;
  [SpanIndexedField.USER_DISPLAY]: string;
  [SpanIndexedField.IS_TRANSACTION]: number;
  [SpanIndexedField.INP]: number;
  [SpanIndexedField.INP_SCORE]: number;
  [SpanIndexedField.INP_SCORE_WEIGHT]: number;
  [SpanIndexedField.INP_SCORE_RATIO]: number;
  [SpanIndexedField.LCP]: number;
  [SpanIndexedField.LCP_SCORE]: number;
  [SpanIndexedField.LCP_SCORE_RATIO]: number;
  [SpanIndexedField.CLS]: number;
  [SpanIndexedField.CLS_SCORE]: number;
  [SpanIndexedField.CLS_SCORE_RATIO]: number;
  [SpanIndexedField.TTFB]: number;
  [SpanIndexedField.TTFB_SCORE]: number;
  [SpanIndexedField.TTFB_SCORE_RATIO]: number;
  [SpanIndexedField.FCP]: number;
  [SpanIndexedField.FCP_SCORE]: number;
  [SpanIndexedField.FCP_SCORE_RATIO]: number;
  [SpanIndexedField.TOTAL_SCORE]: number;
  [SpanIndexedField.RESPONSE_CODE]: string;
  [SpanIndexedField.CACHE_HIT]: '' | 'true' | 'false';
  [SpanIndexedField.CACHE_ITEM_SIZE]: number;
  [SpanIndexedField.TRACE_STATUS]: string;
  [SpanIndexedField.MESSAGING_MESSAGE_ID]: string;
  [SpanIndexedField.MESSAGING_MESSAGE_BODY_SIZE]: number;
  [SpanIndexedField.MESSAGING_MESSAGE_RECEIVE_LATENCY]: number;
  [SpanIndexedField.MESSAGING_MESSAGE_RETRY_COUNT]: number;
  [SpanIndexedField.MESSAGING_MESSAGE_DESTINATION_NAME]: string;
  [SpanIndexedField.USER_GEO_SUBREGION]: string;
  [SpanIndexedField.LCP_ELEMENT]: string;
  [SpanIndexedField.CLS_SOURCE]: string;
  [SpanIndexedField.MEASUREMENT_HTTP_RESPONSE_CONTENT_LENGTH]: number;
  [SpanIndexedField.PROJECT]: string;
  [SpanIndexedField.SPAN_GROUP]: string;
  'any(id)': string;
};

export type SpanIndexedProperty = keyof SpanIndexedResponse;

// TODO: When convenient, remove this alias and use `IndexedResponse` everywhere
export type SpanIndexedFieldTypes = SpanIndexedResponse;

export type Op = SpanIndexedFieldTypes[SpanIndexedField.SPAN_OP];

export enum SpanFunction {
  SPS = 'sps',
  EPM = 'epm',
  TIME_SPENT_PERCENTAGE = 'time_spent_percentage',
  HTTP_RESPONSE_COUNT = 'http_response_count',
  HTTP_RESPONSE_RATE = 'http_response_rate',
  CACHE_HIT_RATE = 'cache_hit_rate',
  CACHE_MISS_RATE = 'cache_miss_rate',
  COUNT_OP = 'count_op',
  TRACE_STATUS_RATE = 'trace_status_rate',
}

// TODO - add more functions and fields, combine shared ones, etc

export const METRICS_FUNCTIONS = [
  'count',
  'performance_score',
  'count_scores',
  'opportunity_score',
  'total_opportunity_score',
  'p75',
] as const;

export enum MetricsFields {
  TRANSACTION_DURATION = 'transaction.duration',
  SPAN_DURATION = 'span.duration',
  TRANSACTION = 'transaction',
  PROJECT = 'project',
  LCP_SCORE = 'measurements.score.lcp',
  FCP_SCORE = 'measurements.score.fcp',
  INP_SCORE = 'measurements.score.inp',
  CLS_SCORE = 'measurements.score.cls',
  TTFB_SCORE = 'measurements.score.ttfb',
  TOTAL_SCORE = 'measurements.score.total',
  LCP_WEIGHT = 'measurements.score.weight.lcp',
  FCP_WEIGHT = 'measurements.score.weight.fcp',
  INP_WEIGHT = 'measurements.score.weight.inp',
  CLS_WEIGHT = 'measurements.score.weight.cls',
  TTFB_WEIGHT = 'measurements.score.weight.ttfb',
  TOTAL_WEIGHT = 'measurements.score.weight.total',
  PROJECT_ID = 'project.id',
  LCP = 'measurements.lcp',
  FCP = 'measurements.fcp',
  INP = 'measurements.inp',
  CLS = 'measurements.cls',
  TTFB = 'measurements.ttfb',
  ID = 'id',
  TRACE = 'trace',
  USER_DISPLAY = 'user.display',
  REPLAY_ID = 'replayId',
  TIMESTAMP = 'timestamp',
  PROFILE_ID = 'profile.id',
  APP_START_COLD = 'measurements.app_start_cold',
  APP_START_WARM = 'measurements.app_start_warm',
  TIME_TO_INITIAL_DISPLAY = 'measurements.time_to_initial_display',
  TIME_TO_FULL_DISPLAY = 'measurements.time_to_full_display',
  RELEASE = 'release',
}

export type MetricsNumberFields =
  | MetricsFields.TRANSACTION_DURATION
  | MetricsFields.SPAN_DURATION
  | MetricsFields.LCP_SCORE
  | MetricsFields.FCP_SCORE
  | MetricsFields.INP_SCORE
  | MetricsFields.CLS_SCORE
  | MetricsFields.TTFB_SCORE
  | MetricsFields.TOTAL_SCORE
  | MetricsFields.LCP_WEIGHT
  | MetricsFields.FCP_WEIGHT
  | MetricsFields.INP_WEIGHT
  | MetricsFields.CLS_WEIGHT
  | MetricsFields.TTFB_WEIGHT
  | MetricsFields.TOTAL_WEIGHT
  | MetricsFields.LCP
  | MetricsFields.FCP
  | MetricsFields.INP
  | MetricsFields.CLS
  | MetricsFields.TTFB
  | MetricsFields.APP_START_COLD
  | MetricsFields.APP_START_WARM
  | MetricsFields.TIME_TO_INITIAL_DISPLAY
  | MetricsFields.TIME_TO_FULL_DISPLAY;

export type MetricsStringFields =
  | MetricsFields.TRANSACTION
  | MetricsFields.PROJECT
  | MetricsFields.ID
  | MetricsFields.TRACE
  | MetricsFields.USER_DISPLAY
  | MetricsFields.PROFILE_ID
  | MetricsFields.RELEASE
  | MetricsFields.TIMESTAMP;

export type MetricsFunctions = (typeof METRICS_FUNCTIONS)[number];

export type MetricsResponse = {
  [Property in MetricsNumberFields as `${Aggregate}(${Property})`]: number;
} & {
  [Property in MetricsNumberFields as `${MetricsFunctions}(${Property})`]: number;
} & {
  [Function in MetricsFunctions as `${Function}()`]: number;
} & {
  [Property in MetricsStringFields as `${Property}`]: string;
} & {
  [Property in MetricsNumberFields as `count_web_vitals(${Property}, any)`]: string[];
} & {
  ['project.id']: number;
};

export enum DiscoverFields {
  ID = 'id',
  TRACE = 'trace',
  USER_DISPLAY = 'user.display',
  TRANSACTION = 'transaction',
  LCP = 'measurements.lcp',
  FCP = 'measurements.fcp',
  CLS = 'measurements.cls',
  TTFB = 'measurements.ttfb',
  TRANSACTION_DURATION = 'transaction.duration',
  SPAN_DURATION = 'span.duration',
  REPLAY_ID = 'replayId',
  TIMESTAMP = 'timestamp',
  PROFILE_ID = 'profile.id',
  PROJECT = 'project',
  SCORE_TOTAL = 'measurements.score.total',
  SCORE_LCP = 'measurements.score.lcp',
  SCORE_FCP = 'measurements.score.fcp',
  SCORE_CLS = 'measurements.score.cls',
  SCORE_TTFB = 'measurements.score.ttfb',
  SCORE_INP = 'measurements.score.inp',
  SCORE_WEIGHT_LCP = 'measurements.score.weight.lcp',
  SCORE_WEIGHT_FCP = 'measurements.score.weight.fcp',
  SCORE_WEIGHT_CLS = 'measurements.score.weight.cls',
  SCORE_WEIGHT_TTFB = 'measurements.score.weight.ttfb',
  SCORE_WEIGHT_INP = 'measurements.score.weight.inp',
  SCORE_RATIO_LCP = 'measurements.score.ratio.lcp',
  SCORE_RATIO_FCP = 'measurements.score.ratio.fcp',
  SCORE_RATIO_CLS = 'measurements.score.ratio.cls',
  SCORE_RATIO_TTFB = 'measurements.score.ratio.ttfb',
  SCORE_RATIO_INP = 'measurements.score.ratio.inp',
}

export type MetricsProperty = keyof MetricsResponse;

export type DiscoverNumberFields =
  | DiscoverFields.CLS
  | DiscoverFields.FCP
  | DiscoverFields.LCP
  | DiscoverFields.TTFB
  | DiscoverFields.TRANSACTION_DURATION
  | DiscoverFields.SPAN_DURATION
  | DiscoverFields.SCORE_TOTAL
  | DiscoverFields.SCORE_LCP
  | DiscoverFields.SCORE_FCP
  | DiscoverFields.SCORE_CLS
  | DiscoverFields.SCORE_TTFB
  | DiscoverFields.SCORE_INP
  | DiscoverFields.SCORE_WEIGHT_LCP
  | DiscoverFields.SCORE_WEIGHT_FCP
  | DiscoverFields.SCORE_WEIGHT_CLS
  | DiscoverFields.SCORE_WEIGHT_TTFB
  | DiscoverFields.SCORE_WEIGHT_INP
  | DiscoverFields.SCORE_RATIO_LCP
  | DiscoverFields.SCORE_RATIO_FCP
  | DiscoverFields.SCORE_RATIO_CLS
  | DiscoverFields.SCORE_RATIO_TTFB
  | DiscoverFields.SCORE_RATIO_INP;

export type DiscoverStringFields =
  | DiscoverFields.ID
  | DiscoverFields.TRACE
  | DiscoverFields.USER_DISPLAY
  | DiscoverFields.TRANSACTION
  | DiscoverFields.REPLAY_ID
  | DiscoverFields.TIMESTAMP
  | DiscoverFields.PROFILE_ID
  | DiscoverFields.PROJECT;

export type DiscoverResponse = {
  [Property in DiscoverNumberFields as `${Property}`]: number;
} & {
  [Property in DiscoverStringFields as `${Property}`]: string;
};

export type DiscoverProperty = keyof DiscoverResponse;

export type MetricsQueryFilters = Partial<Record<MetricsStringFields, string>> & {
  [SpanIndexedField.PROJECT_ID]?: string;
};

// Maps the subregion code to the subregion name according to UN m49 standard
// We also define this in relay in `country_subregion.rs`
export const subregionCodeToName = {
  '21': 'North America',
  '13': 'Central America',
  '29': 'Caribbean',
  '5': 'South America',
  '154': 'Northern Europe',
  '155': 'Western Europe',
  '39': 'Southern Europe',
  '151': 'Eastern Europe',
  '30': 'Eastern Asia',
  '34': 'Southern Asia',
  '35': 'South Eastern Asia',
  '145': 'Western Asia',
  '143': 'Central Asia',
  '15': 'Northern Africa',
  '11': 'Western Africa',
  '17': 'Middle Africa',
  '14': 'Eastern Africa',
  '18': 'Southern Africa',
  '54': 'Melanesia',
  '57': 'Micronesia',
  '61': 'Polynesia',
  '53': 'Australia and New Zealand',
};

export type SubregionCode = keyof typeof subregionCodeToName;
