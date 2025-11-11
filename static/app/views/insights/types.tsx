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
  AGENT_MODELS = 'agent-models',
  AGENT_TOOLS = 'agent-tools',
  AI_GENERATIONS = 'ai-generations',
  MCP_TOOLS = 'mcp-tools',
  MCP_RESOURCES = 'mcp-resources',
  MCP_PROMPTS = 'mcp-prompts',
  MOBILE_UI = 'mobile-ui',
  MOBILE_VITALS = 'mobile-vitals',
  SCREEN_RENDERING = 'screen-rendering',
  SESSIONS = 'sessions',
  OTHER = 'other',
}

// All fields here, should end up in `SpanResponse`
// typically via SpanStringFields, SpanNumberFields, etc
export enum SpanFields {
  // Common fields
  ID = 'id',
  SPAN_ID = 'span_id',
  TRANSACTION = 'transaction',
  IS_TRANSACTION = 'is_transaction',
  IS_STARRED_TRANSACTION = 'is_starred_transaction',
  TIMESTAMP = 'timestamp',
  SPAN_DURATION = 'span.duration',
  USER = 'user',
  RAW_DOMAIN = 'raw_domain',
  SPAN_DESCRIPTION = 'span.description',
  SPAN_GROUP = 'span.group',
  SPAN_OP = 'span.op',
  NAME = 'span.name',
  KIND = 'span.kind',
  SPAN_STATUS = 'span.status',
  STATUS_MESSAGE = 'span.status.message',
  RELEASE = 'release',
  PROJECT_ID = 'project.id',
  SPAN_STATUS_CODE = 'span.status_code',
  PROJECT = 'project',
  SPAN_SYSTEM = 'span.system',
  SPAN_CATEGORY = 'span.category',
  TRANSACTION_SPAN_ID = 'transaction.span_id',
  SPAN_SELF_TIME = 'span.self_time',
  TRACE = 'trace',
  PROFILE_ID = 'profile_id',
  PROFILEID = 'profile.id',
  REPLAYID = 'replayId',
  REPLAY_ID = 'replay.id',
  CODE_FILEPATH = 'code.filepath',
  CODE_FUNCTION = 'code.function',
  SDK_NAME = 'sdk.name',
  SDK_VERSION = 'sdk.version',
  PLATFORM = 'platform',
  CODE_LINENO = 'code.lineno',
  SPAN_ACTION = 'span.action',
  SPAN_DOMAIN = 'span.domain',
  NORMALIZED_DESCRIPTION = 'sentry.normalized_description',
  BROWSER_NAME = 'browser.name',
  ENVIRONMENT = 'environment',
  ORIGIN_TRANSACTION = 'origin.transaction',
  TRANSACTION_METHOD = 'transaction.method',
  TRANSACTION_OP = 'transaction.op',
  PROFILER_ID = 'profiler.id',
  TRACE_STATUS = 'trace.status',
  PRECISE_START_TS = 'precise.start_ts',
  PRECISE_FINISH_TS = 'precise.finish_ts',
  OS_NAME = 'os.name',
  THREAD_ID = 'thread.id',
  COMMAND = 'command',
  REQUEST_METHOD = 'request.method',

  // Cache fields
  CACHE_HIT = 'cache.hit',
  CACHE_ITEM_SIZE = 'cache.item_size',

  // HTTP/Resource fields
  HTTP_REQUEST_METHOD = 'http.request.method',
  HTTP_DECODED_RESPONSE_CONTENT_LENGTH = 'http.decoded_response_content_length',
  HTTP_RESPONSE_TRANSFER_SIZE = 'http.response_transfer_size',
  MEASUREMENT_HTTP_RESPONSE_CONTENT_LENGTH = 'measurements.http.response_content_length',
  HTTP_RESPONSE_CONTENT_LENGTH = 'http.response_content_length',
  RESOURCE_RENDER_BLOCKING_STATUS = 'resource.render_blocking_status',
  FILE_EXTENSION = 'file_extension',

