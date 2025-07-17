import type {PlatformKey} from 'sentry/types/project';
import type {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {Flatten} from 'sentry/utils/types/flatten';
import type {SupportedDatabaseSystem} from 'sentry/views/insights/database/utils/constants';

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
  AGENTS = 'agents',
  MCP = 'mcp',
  MOBILE_UI = 'mobile-ui',
  MOBILE_VITALS = 'mobile-vitals',
  SCREEN_RENDERING = 'screen-rendering',
  SESSIONS = 'sessions',
  OTHER = 'other',
}

export enum SpanMetricsField {
  SPAN_OP = 'span.op',
  NORMALIZED_DESCRIPTION = 'sentry.normalized_description',
  SPAN_DESCRIPTION = 'span.description',
  SPAN_CATEGORY = 'span.category',
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

// TODO: This will be the final field type for EAP spans
export enum SpanFields {
  TRANSACTION = 'transaction',
  IS_TRANSACTION = 'is_transaction',
  CACHE_HIT = 'cache.hit',
  IS_STARRED_TRANSACTION = 'is_starred_transaction',
  ID = 'id',
  TIMESTAMP = 'timestamp',
  SPAN_DURATION = 'span.duration',
  USER = 'user',
  MOBILE_FROZEN_FRAMES = 'mobile.frozen_frames',
  MOBILE_TOTAL_FRAMES = 'mobile.total_frames',
  MOBILE_SLOW_FRAMES = 'mobile.slow_frames',
  FROZEN_FRAMES_RATE = 'measurements.frames_frozen_rate',
  SLOW_FRAMES_RATE = 'measurements.frames_slow_rate',
  RAW_DOMAIN = 'raw_domain',
  PROJECT = 'project',
  MEASUREMENT_HTTP_RESPONSE_CONTENT_LENGTH = 'measurements.http.response_content_length',
  MEASUREMENTS_TIME_TO_INITIAL_DISPLAY = 'measurements.time_to_initial_display',
  MEASUREMENTS_TIME_TO_FILL_DISPLAY = 'measurements.time_to_full_display',
  SPAN_DESCRIPTION = 'span.description',
  SPAN_GROUP = 'span.group',
  SPAN_OP = 'span.op',
  NAME = 'span.name',
  KIND = 'span.kind',
  SPAN_STATUS = 'span.status',
  STATUS_MESSAGE = 'span.status_message',
  RELEASE = 'release',
  PROJECT_ID = 'project.id',
  SPAN_STATUS_CODE = 'span.status_code',
  DEVICE_CLASS = 'device.class',
  SPAN_SYSTEM = 'span.system',
  SPAN_CATEGORY = 'span.category',
  GEN_AI_AGENT_NAME = 'gen_ai.agent.name',
  GEN_AI_REQUEST_MODEL = 'gen_ai.request.model',
  GEN_AI_RESPONSE_MODEL = 'gen_ai.response.model',
  GEN_AI_TOOL_NAME = 'gen_ai.tool.name',
  GEN_AI_USAGE_INPUT_TOKENS = 'gen_ai.usage.input_tokens',
  GEN_AI_USAGE_OUTPUT_TOKENS = 'gen_ai.usage.output_tokens',
  GEN_AI_USAGE_TOTAL_COST = 'gen_ai.usage.total_cost',
  GEN_AI_USAGE_TOTAL_TOKENS = 'gen_ai.usage.total_tokens',
  MCP_TRANSPORT = 'mcp.transport',
  MCP_TOOL_NAME = 'mcp.tool.name',
  MCP_RESOURCE_URI = 'mcp.resource.uri',
  MCP_PROMPT_NAME = 'mcp.prompt.name',
  TRANSACTION_SPAN_ID = 'transaction.span_id',
  SPAN_SELF_TIME = 'span.self_time',
  TRACE = 'trace',
  PROFILE_ID = 'profile_id',
  PROFILEID = 'profile.id',
  REPLAYID = 'replayId',
  REPLAY_ID = 'replay.id',
  LCP_ELEMENT = 'lcp.element',
  CLS_SOURCE = 'cls.source.1',
  CACHE_ITEM_SIZE = 'measurements.cache.item_size',
  SPAN_ID = 'span_id',
  DB_SYSTEM = 'db.system',
  CODE_FILEPATH = 'code.filepath',
  CODE_FUNCTION = 'code.function',
  SDK_NAME = 'sdk.name',
  SDK_VERSION = 'sdk.version',
  PLATFORM = 'platform',
  CODE_LINENO = 'code.lineno',
  APP_START_COLD = 'measurements.app_start_cold',
  APP_START_WARM = 'measurements.app_start_warm',
  SPAN_ACTION = 'span.action',
  SPAN_DOMAIN = 'span.domain',
  NORMALIZED_DESCRIPTION = 'sentry.normalized_description',
  BROWSER_NAME = 'browser.name',
  ENVIRONMENT = 'environment',
  ORIGIN_TRANSACTION = 'origin.transaction',
  TRANSACTION_METHOD = 'transaction.method',
  TRANSACTION_OP = 'transaction.op',
  HTTP_RESPONSE_CONTENT_LENGTH = 'http.response_content_length',
  RESOURCE_RENDER_BLOCKING_STATUS = 'resource.render_blocking_status',
  PROFILER_ID = 'profiler.id',
  TRACE_STATUS = 'trace.status',
  SPAN_AI_PIPELINE_GROUP = 'span.ai.pipeline.group',