  // AI fields
  GEN_AI_AGENT_NAME = 'gen_ai.agent.name',
  GEN_AI_FUNCTION_ID = 'gen_ai.function_id',
  GEN_AI_REQUEST_MODEL = 'gen_ai.request.model',
  GEN_AI_REQUEST_MESSAGES = 'gen_ai.request.messages',
  GEN_AI_RESPONSE_TEXT = 'gen_ai.response.text',
  GEN_AI_RESPONSE_OBJECT = 'gen_ai.response.object',
  GEN_AI_RESPONSE_MODEL = 'gen_ai.response.model',
  GEN_AI_TOOL_NAME = 'gen_ai.tool.name',
  GEN_AI_COST_INPUT_TOKENS = 'gen_ai.cost.input_tokens',
  GEN_AI_COST_OUTPUT_TOKENS = 'gen_ai.cost.output_tokens',
  GEN_AI_COST_TOTAL_TOKENS = 'gen_ai.cost.total_tokens',
  GEN_AI_USAGE_INPUT_TOKENS = 'gen_ai.usage.input_tokens',
  GEN_AI_USAGE_INPUT_TOKENS_CACHED = 'gen_ai.usage.input_tokens.cached',
  GEN_AI_USAGE_OUTPUT_TOKENS = 'gen_ai.usage.output_tokens',
  GEN_AI_USAGE_OUTPUT_TOKENS_REASONING = 'gen_ai.usage.output_tokens.reasoning',
  GEN_AI_USAGE_TOTAL_COST = 'gen_ai.usage.total_cost',
  GEN_AI_USAGE_TOTAL_TOKENS = 'gen_ai.usage.total_tokens',
  GEN_AI_OPERATION_TYPE = 'gen_ai.operation.type',
  MCP_CLIENT_NAME = 'mcp.client.name',
  MCP_TRANSPORT = 'mcp.transport',
  MCP_TOOL_NAME = 'mcp.tool.name',
  MCP_RESOURCE_URI = 'mcp.resource.uri',
  MCP_PROMPT_NAME = 'mcp.prompt.name',
  SPAN_AI_PIPELINE_GROUP = 'span.ai.pipeline.group',
  AI_TOTAL_COST = 'ai.total_cost',
  AI_TOTAL_TOKENS_USED = 'ai.total_tokens.used',

  // DB fields
  DB_SYSTEM = 'db.system', // TODO: this is a duplicate of `SPAN_SYSTEM`

  // Mobile fields
  MEASUREMENTS_TIME_TO_INITIAL_DISPLAY = 'measurements.time_to_initial_display',
  MEASUREMENTS_TIME_TO_FILL_DISPLAY = 'measurements.time_to_full_display',
  MOBILE_FROZEN_FRAMES = 'mobile.frozen_frames',
  MOBILE_TOTAL_FRAMES = 'mobile.total_frames',
  MOBILE_SLOW_FRAMES = 'mobile.slow_frames',
  FROZEN_FRAMES_RATE = 'measurements.frames_frozen_rate',
  SLOW_FRAMES_RATE = 'measurements.frames_slow_rate',
  DEVICE_CLASS = 'device.class',
  APP_START_COLD = 'measurements.app_start_cold',
  APP_START_WARM = 'measurements.app_start_warm',
  MOBILE_FRAMES_DELAY = 'mobile.frames_delay',
  APP_START_TYPE = 'app_start_type',
  TTID = 'sentry.ttid',
  TTFD = 'sentry.ttfd',

  // Messaging fields
  MESSAGING_MESSAGE_ID = 'messaging.message.id',
  MESSAGING_MESSAGE_BODY_SIZE = 'measurements.messaging.message.body.size',
  MESSAGING_MESSAGE_RECEIVE_LATENCY = 'messaging.message.receive.latency',
  MESSAGING_MESSAGE_RETRY_COUNT = 'measurements.messaging.message.retry.count',
  MESSAGING_MESSAGE_DESTINATION_NAME = 'messaging.destination.name',