  // Messaging fields
  MESSAGING_MESSAGE_ID = 'messaging.message.id',
  MESSAGING_MESSAGE_BODY_SIZE = 'measurements.messaging.message.body.size',
  MESSAGING_MESSAGE_RECEIVE_LATENCY = 'measurements.messaging.message.receive.latency',
  MESSAGING_MESSAGE_RETRY_COUNT = 'measurements.messaging.message.retry.count',
  MESSAGING_MESSAGE_DESTINATION_NAME = 'messaging.destination.name',

  // User fields
  USER_ID = 'user.id',
  USER_IP = 'user.ip',
  USER_EMAIL = 'user.email',
  USER_USERNAME = 'user.username',
  USER_GEO_SUBREGION = 'user.geo.subregion',

  // Web vitals
  INP = 'measurements.inp',
  INP_SCORE = 'measurements.score.inp',
  INP_SCORE_RATIO = 'measurements.score.ratio.inp',
  INP_SCORE_WEIGHT = 'measurements.score.weight.inp',
  LCP = 'measurements.lcp',
  LCP_SCORE = 'measurements.score.lcp',
  LCP_SCORE_RATIO = 'measurements.score.ratio.lcp',
  LCP_SCORE_WEIGHT = 'measurements.score.weight.lcp',
  CLS = 'measurements.cls',
  CLS_SCORE = 'measurements.score.cls',
  CLS_SCORE_RATIO = 'measurements.score.ratio.cls',
  CLS_SCORE_WEIGHT = 'measurements.score.weight.cls',
  TTFB = 'measurements.ttfb',
  TTFB_SCORE = 'measurements.score.ttfb',
  TTFB_SCORE_RATIO = 'measurements.score.ratio.ttfb',
  TTFB_SCORE_WEIGHT = 'measurements.score.weight.ttfb',
  FCP = 'measurements.fcp',
  FCP_SCORE = 'measurements.score.fcp',
  FCP_SCORE_RATIO = 'measurements.score.ratio.fcp',
  FCP_SCORE_WEIGHT = 'measurements.score.weight.fcp',
  TOTAL_SCORE = 'measurements.score.total',
}

type WebVitalsMeasurements =
  | 'measurements.score.cls'
  | 'measurements.score.fcp'
  | 'measurements.score.inp'
  | 'measurements.score.lcp'
  | 'measurements.score.ttfb'
  | 'measurements.score.total';

type SpanBooleanFields =
  | SpanFields.CACHE_HIT
  | SpanFields.IS_TRANSACTION
  | SpanFields.IS_STARRED_TRANSACTION;

type SpanNumberFields =
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
  | SpanMetricsField.SPAN_DURATION
  | SpanFields.MOBILE_FROZEN_FRAMES
  | SpanFields.MOBILE_TOTAL_FRAMES
  | SpanFields.MOBILE_SLOW_FRAMES
  | SpanFields.FROZEN_FRAMES_RATE
  | SpanFields.SLOW_FRAMES_RATE
  | SpanFields.MEASUREMENT_HTTP_RESPONSE_CONTENT_LENGTH
  | SpanFields.MEASUREMENTS_TIME_TO_INITIAL_DISPLAY
  | SpanFields.MEASUREMENTS_TIME_TO_FILL_DISPLAY
  | SpanFields.GEN_AI_USAGE_INPUT_TOKENS
  | SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS
  | SpanFields.GEN_AI_USAGE_TOTAL_TOKENS
  | SpanFields.GEN_AI_USAGE_TOTAL_COST
  | SpanFields.TOTAL_SCORE
  | SpanFields.INP
  | SpanFields.INP_SCORE
  | SpanFields.INP_SCORE_RATIO
  | SpanFields.INP_SCORE_WEIGHT
  | SpanFields.LCP
  | SpanFields.LCP_SCORE
  | SpanFields.LCP_SCORE_RATIO
  | SpanFields.LCP_SCORE_WEIGHT
  | SpanFields.CLS
  | SpanFields.CLS_SCORE
  | SpanFields.CLS_SCORE_RATIO
  | SpanFields.CLS_SCORE_WEIGHT
  | SpanFields.TTFB
  | SpanFields.TTFB_SCORE
  | SpanFields.TTFB_SCORE_RATIO
  | SpanFields.TTFB_SCORE_WEIGHT
  | SpanFields.FCP
  | SpanFields.FCP_SCORE
  | SpanFields.FCP_SCORE_RATIO
  | SpanFields.FCP_SCORE_WEIGHT
  | SpanFields.SPAN_SELF_TIME
  | SpanFields.CACHE_ITEM_SIZE
  | SpanFields.CODE_LINENO
  | SpanFields.APP_START_COLD
  | SpanFields.APP_START_WARM
  | SpanFields.CODE_LINENO;

export type SpanStringFields =
  | SpanMetricsField.RESOURCE_RENDER_BLOCKING_STATUS
  | SpanFields.RAW_DOMAIN
  | SpanFields.ID
  | SpanFields.NAME
  | SpanFields.KIND
  | SpanFields.STATUS_MESSAGE
  | SpanFields.GEN_AI_AGENT_NAME
  | SpanFields.GEN_AI_REQUEST_MODEL
  | SpanFields.GEN_AI_RESPONSE_MODEL
  | SpanFields.GEN_AI_TOOL_NAME
  | SpanFields.MCP_TRANSPORT
  | SpanFields.MCP_TOOL_NAME
  | SpanFields.MCP_RESOURCE_URI
  | SpanFields.MCP_PROMPT_NAME
  | SpanFields.TRACE
  | SpanFields.PROFILEID
  | SpanFields.PROFILE_ID
  | SpanFields.REPLAYID
  | SpanFields.REPLAY_ID
  | SpanFields.USER_EMAIL
  | SpanFields.USER_USERNAME
  | SpanFields.USER_ID
  | SpanFields.USER_IP
  | SpanFields.CLS_SOURCE
  | SpanFields.LCP_ELEMENT
  | SpanFields.SPAN_ID
  | SpanFields.TRANSACTION_SPAN_ID
  | SpanFields.DB_SYSTEM
  | SpanFields.CODE_FILEPATH
  | SpanFields.CODE_FUNCTION
  | SpanFields.SDK_NAME
  | SpanFields.SDK_VERSION
  | SpanFields.DEVICE_CLASS
  | SpanFields.SPAN_ACTION
  | SpanFields.SPAN_DOMAIN
  | SpanFields.NORMALIZED_DESCRIPTION
  | SpanFields.MESSAGING_MESSAGE_BODY_SIZE
  | SpanFields.MESSAGING_MESSAGE_RECEIVE_LATENCY
  | SpanFields.MESSAGING_MESSAGE_RETRY_COUNT
  | SpanFields.MESSAGING_MESSAGE_ID
  | SpanFields.TRACE_STATUS
  | 'span_id'
  | 'span.op'
  | 'span.description'
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
  | 'http.request.method'
  | 'messaging.destination.name'
  | 'command'
  | 'user'
  | 'user.display'
  | 'user.id'
  | 'user.email'
  | 'user.username'
  | 'user.ip'
  | 'replayId'
  | 'profile.id'
  | 'profiler.id'
  | 'thread.id'
  | 'span.domain'; // TODO: With `useInsightsEap` we get a string, without it we get an array

export type SpanMetricsQueryFilters = Partial<Record<SpanStringFields, string>> & {
  [SpanMetricsField.PROJECT_ID]?: string;
  [SpanMetricsField.SPAN_DOMAIN]?: string;
};

type SpanStringArrayFields = 'span.domain';

export const COUNTER_AGGREGATES = ['sum', 'avg', 'min', 'max', 'p100'] as const;
export const DISTRIBUTION_AGGREGATES = ['p50', 'p75', 'p90', 'p95', 'p99'] as const;

export type Aggregate =
  | (typeof COUNTER_AGGREGATES)[number]
  | (typeof DISTRIBUTION_AGGREGATES)[number];

type CounterConditionalAggregate =
  | `sum_if`
  | `avg_if`
  | `count_if`
  | `p50_if`
  | `p75_if`
  | `p90_if`
  | `p95_if`
  | `p99_if`;

type ConditionalAggregate =
  | `avg_if`
  | `division_if`
  | `count_op`
  | `failure_rate_if`
  | 'trace_status_rate'
  | 'time_spent_percentage';

export const SPAN_FUNCTIONS = [
  'sps',
  'spm',
  'epm',
  'tpm',
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

type WebVitalsFunctions = 'performance_score' | 'count_scores' | 'opportunity_score';

type SpanMetricsResponseRaw = {
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
    'ttfd_contribution_rate()': number;
    'ttid_contribution_rate()': number;
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
  } & {
    [Property in SpanNumberFields as `avg_compare(${Property},${string},${string},${string})`]: number;
  };

export type SpanMetricsResponse = Flatten<SpanMetricsResponseRaw>;

export type SpanMetricsProperty = keyof SpanMetricsResponse;

type EAPSpanResponseRaw = {
  [Property in SpanNumberFields as `${Aggregate}(${Property})`]: number;
} & {
  [Property in SpanFunctions as `${Property}()`]: number;
} & {
  [Property in WebVitalsMeasurements as `${WebVitalsFunctions}(${Property})`]: number;
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
      | `${Property}(${string},${string},${string})`
      | `${Property}(${string},${string},${string},${string})`]: number;
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
    'ttfd_contribution_rate()': number;
    'ttid_contribution_rate()': number;
  } & {
    [SpanMetricsField.USER_GEO_SUBREGION]: SubregionCode;
  } & {
    [SpanFields.PLATFORM]: PlatformKey;
  } & {
    [SpanFields.USER_GEO_SUBREGION]: SubregionCode;
  } & {
    [SpanFields.DB_SYSTEM]: SupportedDatabaseSystem;
  } & {
    [SpanFields.SPAN_STATUS]:
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
  } & {
    [Property in SpanFields as `count_unique(${Property})`]: number;
  } & {
    [SpanFields.RESOURCE_RENDER_BLOCKING_STATUS]: '' | 'non-blocking' | 'blocking';
  } & {
    [Property in SpanNumberFields as `${CounterConditionalAggregate}(${Property},${string},${string})`]: number;
  } & {
    [Property in SpanNumberFields as `avg_compare(${Property},${string},${string},${string})`]: number;
  } & {
    [Property in SpanFields as `count_if(${Property},${string})`]: number;
  };

export type EAPSpanResponse = Flatten<EAPSpanResponseRaw>;
export type EAPSpanProperty = keyof EAPSpanResponse; // TODO: rename this to `SpanProperty` when we remove `useInsightsEap`

export enum SpanFunction {
  SPS = 'sps',
  EPM = 'epm',
  TPM = 'tpm',
  COUNT = 'count',
  TIME_SPENT_PERCENTAGE = 'time_spent_percentage',
  HTTP_RESPONSE_COUNT = 'http_response_count',
  HTTP_RESPONSE_RATE = 'http_response_rate',
  CACHE_HIT_RATE = 'cache_hit_rate',
  CACHE_MISS_RATE = 'cache_miss_rate',
  COUNT_OP = 'count_op',
  TRACE_STATUS_RATE = 'trace_status_rate',
  FAILURE_RATE_IF = 'failure_rate_if',
}

export type SpanQueryFilters = Partial<Record<SpanStringFields, string>> & {
  is_transaction?: 'true' | 'false';
  [SpanFields.PROJECT_ID]?: string;
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

export type SearchHook = {search: MutableSearch; enabled?: boolean};