  // User fields
  USER_ID = 'user.id',
  USER_IP = 'user.ip',
  USER_EMAIL = 'user.email',
  USER_USERNAME = 'user.username',
  USER_GEO_SUBREGION = 'user.geo.subregion',
  USER_DISPLAY = 'user.display', // Note: this is not implemented yet, waiting for EAP-123

  // Web vital fields
  LCP_ELEMENT = 'lcp.element',
  CLS_SOURCE = 'cls.source.1',
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

type SpanBooleanFields =
  | SpanFields.CACHE_HIT
  | SpanFields.IS_TRANSACTION
  | SpanFields.IS_STARRED_TRANSACTION;

export type SpanNumberFields =
  | SpanFields.AI_TOTAL_COST
  | SpanFields.AI_TOTAL_TOKENS_USED
  | SpanFields.SPAN_SELF_TIME
  | SpanFields.SPAN_DURATION
  | SpanFields.HTTP_DECODED_RESPONSE_CONTENT_LENGTH
  | SpanFields.HTTP_RESPONSE_CONTENT_LENGTH
  | SpanFields.HTTP_RESPONSE_TRANSFER_SIZE
  | SpanFields.MESSAGING_MESSAGE_RECEIVE_LATENCY
  | SpanFields.CACHE_ITEM_SIZE
  | SpanFields.MOBILE_FRAMES_DELAY
  | SpanFields.MOBILE_FROZEN_FRAMES
  | SpanFields.MOBILE_TOTAL_FRAMES
  | SpanFields.MOBILE_SLOW_FRAMES
  | SpanFields.FROZEN_FRAMES_RATE
  | SpanFields.SLOW_FRAMES_RATE
  | SpanFields.MEASUREMENT_HTTP_RESPONSE_CONTENT_LENGTH
  | SpanFields.MEASUREMENTS_TIME_TO_INITIAL_DISPLAY
  | SpanFields.MEASUREMENTS_TIME_TO_FILL_DISPLAY
  | SpanFields.GEN_AI_USAGE_INPUT_TOKENS
  | SpanFields.GEN_AI_USAGE_INPUT_TOKENS_CACHED
  | SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS
  | SpanFields.GEN_AI_USAGE_OUTPUT_TOKENS_REASONING
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
  | SpanFields.CODE_LINENO
  | SpanFields.APP_START_COLD
  | SpanFields.APP_START_WARM
  | SpanFields.PRECISE_START_TS
  | SpanFields.PRECISE_FINISH_TS
  | SpanFields.THREAD_ID
  | SpanFields.PROJECT_ID
  | SpanFields.TTID
  | SpanFields.TTFD;

// TODO: Enforce that these fields all come from SpanFields
export type SpanStringFields =
  | SpanFields.COMMAND
  | SpanFields.REQUEST_METHOD
  | SpanFields.HTTP_REQUEST_METHOD
  | SpanFields.RESOURCE_RENDER_BLOCKING_STATUS
  | SpanFields.RAW_DOMAIN
  | SpanFields.ID
  | SpanFields.SPAN_ID
  | SpanFields.NAME
  | SpanFields.KIND
  | SpanFields.STATUS_MESSAGE
  | SpanFields.GEN_AI_AGENT_NAME
  | SpanFields.GEN_AI_REQUEST_MODEL
  | SpanFields.GEN_AI_REQUEST_MESSAGES
  | SpanFields.GEN_AI_RESPONSE_TEXT
  | SpanFields.GEN_AI_RESPONSE_OBJECT
  | SpanFields.GEN_AI_RESPONSE_MODEL
  | SpanFields.GEN_AI_TOOL_NAME
  | SpanFields.MCP_CLIENT_NAME
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
  | SpanFields.APP_START_TYPE
  | SpanFields.FILE_EXTENSION
  | SpanFields.SPAN_OP
  | SpanFields.SPAN_DESCRIPTION
  | SpanFields.SPAN_GROUP
  | SpanFields.SPAN_CATEGORY
  | SpanFields.SPAN_SYSTEM
  | SpanFields.TIMESTAMP
  | SpanFields.TRANSACTION
  | SpanFields.TRANSACTION_METHOD
  | SpanFields.RELEASE
  | SpanFields.OS_NAME
  | SpanFields.SPAN_STATUS_CODE
  | SpanFields.SPAN_AI_PIPELINE_GROUP
  | SpanFields.PROJECT
  | SpanFields.MESSAGING_MESSAGE_DESTINATION_NAME
  | SpanFields.USER
  | SpanFields.PROFILER_ID
  | SpanFields.USER_DISPLAY;

type WebVitalsMeasurements =
  | SpanFields.CLS_SCORE
  | SpanFields.FCP_SCORE
  | SpanFields.INP_SCORE
  | SpanFields.LCP_SCORE
  | SpanFields.TTFB_SCORE
  | SpanFields.TOTAL_SCORE;

export enum SpanFunction {
  // Basic functions
  TPM = 'tpm',
  EPM = 'epm',
  EPS = 'eps',
  SUM = 'sum',
  AVG = 'avg',
  MIN = 'min',
  MAX = 'max',
  P100 = 'p100',
  P50 = 'p50',
  P75 = 'p75',
  P90 = 'p90',
  P95 = 'p95',
  P99 = 'p99',
  COUNT = 'count',

  // Basic conditionals
  P50_IF = 'p50_if',
  P75_IF = 'p75_if',
  P90_IF = 'p90_if',
  P95_IF = 'p95_if',
  P99_IF = 'p99_if',
  SUM_IF = 'sum_if',
  AVG_IF = 'avg_if',
  COUNT_IF = 'count_if',
  DIVISION_IF = 'division_if',

  // Advanced functions
  TIME_SPENT_PERCENTAGE = 'time_spent_percentage',
  HTTP_RESPONSE_COUNT = 'http_response_count',
  HTTP_RESPONSE_RATE = 'http_response_rate',
  CACHE_HIT_RATE = 'cache_hit_rate',
  CACHE_MISS_RATE = 'cache_miss_rate',
  COUNT_OP = 'count_op',
  TRACE_STATUS_RATE = 'trace_status_rate',
  FAILURE_RATE_IF = 'failure_rate_if',
  PERFORMANCE_SCORE = 'performance_score',
  COUNT_SCORES = 'count_scores',
  OPPORTUNITY_SCORE = 'opportunity_score',
  FAILURE_RATE = 'failure_rate',
}

export const COUNTER_AGGREGATES = [
  SpanFunction.SUM,
  SpanFunction.AVG,
  SpanFunction.MIN,
  SpanFunction.MAX,
  SpanFunction.P100,
  SpanFunction.COUNT,
] as const;

export const DISTRIBUTION_AGGREGATES = [
  SpanFunction.P50,
  SpanFunction.P75,
  SpanFunction.P90,
  SpanFunction.P95,
  SpanFunction.P99,
] as const;

export type Aggregate =
  | (typeof COUNTER_AGGREGATES)[number]
  | (typeof DISTRIBUTION_AGGREGATES)[number];

type CounterConditionalAggregate =
  | SpanFunction.SUM_IF
  | SpanFunction.AVG_IF
  | SpanFunction.COUNT_IF
  | SpanFunction.P50_IF
  | SpanFunction.P75_IF
  | SpanFunction.P90_IF
  | SpanFunction.P95_IF
  | SpanFunction.P99_IF;

type ConditionalAggregate =
  | SpanFunction.DIVISION_IF
  | SpanFunction.COUNT_OP
  | SpanFunction.FAILURE_RATE_IF
  | SpanFunction.TRACE_STATUS_RATE
  | SpanFunction.TIME_SPENT_PERCENTAGE;

export const SPAN_FUNCTIONS = [
  SpanFunction.EPM,
  SpanFunction.TPM,
  SpanFunction.COUNT,
  SpanFunction.TIME_SPENT_PERCENTAGE,
  SpanFunction.HTTP_RESPONSE_RATE,
  SpanFunction.HTTP_RESPONSE_COUNT,
  SpanFunction.CACHE_HIT_RATE,
  SpanFunction.CACHE_MISS_RATE,
  SpanFunction.SUM,
  SpanFunction.FAILURE_RATE,
] as const;

type BreakpointCondition = 'less' | 'greater';

// TODO: Check if these functions are still used, they aren't available in the backend
type RegressionFunctions = [
  `regression_score(${string},${string})`,
  `avg_by_timestamp(${string},${BreakpointCondition},${string})`,
  `epm_by_timestamp(${BreakpointCondition},${string})`,
][number];

type SpanAnyFunction = `any(${string})`;

export type SpanFunctions = (typeof SPAN_FUNCTIONS)[number];

type WebVitalsFunctions =
  | SpanFunction.PERFORMANCE_SCORE
  | SpanFunction.COUNT_SCORES
  | SpanFunction.OPPORTUNITY_SCORE;

type HttpResponseFunctions =
  | SpanFunction.HTTP_RESPONSE_COUNT
  | SpanFunction.HTTP_RESPONSE_RATE;

type CustomResponseFields = {
  [SpanFields.USER_GEO_SUBREGION]: SubregionCode;
  [SpanFields.PLATFORM]: PlatformKey;
  [SpanFields.DB_SYSTEM]: SupportedDatabaseSystem;
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
  [SpanFields.RESOURCE_RENDER_BLOCKING_STATUS]: '' | 'non-blocking' | 'blocking';
};

type SpanResponseRaw = {
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
  [Property in SpanBooleanFields as `${Property}`]: boolean;
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
    [Property in HttpResponseFunctions as `${Property}(${number})`]: number;
  } & {
    'ttfd_contribution_rate()': number;
    'ttid_contribution_rate()': number;
  } & CustomResponseFields & {
    [Property in SpanFields as `count_unique(${Property})`]: number;
  } & {
    // TODO: The middle arg represents the operator, however adding this creastes too large of a map and tsc fails
    [Property in SpanNumberFields as `${CounterConditionalAggregate}(${Property},${string},${string},${string})`]: number;
  } & {
    [Property in SpanNumberFields as `avg_compare(${Property},${string},${string},${string})`]: number;
  } & {
    [Property in SpanFields as `${SpanFunction.COUNT_IF}(${Property},${string},${string})`]: number;
  };

export type SpanResponse = Flatten<SpanResponseRaw>;
export type SpanProperty = keyof SpanResponse;

export type SpanQueryFilters = Partial<Record<SpanStringFields, string>> & {
  is_transaction?: 'true' | 'false';
  [SpanFields.PROJECT_ID]?: string;
};

export enum ErrorField {
  ISSUE = 'issue',
  ID = 'id',
  ISSUE_ID = 'issue.id',
  TITLE = 'title',
}

enum ErrorFunction {
  COUNT = 'count',
  EPM = 'epm',
  LAST_SEEN = 'last_seen',
}

type ErrorStringFields = ErrorField.TITLE | ErrorField.ID | ErrorField.ISSUE_ID;
type ErrorNumberFields = ErrorField.ISSUE;

type NoArgErrorFunction =
  | ErrorFunction.COUNT
  | ErrorFunction.EPM
  | ErrorFunction.LAST_SEEN;

type ErrorResponseRaw = {
  [Property in ErrorStringFields as `${Property}`]: string;
} & {
  [Property in ErrorNumberFields as `${Property}`]: number;
} & {
  [Property in NoArgErrorFunction as `${Property}()`]: number;
};

export type ErrorResponse = Flatten<ErrorResponseRaw>;
export type ErrorProperty = keyof ErrorResponse;

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
