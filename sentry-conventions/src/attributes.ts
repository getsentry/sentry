/* eslint-disable */

export enum AttributeType {
  STRING = 'string',
  BOOLEAN = 'boolean',
  INTEGER = 'integer',
  DOUBLE = 'double',
  STRING_ARRAY = 'string[]',
  BOOLEAN_ARRAY = 'boolean[]',
  INTEGER_ARRAY = 'integer[]',
  DOUBLE_ARRAY = 'double[]',
}

export enum IsPii {
  TRUE = 'true',
  FALSE = 'false',
  MAYBE = 'maybe',
}

export interface PiiInfo {
  /** Whether the attribute contains PII */
  isPii: IsPii;
  /** Reason why it has PII or not */
  reason?: string;
}

export enum DeprecationStatus {
  BACKFILL = 'backfill',
  NORMALIZE = 'normalize',
}

export interface DeprecationInfo {
  /** Reason for deprecation */
  reason?: string;
  /** What this attribute was replaced with */
  replacement?: string;
}

export interface AttributeMetadata {
  /** A description of the attribute */
  brief: string;
  /** Whether the attribute is defined in OpenTelemetry Semantic Conventions */
  isInOtel: boolean;
  /** If an attribute can have PII */
  pii: PiiInfo;
  /** The type of the attribute value */
  type: AttributeType;
  /** If there are attributes that alias to this attribute */
  aliases?: AttributeName[];
  /** If an attribute was deprecated, and what it was replaced with */
  deprecation?: DeprecationInfo;
  /** An example value of the attribute */
  example?: AttributeValue;
  /** If an attribute has a dynamic suffix */
  hasDynamicSuffix?: boolean;
  /** If an attribute is SDK specific, list the SDKs that use this attribute */
  sdks?: string[];
}

export enum AttributeName {
  AI_CITATIONS = 'ai.citations',
  AI_COMPLETION_TOKENS_USED = 'ai.completion_tokens.used',
  AI_DOCUMENTS = 'ai.documents',
  AI_FINISH_REASON = 'ai.finish_reason',
  AI_FREQUENCY_PENALTY = 'ai.frequency_penalty',
  AI_FUNCTION_CALL = 'ai.function_call',
  AI_GENERATION_ID = 'ai.generation_id',
  AI_INPUT_MESSAGES = 'ai.input_messages',
  AI_IS_SEARCH_REQUIRED = 'ai.is_search_required',
  AI_METADATA = 'ai.metadata',
  AI_MODEL_PROVIDER = 'ai.model.provider',
  AI_MODEL_ID = 'ai.model_id',
  AI_PIPELINE_NAME = 'ai.pipeline.name',
  AI_PREAMBLE = 'ai.preamble',
  AI_PRESENCE_PENALTY = 'ai.presence_penalty',
  AI_PROMPT_TOKENS_USED = 'ai.prompt_tokens.used',
  AI_RAW_PROMPTING = 'ai.raw_prompting',
  AI_RESPONSE_FORMAT = 'ai.response_format',
  AI_RESPONSES = 'ai.responses',
  AI_SEARCH_QUERIES = 'ai.search_queries',
  AI_SEARCH_RESULTS = 'ai.search_results',
  AI_SEED = 'ai.seed',
  AI_STREAMING = 'ai.streaming',
  AI_TAGS = 'ai.tags',
  AI_TEMPERATURE = 'ai.temperature',
  AI_TEXTS = 'ai.texts',
  AI_TOOL_CALLS = 'ai.tool_calls',
  AI_TOOLS = 'ai.tools',
  AI_TOP_K = 'ai.top_k',
  AI_TOP_P = 'ai.top_p',
  AI_TOTAL_COST = 'ai.total_cost',
  AI_TOTAL_TOKENS_USED = 'ai.total_tokens.used',
  AI_WARNINGS = 'ai.warnings',
  APP_START_TYPE = 'app_start_type',
  BLOCKED_MAIN_THREAD = 'blocked_main_thread',
  BROWSER_NAME = 'browser.name',
  BROWSER_REPORT_TYPE = 'browser.report.type',
  BROWSER_SCRIPT_INVOKER = 'browser.script.invoker',
  BROWSER_SCRIPT_INVOKER_TYPE = 'browser.script.invoker_type',
  BROWSER_SCRIPT_SOURCE_CHAR_POSITION = 'browser.script.source_char_position',
  BROWSER_VERSION = 'browser.version',
  CACHE_HIT = 'cache.hit',
  CACHE_ITEM_SIZE = 'cache.item_size',
  CACHE_KEY = 'cache.key',
  CACHE_OPERATION = 'cache.operation',
  CACHE_TTL = 'cache.ttl',
  CHANNEL = 'channel',
  CLIENT_ADDRESS = 'client.address',
  CLIENT_PORT = 'client.port',
  CLOUDFLARE_D1_DURATION = 'cloudflare.d1.duration',
  CLOUDFLARE_D1_ROWS_READ = 'cloudflare.d1.rows_read',
  CLOUDFLARE_D1_ROWS_WRITTEN = 'cloudflare.d1.rows_written',
  CODE_FILE_PATH = 'code.file.path',
  CODE_FILEPATH = 'code.filepath',
  CODE_FUNCTION = 'code.function',
  CODE_FUNCTION_NAME = 'code.function.name',
  CODE_LINE_NUMBER = 'code.line.number',
  CODE_LINENO = 'code.lineno',
  CODE_NAMESPACE = 'code.namespace',
  DB_COLLECTION_NAME = 'db.collection.name',
  DB_NAME = 'db.name',
  DB_NAMESPACE = 'db.namespace',
  DB_OPERATION = 'db.operation',
  DB_OPERATION_NAME = 'db.operation.name',
  DB_QUERY_PARAMETER_KEY = 'db.query.parameter.<key>',
  DB_QUERY_SUMMARY = 'db.query.summary',
  DB_QUERY_TEXT = 'db.query.text',
  DB_REDIS_CONNECTION = 'db.redis.connection',
  DB_REDIS_PARAMETERS = 'db.redis.parameters',
  DB_SQL_BINDINGS = 'db.sql.bindings',
  DB_STATEMENT = 'db.statement',
  DB_SYSTEM = 'db.system',
  DB_SYSTEM_NAME = 'db.system.name',
  DB_USER = 'db.user',
  DEVICE_BRAND = 'device.brand',
  DEVICE_FAMILY = 'device.family',
  DEVICE_MODEL = 'device.model',
  ENVIRONMENT = 'environment',
  ERROR_TYPE = 'error.type',
  EVENT_ID = 'event.id',
  EVENT_NAME = 'event.name',
  EXCEPTION_ESCAPED = 'exception.escaped',
  EXCEPTION_MESSAGE = 'exception.message',
  EXCEPTION_STACKTRACE = 'exception.stacktrace',
  EXCEPTION_TYPE = 'exception.type',
  FAAS_COLDSTART = 'faas.coldstart',
  FAAS_CRON = 'faas.cron',
  FAAS_TIME = 'faas.time',
  FAAS_TRIGGER = 'faas.trigger',
  FLAG_EVALUATION_KEY = 'flag.evaluation.<key>',
  FRAMES_DELAY = 'frames.delay',
  FRAMES_FROZEN = 'frames.frozen',
  FRAMES_SLOW = 'frames.slow',
  FRAMES_TOTAL = 'frames.total',
  FS_ERROR = 'fs_error',
  GEN_AI_AGENT_NAME = 'gen_ai.agent.name',
  GEN_AI_ASSISTANT_MESSAGE = 'gen_ai.assistant.message',
  GEN_AI_CHOICE = 'gen_ai.choice',
  GEN_AI_COST_INPUT_TOKENS = 'gen_ai.cost.input_tokens',
  GEN_AI_COST_OUTPUT_TOKENS = 'gen_ai.cost.output_tokens',
  GEN_AI_COST_TOTAL_TOKENS = 'gen_ai.cost.total_tokens',
  GEN_AI_OPERATION_NAME = 'gen_ai.operation.name',
  GEN_AI_OPERATION_TYPE = 'gen_ai.operation.type',
  GEN_AI_PIPELINE_NAME = 'gen_ai.pipeline.name',
  GEN_AI_PROMPT = 'gen_ai.prompt',
  GEN_AI_REQUEST_AVAILABLE_TOOLS = 'gen_ai.request.available_tools',
  GEN_AI_REQUEST_FREQUENCY_PENALTY = 'gen_ai.request.frequency_penalty',
  GEN_AI_REQUEST_MAX_TOKENS = 'gen_ai.request.max_tokens',
  GEN_AI_REQUEST_MESSAGES = 'gen_ai.request.messages',
  GEN_AI_REQUEST_MODEL = 'gen_ai.request.model',
  GEN_AI_REQUEST_PRESENCE_PENALTY = 'gen_ai.request.presence_penalty',
  GEN_AI_REQUEST_SEED = 'gen_ai.request.seed',
  GEN_AI_REQUEST_TEMPERATURE = 'gen_ai.request.temperature',
  GEN_AI_REQUEST_TOP_K = 'gen_ai.request.top_k',
  GEN_AI_REQUEST_TOP_P = 'gen_ai.request.top_p',
  GEN_AI_RESPONSE_FINISH_REASONS = 'gen_ai.response.finish_reasons',
  GEN_AI_RESPONSE_ID = 'gen_ai.response.id',
  GEN_AI_RESPONSE_MODEL = 'gen_ai.response.model',
  GEN_AI_RESPONSE_STREAMING = 'gen_ai.response.streaming',
  GEN_AI_RESPONSE_TEXT = 'gen_ai.response.text',
  GEN_AI_RESPONSE_TOKENS_PER_SECOND = 'gen_ai.response.tokens_per_second',
  GEN_AI_RESPONSE_TOOL_CALLS = 'gen_ai.response.tool_calls',
  GEN_AI_SYSTEM = 'gen_ai.system',
  GEN_AI_SYSTEM_MESSAGE = 'gen_ai.system.message',
  GEN_AI_TOOL_DESCRIPTION = 'gen_ai.tool.description',
  GEN_AI_TOOL_INPUT = 'gen_ai.tool.input',
  GEN_AI_TOOL_MESSAGE = 'gen_ai.tool.message',
  GEN_AI_TOOL_NAME = 'gen_ai.tool.name',
  GEN_AI_TOOL_OUTPUT = 'gen_ai.tool.output',
  GEN_AI_TOOL_TYPE = 'gen_ai.tool.type',
  GEN_AI_USAGE_COMPLETION_TOKENS = 'gen_ai.usage.completion_tokens',
  GEN_AI_USAGE_INPUT_TOKENS = 'gen_ai.usage.input_tokens',
  GEN_AI_USAGE_INPUT_TOKENS_CACHED = 'gen_ai.usage.input_tokens.cached',
  GEN_AI_USAGE_OUTPUT_TOKENS = 'gen_ai.usage.output_tokens',
  GEN_AI_USAGE_OUTPUT_TOKENS_REASONING = 'gen_ai.usage.output_tokens.reasoning',
  GEN_AI_USAGE_PROMPT_TOKENS = 'gen_ai.usage.prompt_tokens',
  GEN_AI_USAGE_TOTAL_COST = 'gen_ai.usage.total_cost',
  GEN_AI_USAGE_TOTAL_TOKENS = 'gen_ai.usage.total_tokens',
  GEN_AI_USER_MESSAGE = 'gen_ai.user.message',
  GRAPHQL_OPERATION_NAME = 'graphql.operation.name',
  GRAPHQL_OPERATION_TYPE = 'graphql.operation.type',
  HTTP_CLIENT_IP = 'http.client_ip',
  HTTP_DECODED_RESPONSE_CONTENT_LENGTH = 'http.decoded_response_content_length',
  HTTP_FLAVOR = 'http.flavor',
  HTTP_FRAGMENT = 'http.fragment',
  HTTP_HOST = 'http.host',
  HTTP_METHOD = 'http.method',
  HTTP_QUERY = 'http.query',
  HTTP_REQUEST_CONNECT_START = 'http.request.connect_start',
  HTTP_REQUEST_CONNECTION_END = 'http.request.connection_end',
  HTTP_REQUEST_DOMAIN_LOOKUP_END = 'http.request.domain_lookup_end',
  HTTP_REQUEST_DOMAIN_LOOKUP_START = 'http.request.domain_lookup_start',
  HTTP_REQUEST_FETCH_START = 'http.request.fetch_start',
  HTTP_REQUEST_HEADER_KEY = 'http.request.header.<key>',
  HTTP_REQUEST_METHOD = 'http.request.method',
  HTTP_REQUEST_REDIRECT_END = 'http.request.redirect_end',
  HTTP_REQUEST_REDIRECT_START = 'http.request.redirect_start',
  HTTP_REQUEST_REQUEST_START = 'http.request.request_start',
  HTTP_REQUEST_RESEND_COUNT = 'http.request.resend_count',
  HTTP_REQUEST_RESPONSE_END = 'http.request.response_end',
  HTTP_REQUEST_RESPONSE_START = 'http.request.response_start',
  HTTP_REQUEST_SECURE_CONNECTION_START = 'http.request.secure_connection_start',
  HTTP_REQUEST_TIME_TO_FIRST_BYTE = 'http.request.time_to_first_byte',
  HTTP_REQUEST_WORKER_START = 'http.request.worker_start',
  HTTP_RESPONSE_BODY_SIZE = 'http.response.body.size',
  HTTP_RESPONSE_HEADER_KEY = 'http.response.header.<key>',
  HTTP_RESPONSE_HEADER_CONTENT_LENGTH = 'http.response.header.content-length',
  HTTP_RESPONSE_SIZE = 'http.response.size',
  HTTP_RESPONSE_STATUS_CODE = 'http.response.status_code',
  HTTP_RESPONSE_CONTENT_LENGTH = 'http.response_content_length',
  HTTP_RESPONSE_TRANSFER_SIZE = 'http.response_transfer_size',
  HTTP_ROUTE = 'http.route',
  HTTP_SCHEME = 'http.scheme',
  HTTP_SERVER_NAME = 'http.server_name',
  HTTP_STATUS_CODE = 'http.status_code',
  HTTP_TARGET = 'http.target',
  HTTP_URL = 'http.url',
  HTTP_USER_AGENT = 'http.user_agent',
  ID = 'id',
  JVM_GC_ACTION = 'jvm.gc.action',
  JVM_GC_NAME = 'jvm.gc.name',
  JVM_MEMORY_POOL_NAME = 'jvm.memory.pool.name',
  JVM_MEMORY_TYPE = 'jvm.memory.type',
  JVM_THREAD_DAEMON = 'jvm.thread.daemon',
  JVM_THREAD_STATE = 'jvm.thread.state',
  LCP_ELEMENT = 'lcp.element',
  LCP_ID = 'lcp.id',
  LCP_SIZE = 'lcp.size',
  LCP_URL = 'lcp.url',
  LOGGER_NAME = 'logger.name',
  MESSAGING_DESTINATION_CONNECTION = 'messaging.destination.connection',
  MESSAGING_DESTINATION_NAME = 'messaging.destination.name',
  MESSAGING_MESSAGE_BODY_SIZE = 'messaging.message.body.size',
  MESSAGING_MESSAGE_ENVELOPE_SIZE = 'messaging.message.envelope.size',
  MESSAGING_MESSAGE_ID = 'messaging.message.id',
  MESSAGING_MESSAGE_RECEIVE_LATENCY = 'messaging.message.receive.latency',
  MESSAGING_MESSAGE_RETRY_COUNT = 'messaging.message.retry.count',
  MESSAGING_OPERATION_TYPE = 'messaging.operation.type',
  MESSAGING_SYSTEM = 'messaging.system',
  METHOD = 'method',
  NAVIGATION_TYPE = 'navigation.type',
  NEL_ELAPSED_TIME = 'nel.elapsed_time',
  NEL_PHASE = 'nel.phase',
  NEL_REFERRER = 'nel.referrer',
  NEL_SAMPLING_FUNCTION = 'nel.sampling_function',
  NEL_TYPE = 'nel.type',
  NET_HOST_IP = 'net.host.ip',
  NET_HOST_NAME = 'net.host.name',
  NET_HOST_PORT = 'net.host.port',
  NET_PEER_IP = 'net.peer.ip',
  NET_PEER_NAME = 'net.peer.name',
  NET_PEER_PORT = 'net.peer.port',
  NET_PROTOCOL_NAME = 'net.protocol.name',
  NET_PROTOCOL_VERSION = 'net.protocol.version',
  NET_SOCK_FAMILY = 'net.sock.family',
  NET_SOCK_HOST_ADDR = 'net.sock.host.addr',
  NET_SOCK_HOST_PORT = 'net.sock.host.port',
  NET_SOCK_PEER_ADDR = 'net.sock.peer.addr',
  NET_SOCK_PEER_NAME = 'net.sock.peer.name',
  NET_SOCK_PEER_PORT = 'net.sock.peer.port',
  NET_TRANSPORT = 'net.transport',
  NETWORK_LOCAL_ADDRESS = 'network.local.address',
  NETWORK_LOCAL_PORT = 'network.local.port',
  NETWORK_PEER_ADDRESS = 'network.peer.address',
  NETWORK_PEER_PORT = 'network.peer.port',
  NETWORK_PROTOCOL_NAME = 'network.protocol.name',
  NETWORK_PROTOCOL_VERSION = 'network.protocol.version',
  NETWORK_TRANSPORT = 'network.transport',
  NETWORK_TYPE = 'network.type',
  OS_BUILD_ID = 'os.build_id',
  OS_DESCRIPTION = 'os.description',
  OS_NAME = 'os.name',
  OS_TYPE = 'os.type',
  OS_VERSION = 'os.version',
  OTEL_SCOPE_NAME = 'otel.scope.name',
  OTEL_SCOPE_VERSION = 'otel.scope.version',
  OTEL_STATUS_CODE = 'otel.status_code',
  OTEL_STATUS_DESCRIPTION = 'otel.status_description',
  PARAMS_KEY = 'params.<key>',
  PREVIOUS_ROUTE = 'previous_route',
  PROCESS_EXECUTABLE_NAME = 'process.executable.name',
  PROCESS_PID = 'process.pid',
  PROCESS_RUNTIME_DESCRIPTION = 'process.runtime.description',
  PROCESS_RUNTIME_NAME = 'process.runtime.name',
  PROCESS_RUNTIME_VERSION = 'process.runtime.version',
  PROFILE_ID = 'profile_id',
  QUERY_KEY = 'query.<key>',
  RELEASE = 'release',
  REMIX_ACTION_FORM_DATA_KEY = 'remix.action_form_data.<key>',
  REPLAY_ID = 'replay_id',
  RESOURCE_RENDER_BLOCKING_STATUS = 'resource.render_blocking_status',
  ROUTE = 'route',
  RPC_GRPC_STATUS_CODE = 'rpc.grpc.status_code',
  RPC_SERVICE = 'rpc.service',
  SENTRY_INTERNAL_DSC_ENVIRONMENT = 'sentry._internal.dsc.environment',
  SENTRY_INTERNAL_DSC_ORG_ID = 'sentry._internal.dsc.org_id',
  SENTRY_INTERNAL_DSC_PUBLIC_KEY = 'sentry._internal.dsc.public_key',
  SENTRY_INTERNAL_DSC_RELEASE = 'sentry._internal.dsc.release',
  SENTRY_INTERNAL_DSC_SAMPLE_RAND = 'sentry._internal.dsc.sample_rand',
  SENTRY_INTERNAL_DSC_SAMPLE_RATE = 'sentry._internal.dsc.sample_rate',
  SENTRY_INTERNAL_DSC_SAMPLED = 'sentry._internal.dsc.sampled',
  SENTRY_INTERNAL_DSC_TRACE_ID = 'sentry._internal.dsc.trace_id',
  SENTRY_INTERNAL_DSC_TRANSACTION = 'sentry._internal.dsc.transaction',
  SENTRY_INTERNAL_OBSERVED_TIMESTAMP_NANOS = 'sentry._internal.observed_timestamp_nanos',
  SENTRY_INTERNAL_REPLAY_IS_BUFFERING = 'sentry._internal.replay_is_buffering',
  SENTRY_BROWSER_NAME = 'sentry.browser.name',
  SENTRY_BROWSER_VERSION = 'sentry.browser.version',
  SENTRY_CANCELLATION_REASON = 'sentry.cancellation_reason',
  SENTRY_CLIENT_SAMPLE_RATE = 'sentry.client_sample_rate',
  SENTRY_DESCRIPTION = 'sentry.description',
  SENTRY_DIST = 'sentry.dist',
  SENTRY_ENVIRONMENT = 'sentry.environment',
  SENTRY_EXCLUSIVE_TIME = 'sentry.exclusive_time',
  SENTRY_HTTP_PREFETCH = 'sentry.http.prefetch',
  SENTRY_IDLE_SPAN_FINISH_REASON = 'sentry.idle_span_finish_reason',
  SENTRY_MESSAGE_PARAMETER_KEY = 'sentry.message.parameter.<key>',
  SENTRY_MESSAGE_TEMPLATE = 'sentry.message.template',
  SENTRY_MODULE_KEY = 'sentry.module.<key>',
  SENTRY_NEXTJS_SSR_FUNCTION_ROUTE = 'sentry.nextjs.ssr.function.route',
  SENTRY_NEXTJS_SSR_FUNCTION_TYPE = 'sentry.nextjs.ssr.function.type',
  SENTRY_OBSERVED_TIMESTAMP_NANOS = 'sentry.observed_timestamp_nanos',
  SENTRY_OP = 'sentry.op',
  SENTRY_ORIGIN = 'sentry.origin',
  SENTRY_PLATFORM = 'sentry.platform',
  SENTRY_PROFILE_ID = 'sentry.profile_id',
  SENTRY_RELEASE = 'sentry.release',
  SENTRY_REPLAY_ID = 'sentry.replay_id',
  SENTRY_SDK_INTEGRATIONS = 'sentry.sdk.integrations',
  SENTRY_SDK_NAME = 'sentry.sdk.name',
  SENTRY_SDK_VERSION = 'sentry.sdk.version',
  SENTRY_SEGMENT_ID = 'sentry.segment.id',
  SENTRY_SEGMENT_NAME = 'sentry.segment.name',
  _SENTRY_SEGMENT_ID = 'sentry.segment_id',
  SENTRY_SERVER_SAMPLE_RATE = 'sentry.server_sample_rate',
  SENTRY_SPAN_SOURCE = 'sentry.span.source',
  SENTRY_TRACE_PARENT_SPAN_ID = 'sentry.trace.parent_span_id',
  SENTRY_TRANSACTION = 'sentry.transaction',
  SERVER_ADDRESS = 'server.address',
  SERVER_PORT = 'server.port',
  SERVICE_NAME = 'service.name',
  SERVICE_VERSION = 'service.version',
  THREAD_ID = 'thread.id',
  THREAD_NAME = 'thread.name',
  TRANSACTION = 'transaction',
  TYPE = 'type',
  UI_COMPONENT_NAME = 'ui.component_name',
  UI_CONTRIBUTES_TO_TTFD = 'ui.contributes_to_ttfd',
  UI_CONTRIBUTES_TO_TTID = 'ui.contributes_to_ttid',
  URL_DOMAIN = 'url.domain',
  URL_FRAGMENT = 'url.fragment',
  URL_FULL = 'url.full',
  URL_PATH = 'url.path',
  URL_PATH_PARAMETER_KEY = 'url.path.parameter.<key>',
  URL_PORT = 'url.port',
  URL_QUERY = 'url.query',
  URL_SCHEME = 'url.scheme',
  URL_TEMPLATE = 'url.template',
  URL = 'url',
  USER_EMAIL = 'user.email',
  USER_FULL_NAME = 'user.full_name',
  USER_GEO_CITY = 'user.geo.city',
  USER_GEO_COUNTRY_CODE = 'user.geo.country_code',
  USER_GEO_REGION = 'user.geo.region',
  USER_GEO_SUBDIVISION = 'user.geo.subdivision',
  USER_HASH = 'user.hash',
  USER_ID = 'user.id',
  USER_IP_ADDRESS = 'user.ip_address',
  USER_NAME = 'user.name',
  USER_ROLES = 'user.roles',
  USER_AGENT_ORIGINAL = 'user_agent.original',
}

export const ATTRIBUTE_METADATA: Record<AttributeName, AttributeMetadata> = {
  [AttributeName.AI_CITATIONS]: {
    brief: 'References or sources cited by the AI model in its response.',
    type: AttributeType.STRING_ARRAY,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: false,
    example: ['Citation 1', 'Citation 2'],
  },
  [AttributeName.AI_COMPLETION_TOKENS_USED]: {
    brief: 'The number of tokens used to respond to the message.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 10,
    deprecation: {
      replacement: 'gen_ai.usage.output_tokens',
    },
    aliases: ['gen_ai.usage.output_tokens', 'gen_ai.usage.completion_tokens'],
    sdks: ['python'],
  },
  [AttributeName.AI_DOCUMENTS]: {
    brief: 'Documents or content chunks used as context for the AI model.',
    type: AttributeType.STRING_ARRAY,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: false,
    example: ['document1.txt', 'document2.pdf'],
  },
  [AttributeName.AI_FINISH_REASON]: {
    brief: 'The reason why the model stopped generating.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'COMPLETE',
    deprecation: {
      replacement: 'gen_ai.response.finish_reason',
    },
    aliases: ['gen_ai.response.finish_reasons'],
  },
  [AttributeName.AI_FREQUENCY_PENALTY]: {
    brief:
      'Used to reduce repetitiveness of generated tokens. The higher the value, the stronger a penalty is applied to previously present tokens, proportional to how many times they have already appeared in the prompt or prior generation.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 0.5,
    deprecation: {
      replacement: 'gen_ai.request.frequency_penalty',
    },
    aliases: ['gen_ai.request.frequency_penalty'],
  },
  [AttributeName.AI_FUNCTION_CALL]: {
    brief:
      'For an AI model call, the function that was called. This is deprecated for OpenAI, and replaced by tool_calls',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: false,
    example: 'function_name',
    deprecation: {
      replacement: 'gen_ai.tool.name',
    },
    aliases: ['gen_ai.tool.name'],
  },
  [AttributeName.AI_GENERATION_ID]: {
    brief: 'Unique identifier for the completion.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'gen_123abc',
    deprecation: {
      replacement: 'gen_ai.response.id',
    },
    aliases: ['gen_ai.response.id'],
  },
  [AttributeName.AI_INPUT_MESSAGES]: {
    brief: 'The input messages sent to the model',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: '[{"role": "user", "message": "hello"}]',
    deprecation: {
      replacement: 'gen_ai.request.messages',
    },
    aliases: ['gen_ai.request.messages'],
    sdks: ['python'],
  },
  [AttributeName.AI_IS_SEARCH_REQUIRED]: {
    brief: 'Boolean indicating if the model needs to perform a search.',
    type: AttributeType.BOOLEAN,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: false,
  },
  [AttributeName.AI_METADATA]: {
    brief: 'Extra metadata passed to an AI pipeline step.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: '{"user_id": 123, "session_id": "abc123"}',
  },
  [AttributeName.AI_MODEL_PROVIDER]: {
    brief: 'The provider of the model.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'openai',
    deprecation: {
      replacement: 'gen_ai.system',
    },
    aliases: ['gen_ai.system'],
  },
  [AttributeName.AI_MODEL_ID]: {
    brief: 'The vendor-specific ID of the model used.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'gpt-4',
    deprecation: {
      replacement: 'gen_ai.response.model',
    },
    aliases: ['gen_ai.response.model'],
    sdks: ['python'],
  },
  [AttributeName.AI_PIPELINE_NAME]: {
    brief: 'The name of the AI pipeline.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'Autofix Pipeline',
    deprecation: {
      replacement: 'gen_ai.pipeline.name',
    },
    aliases: ['gen_ai.pipeline.name'],
  },
  [AttributeName.AI_PREAMBLE]: {
    brief:
      "For an AI model call, the preamble parameter. Preambles are a part of the prompt used to adjust the model's overall behavior and conversation style.",
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: false,
    example: 'You are now a clown.',
  },
  [AttributeName.AI_PRESENCE_PENALTY]: {
    brief:
      'Used to reduce repetitiveness of generated tokens. Similar to frequency_penalty, except that this penalty is applied equally to all tokens that have already appeared, regardless of their exact frequencies.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 0.5,
    deprecation: {
      replacement: 'gen_ai.request.presence_penalty',
    },
    aliases: ['gen_ai.request.presence_penalty'],
  },
  [AttributeName.AI_PROMPT_TOKENS_USED]: {
    brief: 'The number of tokens used to process just the prompt.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 20,
    deprecation: {
      replacement: 'gen_ai.usage.input_tokens',
    },
    aliases: ['gen_ai.usage.prompt_tokens', 'gen_ai.usage.input_tokens'],
    sdks: ['python'],
  },
  [AttributeName.AI_RAW_PROMPTING]: {
    brief:
      'When enabled, the user’s prompt will be sent to the model without any pre-processing.',
    type: AttributeType.BOOLEAN,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: true,
  },
  [AttributeName.AI_RESPONSE_FORMAT]: {
    brief: 'For an AI model call, the format of the response',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'json_object',
  },
  [AttributeName.AI_RESPONSES]: {
    brief: 'The response messages sent back by the AI model.',
    type: AttributeType.STRING_ARRAY,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: ['hello', 'world'],
    deprecation: {
      replacement: 'gen_ai.response.text',
    },
    sdks: ['python'],
  },
  [AttributeName.AI_SEARCH_QUERIES]: {
    brief: 'Queries used to search for relevant context or documents.',
    type: AttributeType.STRING_ARRAY,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: false,
    example: ['climate change effects', 'renewable energy'],
  },
  [AttributeName.AI_SEARCH_RESULTS]: {
    brief: 'Results returned from search queries for context.',
    type: AttributeType.STRING_ARRAY,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: false,
    example: ['search_result_1, search_result_2'],
  },
  [AttributeName.AI_SEED]: {
    brief:
      'The seed, ideally models given the same seed and same other parameters will produce the exact same output.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: '1234567890',
    deprecation: {
      replacement: 'gen_ai.request.seed',
    },
    aliases: ['gen_ai.request.seed'],
  },
  [AttributeName.AI_STREAMING]: {
    brief: 'Whether the request was streamed back.',
    type: AttributeType.BOOLEAN,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: true,
    deprecation: {
      replacement: 'gen_ai.response.streaming',
    },
    aliases: ['gen_ai.response.streaming'],
    sdks: ['python'],
  },
  [AttributeName.AI_TAGS]: {
    brief: 'Tags that describe an AI pipeline step.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: '{"executed_function": "add_integers"}',
  },
  [AttributeName.AI_TEMPERATURE]: {
    brief:
      'For an AI model call, the temperature parameter. Temperature essentially means how random the output will be.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 0.1,
    deprecation: {
      replacement: 'gen_ai.request.temperature',
    },
    aliases: ['gen_ai.request.temperature'],
  },
  [AttributeName.AI_TEXTS]: {
    brief: 'Raw text inputs provided to the model.',
    type: AttributeType.STRING_ARRAY,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: false,
    example: ['Hello, how are you?', 'What is the capital of France?'],
  },
  [AttributeName.AI_TOOL_CALLS]: {
    brief: 'For an AI model call, the tool calls that were made.',
    type: AttributeType.STRING_ARRAY,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: false,
    example: ['tool_call_1', 'tool_call_2'],
    deprecation: {
      replacement: 'gen_ai.response.tool_calls',
    },
  },
  [AttributeName.AI_TOOLS]: {
    brief: 'For an AI model call, the functions that are available',
    type: AttributeType.STRING_ARRAY,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: ['function_1', 'function_2'],
    deprecation: {
      replacement: 'gen_ai.request.available_tools',
    },
  },
  [AttributeName.AI_TOP_K]: {
    brief:
      'Limits the model to only consider the K most likely next tokens, where K is an integer (e.g., top_k=20 means only the 20 highest probability tokens are considered).',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 35,
    deprecation: {
      replacement: 'gen_ai.request.top_k',
    },
    aliases: ['gen_ai.request.top_k'],
  },
  [AttributeName.AI_TOP_P]: {
    brief:
      'Limits the model to only consider tokens whose cumulative probability mass adds up to p, where p is a float between 0 and 1 (e.g., top_p=0.7 means only tokens that sum up to 70% of the probability mass are considered).',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 0.7,
    deprecation: {
      replacement: 'gen_ai.request.top_p',
    },
    aliases: ['gen_ai.request.top_p'],
  },
  [AttributeName.AI_TOTAL_COST]: {
    brief: 'The total cost for the tokens used.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 12.34,
  },
  [AttributeName.AI_TOTAL_TOKENS_USED]: {
    brief: 'The total number of tokens used to process the prompt.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 30,
    deprecation: {
      replacement: 'gen_ai.usage.total_tokens',
    },
    aliases: ['gen_ai.usage.total_tokens'],
    sdks: ['python'],
  },
  [AttributeName.AI_WARNINGS]: {
    brief: 'Warning messages generated during model execution.',
    type: AttributeType.STRING_ARRAY,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: false,
    example: ['Token limit exceeded'],
  },
  [AttributeName.APP_START_TYPE]: {
    brief: 'Mobile app start variant. Either cold or warm.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'cold',
  },
  [AttributeName.BLOCKED_MAIN_THREAD]: {
    brief: 'Whether the main thread was blocked by the span.',
    type: AttributeType.BOOLEAN,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: true,
  },
  [AttributeName.BROWSER_NAME]: {
    brief: 'The name of the browser.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'Chrome',
    aliases: ['sentry.browser.name'],
  },
  [AttributeName.BROWSER_REPORT_TYPE]: {
    brief: 'A browser report sent via reporting API..',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'network-error',
  },
  [AttributeName.BROWSER_SCRIPT_INVOKER]: {
    brief: 'How a script was called in the browser.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'Window.requestAnimationFrame',
    sdks: ['browser'],
  },
  [AttributeName.BROWSER_SCRIPT_INVOKER_TYPE]: {
    brief: 'Browser script entry point type.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'event-listener',
    sdks: ['browser'],
  },
  [AttributeName.BROWSER_SCRIPT_SOURCE_CHAR_POSITION]: {
    brief: 'A number representing the script character position of the script.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 678,
    sdks: ['browser'],
  },
  [AttributeName.BROWSER_VERSION]: {
    brief: 'The version of the browser.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: '120.0.6099.130',
    aliases: ['sentry.browser.version'],
  },
  [AttributeName.CACHE_HIT]: {
    brief: 'If the cache was hit during this span.',
    type: AttributeType.BOOLEAN,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: true,
    sdks: ['php-laravel'],
  },
  [AttributeName.CACHE_ITEM_SIZE]: {
    brief: 'The size of the requested item in the cache. In bytes.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 58,
  },
  [AttributeName.CACHE_KEY]: {
    brief: 'The key of the cache accessed.',
    type: AttributeType.STRING_ARRAY,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: ['my-cache-key', 'my-other-cache-key'],
    sdks: ['php-laravel'],
  },
  [AttributeName.CACHE_OPERATION]: {
    brief: 'The operation being performed on the cache.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'get',
    sdks: ['php-laravel'],
  },
  [AttributeName.CACHE_TTL]: {
    brief: 'The ttl of the cache in seconds',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 120,
    sdks: ['php-laravel'],
  },
  [AttributeName.CHANNEL]: {
    brief: 'The channel name that is being used.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'mail',
    sdks: ['php-laravel'],
  },
  [AttributeName.CLIENT_ADDRESS]: {
    brief:
      'Client address - domain name if available without reverse DNS lookup; otherwise, IP address or Unix domain socket name.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: true,
    example: 'example.com',
    aliases: ['http.client_ip'],
  },
  [AttributeName.CLIENT_PORT]: {
    brief: 'Client port number.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 5432,
  },
  [AttributeName.CLOUDFLARE_D1_DURATION]: {
    brief: 'The duration of a Cloudflare D1 operation.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 543,
    sdks: ['javascript-cloudflare'],
  },
  [AttributeName.CLOUDFLARE_D1_ROWS_READ]: {
    brief: 'The number of rows read in a Cloudflare D1 operation.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 12,
    sdks: ['javascript-cloudflare'],
  },
  [AttributeName.CLOUDFLARE_D1_ROWS_WRITTEN]: {
    brief: 'The number of rows written in a Cloudflare D1 operation.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 12,
    sdks: ['javascript-cloudflare'],
  },
  [AttributeName.CODE_FILE_PATH]: {
    brief:
      'The source code file name that identifies the code unit as uniquely as possible (preferably an absolute file path).',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '/app/myapplication/http/handler/server.py',
    aliases: ['code.filepath'],
  },
  [AttributeName.CODE_FILEPATH]: {
    brief:
      'The source code file name that identifies the code unit as uniquely as possible (preferably an absolute file path).',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '/app/myapplication/http/handler/server.py',
    deprecation: {
      replacement: 'code.file.path',
    },
    aliases: ['code.file.path'],
  },
  [AttributeName.CODE_FUNCTION]: {
    brief:
      "The method or function name, or equivalent (usually rightmost part of the code unit's name).",
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'server_request',
    deprecation: {
      replacement: 'code.function.name',
    },
    aliases: ['code.function.name'],
  },
  [AttributeName.CODE_FUNCTION_NAME]: {
    brief:
      "The method or function name, or equivalent (usually rightmost part of the code unit's name).",
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'server_request',
    aliases: ['code.function'],
  },
  [AttributeName.CODE_LINE_NUMBER]: {
    brief:
      'The line number in code.filepath best representing the operation. It SHOULD point within the code unit named in code.function',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 42,
    aliases: ['code.lineno'],
  },
  [AttributeName.CODE_LINENO]: {
    brief:
      'The line number in code.filepath best representing the operation. It SHOULD point within the code unit named in code.function',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 42,
    deprecation: {
      replacement: 'code.line.number',
    },
    aliases: ['code.line.number'],
  },
  [AttributeName.CODE_NAMESPACE]: {
    brief:
      "The 'namespace' within which code.function is defined. Usually the qualified class or module name, such that code.namespace + some separator + code.function form a unique identifier for the code unit.",
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'http.handler',
    deprecation: {
      replacement: 'code.function.name',
      reason: 'code.function.name should include the namespace.',
    },
  },
  [AttributeName.DB_COLLECTION_NAME]: {
    brief: 'The name of a collection (table, container) within the database.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'users',
  },
  [AttributeName.DB_NAME]: {
    brief: 'The name of the database being accessed.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'customers',
    deprecation: {
      replacement: 'db.namespace',
    },
    aliases: ['db.namespace'],
  },
  [AttributeName.DB_NAMESPACE]: {
    brief: 'The name of the database being accessed.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'customers',
    aliases: ['db.name'],
  },
  [AttributeName.DB_OPERATION]: {
    brief: 'The name of the operation being executed.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'SELECT',
    deprecation: {
      replacement: 'db.operation.name',
    },
    aliases: ['db.operation.name'],
  },
  [AttributeName.DB_OPERATION_NAME]: {
    brief: 'The name of the operation being executed.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'SELECT',
    aliases: ['db.operation'],
  },
  [AttributeName.DB_QUERY_PARAMETER_KEY]: {
    brief:
      'A query parameter used in db.query.text, with <key> being the parameter name, and the attribute value being a string representation of the parameter value.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    hasDynamicSuffix: true,
    example: "db.query.parameter.foo='123'",
  },
  [AttributeName.DB_QUERY_SUMMARY]: {
    brief:
      'A database query being executed. Should be paramaterized. The full version of the query is in `db.query.text`.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'SELECT * FROM users',
  },
  [AttributeName.DB_QUERY_TEXT]: {
    brief:
      'The database query being executed. Should be the full query, not a parameterized version. The parameterized version is in `db.query.summary`.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'SELECT * FROM users',
    aliases: ['db.statement'],
  },
  [AttributeName.DB_REDIS_CONNECTION]: {
    brief: 'The redis connection name.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'my-redis-instance',
    sdks: ['php-laravel'],
  },
  [AttributeName.DB_REDIS_PARAMETERS]: {
    brief: 'The array of command parameters given to a redis command.',
    type: AttributeType.STRING_ARRAY,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: ['test', '*'],
    sdks: ['php-laravel'],
  },
  [AttributeName.DB_SQL_BINDINGS]: {
    brief: 'The array of query bindings.',
    type: AttributeType.STRING_ARRAY,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: ['1', 'foo'],
    deprecation: {
      replacement: 'db.query.parameter.<key>',
      reason:
        'Instead of adding every binding in the db.sql.bindings attribute, add them as individual entires with db.query.parameter.<key>.',
    },
    sdks: ['php-laravel'],
  },
  [AttributeName.DB_STATEMENT]: {
    brief: 'The database statement being executed.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'SELECT * FROM users',
    deprecation: {
      replacement: 'db.query.text',
    },
    aliases: ['db.query.text'],
  },
  [AttributeName.DB_SYSTEM]: {
    brief:
      'An identifier for the database management system (DBMS) product being used. See [OpenTelemetry docs](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/database/database-spans.md#notes-and-well-known-identifiers-for-dbsystem) for a list of well-known identifiers.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'postgresql',
    deprecation: {
      replacement: 'db.system.name',
    },
    aliases: ['db.system.name'],
  },
  [AttributeName.DB_SYSTEM_NAME]: {
    brief:
      'An identifier for the database management system (DBMS) product being used. See [OpenTelemetry docs](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/database/database-spans.md#notes-and-well-known-identifiers-for-dbsystem) for a list of well-known identifiers.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'postgresql',
    aliases: ['db.system'],
  },
  [AttributeName.DB_USER]: {
    brief: 'The database user.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: true,
    example: 'fancy_user',
  },
  [AttributeName.DEVICE_BRAND]: {
    brief: 'The brand of the device.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'Apple',
  },
  [AttributeName.DEVICE_FAMILY]: {
    brief: 'The family of the device.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'iPhone',
  },
  [AttributeName.DEVICE_MODEL]: {
    brief: 'The model of the device.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'iPhone 15 Pro Max',
  },
  [AttributeName.ENVIRONMENT]: {
    brief: 'The sentry environment.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'production',
    deprecation: {
      replacement: 'sentry.environment',
    },
    aliases: ['sentry.environment'],
  },
  [AttributeName.ERROR_TYPE]: {
    brief: 'Describes a class of error the operation ended with.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'timeout',
  },
  [AttributeName.EVENT_ID]: {
    brief: 'The unique identifier for this event (log record)',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 1234567890,
  },
  [AttributeName.EVENT_NAME]: {
    brief: 'The name that uniquely identifies this event (log record)',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'Process Payload',
  },
  [AttributeName.EXCEPTION_ESCAPED]: {
    brief:
      'SHOULD be set to true if the exception event is recorded at a point where it is known that the exception is escaping the scope of the span.',
    type: AttributeType.BOOLEAN,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: true,
  },
  [AttributeName.EXCEPTION_MESSAGE]: {
    brief: 'The error message.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'ENOENT: no such file or directory',
  },
  [AttributeName.EXCEPTION_STACKTRACE]: {
    brief:
      'A stacktrace as a string in the natural representation for the language runtime. The representation is to be determined and documented by each language SIG.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example:
      'Exception in thread "main" java.lang.RuntimeException: Test exception\n at com.example.GenerateTrace.methodB(GenerateTrace.java:13)\n at com.example.GenerateTrace.methodA(GenerateTrace.java:9)\n at com.example.GenerateTrace.main(GenerateTrace.java:5)',
  },
  [AttributeName.EXCEPTION_TYPE]: {
    brief:
      'The type of the exception (its fully-qualified class name, if applicable). The dynamic type of the exception should be preferred over the static type in languages that support it.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'OSError',
  },
  [AttributeName.FAAS_COLDSTART]: {
    brief:
      'A boolean that is true if the serverless function is executed for the first time (aka cold-start).',
    type: AttributeType.BOOLEAN,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: true,
  },
  [AttributeName.FAAS_CRON]: {
    brief: 'A string containing the schedule period as Cron Expression.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '0/5 * * * ? *',
  },
  [AttributeName.FAAS_TIME]: {
    brief:
      'A string containing the function invocation time in the ISO 8601 format expressed in UTC.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '2020-01-23T13:47:06Z',
  },
  [AttributeName.FAAS_TRIGGER]: {
    brief: 'Type of the trigger which caused this function invocation.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'timer',
  },
  [AttributeName.FLAG_EVALUATION_KEY]: {
    brief:
      'An instance of a feature flag evaluation. The value of this attribute is the boolean representing the evaluation result. The <key> suffix is the name of the feature flag.',
    type: AttributeType.BOOLEAN,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    hasDynamicSuffix: true,
    example: 'flag.evaluation.is_new_ui=true',
  },
  [AttributeName.FRAMES_DELAY]: {
    brief:
      'The sum of all delayed frame durations in seconds during the lifetime of the span. For more information see [frames delay](https://develop.sentry.dev/sdk/performance/frames-delay/).',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 5,
  },
  [AttributeName.FRAMES_FROZEN]: {
    brief: 'The number of frozen frames rendered during the lifetime of the span.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 3,
  },
  [AttributeName.FRAMES_SLOW]: {
    brief: 'The number of slow frames rendered during the lifetime of the span.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 1,
  },
  [AttributeName.FRAMES_TOTAL]: {
    brief: 'The number of total frames rendered during the lifetime of the span.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 60,
  },
  [AttributeName.FS_ERROR]: {
    brief: 'The error message of a file system error.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'ENOENT: no such file or directory',
    deprecation: {
      replacement: 'error.type',
      reason:
        'This attribute is not part of the OpenTelemetry specification and error.type fits much better.',
    },
    sdks: ['javascript-node'],
  },
  [AttributeName.GEN_AI_AGENT_NAME]: {
    brief: 'The name of the agent being used.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'ResearchAssistant',
  },
  [AttributeName.GEN_AI_ASSISTANT_MESSAGE]: {
    brief: 'The assistant message passed to the model.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: false,
    example: 'get_weather tool call',
  },
  [AttributeName.GEN_AI_CHOICE]: {
    brief: "The model's response message.",
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: false,
    example: 'The weather in Paris is rainy and overcast, with temperatures around 57°F',
  },
  [AttributeName.GEN_AI_COST_INPUT_TOKENS]: {
    brief:
      'The cost of tokens used to process the AI input (prompt) in USD (without cached input tokens).',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 123.45,
  },
  [AttributeName.GEN_AI_COST_OUTPUT_TOKENS]: {
    brief:
      'The cost of tokens used for creating the AI output in USD (without reasoning tokens).',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 123.45,
  },
  [AttributeName.GEN_AI_COST_TOTAL_TOKENS]: {
    brief: 'The total cost for the tokens used.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 12.34,
  },
  [AttributeName.GEN_AI_OPERATION_NAME]: {
    brief: 'The name of the operation being performed.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'chat',
  },
  [AttributeName.GEN_AI_OPERATION_TYPE]: {
    brief:
      "The type of AI operation. Must be one of 'agent', 'ai_client', 'tool', 'handoff', 'guardrail'. Makes querying for spans in the UI easier.",
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'tool',
  },
  [AttributeName.GEN_AI_PIPELINE_NAME]: {
    brief: 'Name of the AI pipeline or chain being executed.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'Autofix Pipeline',
    aliases: ['ai.pipeline.name'],
  },
  [AttributeName.GEN_AI_PROMPT]: {
    brief: 'The input messages sent to the model',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '[{"role": "user", "message": "hello"}]',
    deprecation: {
      reason:
        'Deprecated from OTEL, use gen_ai.input.messages with the new format instead.',
    },
  },
  [AttributeName.GEN_AI_REQUEST_AVAILABLE_TOOLS]: {
    brief:
      'The available tools for the model. It has to be a stringified version of an array of objects.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example:
      '[{"name": "get_weather", "description": "Get the weather for a given location"}, {"name": "get_news", "description": "Get the news for a given topic"}]',
  },
  [AttributeName.GEN_AI_REQUEST_FREQUENCY_PENALTY]: {
    brief:
      'Used to reduce repetitiveness of generated tokens. The higher the value, the stronger a penalty is applied to previously present tokens, proportional to how many times they have already appeared in the prompt or prior generation.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 0.5,
    aliases: ['ai.frequency_penalty'],
  },
  [AttributeName.GEN_AI_REQUEST_MAX_TOKENS]: {
    brief: 'The maximum number of tokens to generate in the response.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 2048,
  },
  [AttributeName.GEN_AI_REQUEST_MESSAGES]: {
    brief:
      'The messages passed to the model. It has to be a stringified version of an array of objects. The `role` attribute of each object must be `"user"`, `"assistant"`, `"tool"`, or `"system"`. For messages of the role `"tool"`, the `content` can be a string or an arbitrary object with information about the tool call. For other messages the `content` can be either a string or a list of objects in the format `{type: "text", text:"..."}`.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example:
      '[{"role": "system", "content": "Generate a random number."}, {"role": "user", "content": [{"text": "Generate a random number between 0 and 10.", "type": "text"}]}, {"role": "tool", "content": {"toolCallId": "1", "toolName": "Weather", "output": "rainy"}}]',
    aliases: ['ai.input_messages'],
  },
  [AttributeName.GEN_AI_REQUEST_MODEL]: {
    brief: 'The model identifier being used for the request.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'gpt-4-turbo-preview',
  },
  [AttributeName.GEN_AI_REQUEST_PRESENCE_PENALTY]: {
    brief:
      'Used to reduce repetitiveness of generated tokens. Similar to frequency_penalty, except that this penalty is applied equally to all tokens that have already appeared, regardless of their exact frequencies.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 0.5,
    aliases: ['ai.presence_penalty'],
  },
  [AttributeName.GEN_AI_REQUEST_SEED]: {
    brief:
      'The seed, ideally models given the same seed and same other parameters will produce the exact same output.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '1234567890',
    aliases: ['ai.seed'],
  },
  [AttributeName.GEN_AI_REQUEST_TEMPERATURE]: {
    brief:
      'For an AI model call, the temperature parameter. Temperature essentially means how random the output will be.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 0.1,
    aliases: ['ai.temperature'],
  },
  [AttributeName.GEN_AI_REQUEST_TOP_K]: {
    brief:
      'Limits the model to only consider the K most likely next tokens, where K is an integer (e.g., top_k=20 means only the 20 highest probability tokens are considered).',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 35,
    aliases: ['ai.top_k'],
  },
  [AttributeName.GEN_AI_REQUEST_TOP_P]: {
    brief:
      'Limits the model to only consider tokens whose cumulative probability mass adds up to p, where p is a float between 0 and 1 (e.g., top_p=0.7 means only tokens that sum up to 70% of the probability mass are considered).',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 0.7,
    aliases: ['ai.top_p'],
  },
  [AttributeName.GEN_AI_RESPONSE_FINISH_REASONS]: {
    brief: 'The reason why the model stopped generating.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'COMPLETE',
    aliases: ['ai.finish_reason'],
  },
  [AttributeName.GEN_AI_RESPONSE_ID]: {
    brief: 'Unique identifier for the completion.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'gen_123abc',
    aliases: ['ai.generation_id'],
  },
  [AttributeName.GEN_AI_RESPONSE_MODEL]: {
    brief: 'The vendor-specific ID of the model used.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'gpt-4',
    aliases: ['ai.model_id'],
  },
  [AttributeName.GEN_AI_RESPONSE_STREAMING]: {
    brief: "Whether or not the AI model call's response was streamed back asynchronously",
    type: AttributeType.BOOLEAN,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: true,
    aliases: ['ai.streaming'],
  },
  [AttributeName.GEN_AI_RESPONSE_TEXT]: {
    brief:
      "The model's response text messages. It has to be a stringified version of an array of response text messages.",
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example:
      '["The weather in Paris is rainy and overcast, with temperatures around 57°F", "The weather in London is sunny and warm, with temperatures around 65°F"]',
  },
  [AttributeName.GEN_AI_RESPONSE_TOKENS_PER_SECOND]: {
    brief: 'The total output tokens per seconds throughput',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 12345.67,
  },
  [AttributeName.GEN_AI_RESPONSE_TOOL_CALLS]: {
    brief:
      "The tool calls in the model's response. It has to be a stringified version of an array of objects.",
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: '[{"name": "get_weather", "arguments": {"location": "Paris"}}]',
  },
  [AttributeName.GEN_AI_SYSTEM]: {
    brief: 'The provider of the model.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'openai',
    aliases: ['ai.model.provider'],
  },
  [AttributeName.GEN_AI_SYSTEM_MESSAGE]: {
    brief: 'The system instructions passed to the model.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: false,
    example: 'You are a helpful assistant',
  },
  [AttributeName.GEN_AI_TOOL_DESCRIPTION]: {
    brief: 'The description of the tool being used.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'Searches the web for current information about a topic',
  },
  [AttributeName.GEN_AI_TOOL_INPUT]: {
    brief:
      'The input of the tool being used. It has to be a stringified version of the input to the tool.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: '{"location": "Paris"}',
  },
  [AttributeName.GEN_AI_TOOL_MESSAGE]: {
    brief: 'The response from a tool or function call passed to the model.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: false,
    example: 'rainy, 57°F',
  },
  [AttributeName.GEN_AI_TOOL_NAME]: {
    brief: 'Name of the tool utilized by the agent.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'Flights',
    aliases: ['ai.function_call'],
  },
  [AttributeName.GEN_AI_TOOL_OUTPUT]: {
    brief:
      'The output of the tool being used. It has to be a stringified version of the output of the tool.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'rainy, 57°F',
  },
  [AttributeName.GEN_AI_TOOL_TYPE]: {
    brief: 'The type of tool being used.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'function',
  },
  [AttributeName.GEN_AI_USAGE_COMPLETION_TOKENS]: {
    brief: 'The number of tokens used in the GenAI response (completion).',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 10,
    deprecation: {
      replacement: 'gen_ai.usage.output_tokens',
    },
    aliases: ['ai.completion_tokens.used', 'gen_ai.usage.output_tokens'],
  },
  [AttributeName.GEN_AI_USAGE_INPUT_TOKENS]: {
    brief:
      'The number of tokens used to process the AI input (prompt) without cached input tokens.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 10,
    aliases: ['ai.prompt_tokens.used', 'gen_ai.usage.prompt_tokens'],
  },
  [AttributeName.GEN_AI_USAGE_INPUT_TOKENS_CACHED]: {
    brief: 'The number of cached tokens used to process the AI input (prompt).',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 50,
  },
  [AttributeName.GEN_AI_USAGE_OUTPUT_TOKENS]: {
    brief:
      'The number of tokens used for creating the AI output (without reasoning tokens).',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 10,
    aliases: ['ai.completion_tokens.used', 'gen_ai.usage.completion_tokens'],
  },
  [AttributeName.GEN_AI_USAGE_OUTPUT_TOKENS_REASONING]: {
    brief: 'The number of tokens used for reasoning to create the AI output.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 75,
  },
  [AttributeName.GEN_AI_USAGE_PROMPT_TOKENS]: {
    brief: 'The number of tokens used in the GenAI input (prompt).',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 20,
    deprecation: {
      replacement: 'gen_ai.usage.input_tokens',
    },
    aliases: ['ai.prompt_tokens.used', 'gen_ai.usage.input_tokens'],
  },
  [AttributeName.GEN_AI_USAGE_TOTAL_COST]: {
    brief: 'The total cost for the tokens used.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 12.34,
    deprecation: {
      replacement: 'gen_ai.cost.total_tokens',
    },
  },
  [AttributeName.GEN_AI_USAGE_TOTAL_TOKENS]: {
    brief:
      'The total number of tokens used to process the prompt. (input tokens plus output todkens)',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 20,
    aliases: ['ai.total_tokens.used'],
  },
  [AttributeName.GEN_AI_USER_MESSAGE]: {
    brief: 'The user message passed to the model.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: false,
    example: "What's the weather in Paris?",
  },
  [AttributeName.GRAPHQL_OPERATION_NAME]: {
    brief: 'The name of the operation being executed.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'findBookById',
  },
  [AttributeName.GRAPHQL_OPERATION_TYPE]: {
    brief: 'The type of the operation being executed.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'query',
  },
  [AttributeName.HTTP_CLIENT_IP]: {
    brief:
      'Client address - domain name if available without reverse DNS lookup; otherwise, IP address or Unix domain socket name.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: true,
    example: 'example.com',
    deprecation: {
      replacement: 'client.address',
    },
    aliases: ['client.address'],
  },
  [AttributeName.HTTP_DECODED_RESPONSE_CONTENT_LENGTH]: {
    brief: 'The decoded body size of the response (in bytes).',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 456,
    sdks: ['javascript-browser'],
  },
  [AttributeName.HTTP_FLAVOR]: {
    brief: 'The actual version of the protocol used for network communication.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '1.1',
    deprecation: {
      replacement: 'network.protocol.version',
    },
    aliases: ['network.protocol.version', 'net.protocol.version'],
  },
  [AttributeName.HTTP_FRAGMENT]: {
    brief:
      'The fragments present in the URI. Note that this contains the leading # character, while the `url.fragment` attribute does not.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: '#details',
  },
  [AttributeName.HTTP_HOST]: {
    brief: 'The domain name.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'example.com',
    deprecation: {
      replacement: 'server.address',
      reason:
        'Deprecated, use one of `server.address` or `client.address`, depending on the usage',
    },
    aliases: ['server.address', 'client.address', 'http.server_name', 'net.host.name'],
  },
  [AttributeName.HTTP_METHOD]: {
    brief: 'The HTTP method used.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'GET',
    deprecation: {
      replacement: 'http.request.method',
    },
    aliases: ['http.request.method'],
  },
  [AttributeName.HTTP_QUERY]: {
    brief:
      'The query string present in the URL. Note that this contains the leading ? character, while the `url.query` attribute does not.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
      reason:
        'Query string values can contain sensitive information. Clients should attempt to scrub parameters that might contain sensitive information.',
    },
    isInOtel: false,
    example: '?foo=bar&bar=baz',
  },
  [AttributeName.HTTP_REQUEST_CONNECT_START]: {
    brief:
      'The UNIX timestamp representing the time immediately before the user agent starts establishing the connection to the server to retrieve the resource.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 1732829555.111,
    sdks: ['javascript-browser'],
  },
  [AttributeName.HTTP_REQUEST_CONNECTION_END]: {
    brief:
      'The UNIX timestamp representing the time immediately after the browser finishes establishing the connection to the server to retrieve the resource. The timestamp value includes the time interval to establish the transport connection, as well as other time intervals such as TLS handshake and SOCKS authentication.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 1732829555.15,
    sdks: ['javascript-browser'],
  },
  [AttributeName.HTTP_REQUEST_DOMAIN_LOOKUP_END]: {
    brief:
      'The UNIX timestamp representing the time immediately after the browser finishes the domain-name lookup for the resource.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 1732829555.201,
    sdks: ['javascript-browser'],
  },
  [AttributeName.HTTP_REQUEST_DOMAIN_LOOKUP_START]: {
    brief:
      'The UNIX timestamp representing the time immediately before the browser starts the domain name lookup for the resource.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 1732829555.322,
    sdks: ['javascript-browser'],
  },
  [AttributeName.HTTP_REQUEST_FETCH_START]: {
    brief:
      'The UNIX timestamp representing the time immediately before the browser starts to fetch the resource.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 1732829555.389,
    sdks: ['javascript-browser'],
  },
  [AttributeName.HTTP_REQUEST_HEADER_KEY]: {
    brief:
      'HTTP request headers, <key> being the normalized HTTP Header name (lowercase), the value being the header values.',
    type: AttributeType.STRING_ARRAY,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    hasDynamicSuffix: true,
    example: "http.request.header.custom-header=['foo', 'bar']",
  },
  [AttributeName.HTTP_REQUEST_METHOD]: {
    brief: 'The HTTP method used.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'GET',
    aliases: ['method', 'http.method'],
  },
  [AttributeName.HTTP_REQUEST_REDIRECT_END]: {
    brief:
      'The UNIX timestamp representing the timestamp immediately after receiving the last byte of the response of the last redirect',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 1732829558.502,
    sdks: ['javascript-browser'],
  },
  [AttributeName.HTTP_REQUEST_REDIRECT_START]: {
    brief:
      'The UNIX timestamp representing the start time of the fetch which that initiates the redirect.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 1732829555.495,
    sdks: ['javascript-browser'],
  },
  [AttributeName.HTTP_REQUEST_REQUEST_START]: {
    brief:
      'The UNIX timestamp representing the time immediately before the browser starts requesting the resource from the server, cache, or local resource. If the transport connection fails and the browser retires the request, the value returned will be the start of the retry request.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 1732829555.51,
    sdks: ['javascript-browser'],
  },
  [AttributeName.HTTP_REQUEST_RESEND_COUNT]: {
    brief:
      'The ordinal number of request resending attempt (for any reason, including redirects).',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 2,
  },
  [AttributeName.HTTP_REQUEST_RESPONSE_END]: {
    brief:
      'The UNIX timestamp representing the time immediately after the browser receives the last byte of the resource or immediately before the transport connection is closed, whichever comes first.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 1732829555.89,
    sdks: ['javascript-browser'],
  },
  [AttributeName.HTTP_REQUEST_RESPONSE_START]: {
    brief:
      'The UNIX timestamp representing the time immediately before the browser starts requesting the resource from the server, cache, or local resource. If the transport connection fails and the browser retires the request, the value returned will be the start of the retry request.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 1732829555.7,
    sdks: ['javascript-browser'],
  },
  [AttributeName.HTTP_REQUEST_SECURE_CONNECTION_START]: {
    brief:
      'The UNIX timestamp representing the time immediately before the browser starts the handshake process to secure the current connection. If a secure connection is not used, the property returns zero.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 1732829555.73,
    sdks: ['javascript-browser'],
  },
  [AttributeName.HTTP_REQUEST_TIME_TO_FIRST_BYTE]: {
    brief:
      "The time in seconds from the browser's timeorigin to when the first byte of the request's response was received. See https://web.dev/articles/ttfb#measure-resource-requests",
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 1.032,
    sdks: ['javascript-browser'],
  },
  [AttributeName.HTTP_REQUEST_WORKER_START]: {
    brief:
      'The UNIX timestamp representing the timestamp immediately before dispatching the FetchEvent if a Service Worker thread is already running, or immediately before starting the Service Worker thread if it is not already running.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 1732829553.68,
    sdks: ['javascript-browser'],
  },
  [AttributeName.HTTP_RESPONSE_BODY_SIZE]: {
    brief: 'The encoded body size of the response (in bytes).',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 123,
    aliases: ['http.response_content_length', 'http.response.header.content-length'],
  },
  [AttributeName.HTTP_RESPONSE_HEADER_KEY]: {
    brief:
      'HTTP response headers, <key> being the normalized HTTP Header name (lowercase), the value being the header values.',
    type: AttributeType.STRING_ARRAY,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    hasDynamicSuffix: true,
    example: "http.response.header.custom-header=['foo', 'bar']",
  },
  [AttributeName.HTTP_RESPONSE_HEADER_CONTENT_LENGTH]: {
    brief: 'The size of the message body sent to the recipient (in bytes)',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: "http.response.header.custom-header=['foo', 'bar']",
    aliases: ['http.response_content_length', 'http.response.body.size'],
  },
  [AttributeName.HTTP_RESPONSE_SIZE]: {
    brief: 'The transfer size of the response (in bytes).',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 456,
    aliases: ['http.response_transfer_size'],
  },
  [AttributeName.HTTP_RESPONSE_STATUS_CODE]: {
    brief: 'The status code of the HTTP response.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 404,
    aliases: ['http.status_code'],
  },
  [AttributeName.HTTP_RESPONSE_CONTENT_LENGTH]: {
    brief: 'The encoded body size of the response (in bytes).',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 123,
    deprecation: {
      replacement: 'http.response.body.size',
    },
    aliases: ['http.response.body.size', 'http.response.header.content-length'],
  },
  [AttributeName.HTTP_RESPONSE_TRANSFER_SIZE]: {
    brief: 'The transfer size of the response (in bytes).',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 456,
    deprecation: {
      replacement: 'http.response.size',
    },
    aliases: ['http.response.size'],
  },
  [AttributeName.HTTP_ROUTE]: {
    brief:
      'The matched route, that is, the path template in the format used by the respective server framework.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '/users/:id',
    aliases: ['url.template'],
  },
  [AttributeName.HTTP_SCHEME]: {
    brief: 'The URI scheme component identifying the used protocol.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'https',
    deprecation: {
      replacement: 'url.scheme',
    },
    aliases: ['url.scheme'],
  },
  [AttributeName.HTTP_SERVER_NAME]: {
    brief: 'The server domain name',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'example.com',
    deprecation: {
      replacement: 'server.address',
    },
    aliases: ['server.address', 'net.host.name', 'http.host'],
  },
  [AttributeName.HTTP_STATUS_CODE]: {
    brief: 'The status code of the HTTP response.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 404,
    deprecation: {
      replacement: 'http.response.status_code',
    },
    aliases: ['http.response.status_code'],
  },
  [AttributeName.HTTP_TARGET]: {
    brief: 'The pathname and query string of the URL.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '/test?foo=bar#buzz',
    deprecation: {
      replacement: 'url.path',
      reason: 'This attribute is being deprecated in favor of url.path and url.query',
    },
  },
  [AttributeName.HTTP_URL]: {
    brief: 'The URL of the resource that was fetched.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'https://example.com/test?foo=bar#buzz',
    deprecation: {
      replacement: 'url.full',
    },
    aliases: ['url.full', 'url'],
  },
  [AttributeName.HTTP_USER_AGENT]: {
    brief: 'Value of the HTTP User-Agent header sent by the client.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    deprecation: {
      replacement: 'user_agent.original',
    },
    aliases: ['user_agent.original'],
  },
  [AttributeName.ID]: {
    brief: 'A unique identifier for the span.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 'f47ac10b58cc4372a5670e02b2c3d479',
    sdks: ['php-laravel'],
  },
  [AttributeName.JVM_GC_ACTION]: {
    brief: 'Name of the garbage collector action.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'end of minor GC',
  },
  [AttributeName.JVM_GC_NAME]: {
    brief: 'Name of the garbage collector.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'G1 Young Generation',
  },
  [AttributeName.JVM_MEMORY_POOL_NAME]: {
    brief: 'Name of the memory pool.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'G1 Old Gen',
  },
  [AttributeName.JVM_MEMORY_TYPE]: {
    brief: 'Name of the memory pool.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'G1 Old Gen',
  },
  [AttributeName.JVM_THREAD_DAEMON]: {
    brief: 'Whether the thread is daemon or not.',
    type: AttributeType.BOOLEAN,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: true,
  },
  [AttributeName.JVM_THREAD_STATE]: {
    brief: 'State of the thread.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'blocked',
  },
  [AttributeName.LCP_ELEMENT]: {
    brief: 'The dom element responsible for the largest contentful paint.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'img',
  },
  [AttributeName.LCP_ID]: {
    brief: 'The id of the dom element responsible for the largest contentful paint.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: '#hero',
  },
  [AttributeName.LCP_SIZE]: {
    brief: 'The size of the largest contentful paint element.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 1234,
  },
  [AttributeName.LCP_URL]: {
    brief: 'The url of the dom element responsible for the largest contentful paint.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'https://example.com',
  },
  [AttributeName.LOGGER_NAME]: {
    brief: 'The name of the logger that generated this event.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'myLogger',
  },
  [AttributeName.MESSAGING_DESTINATION_CONNECTION]: {
    brief: 'The message destination connection.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'BestTopic',
    sdks: ['php-laravel'],
  },
  [AttributeName.MESSAGING_DESTINATION_NAME]: {
    brief: 'The message destination name.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'BestTopic',
    sdks: ['php-laravel'],
  },
  [AttributeName.MESSAGING_MESSAGE_BODY_SIZE]: {
    brief: 'The size of the message body in bytes.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 839,
    sdks: ['php-laravel'],
  },
  [AttributeName.MESSAGING_MESSAGE_ENVELOPE_SIZE]: {
    brief: 'The size of the message body and metadata in bytes.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 1045,
    sdks: ['php-laravel'],
  },
  [AttributeName.MESSAGING_MESSAGE_ID]: {
    brief:
      'A value used by the messaging system as an identifier for the message, represented as a string.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'f47ac10b58cc4372a5670e02b2c3d479',
    sdks: ['php-laravel'],
  },
  [AttributeName.MESSAGING_MESSAGE_RECEIVE_LATENCY]: {
    brief: 'The latency between when the message was published and received.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 1732847252,
    sdks: ['php-laravel'],
  },
  [AttributeName.MESSAGING_MESSAGE_RETRY_COUNT]: {
    brief: 'The amount of attempts to send the message.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 2,
    sdks: ['php-laravel'],
  },
  [AttributeName.MESSAGING_OPERATION_TYPE]: {
    brief: 'A string identifying the type of the messaging operation',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'create',
  },
  [AttributeName.MESSAGING_SYSTEM]: {
    brief: 'The messaging system as identified by the client instrumentation.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'activemq',
    sdks: ['php-laravel'],
  },
  [AttributeName.METHOD]: {
    brief: 'The HTTP method used.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'GET',
    deprecation: {
      replacement: 'http.request.method',
    },
    aliases: ['http.request.method'],
    sdks: ['javascript-browser', 'javascript-node'],
  },
  [AttributeName.NAVIGATION_TYPE]: {
    brief: 'The type of navigation done by a client-side router.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'router.push',
  },
  [AttributeName.NEL_ELAPSED_TIME]: {
    brief:
      'The elapsed number of milliseconds between the start of the resource fetch and when it was completed or aborted by the user agent.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 100,
  },
  [AttributeName.NEL_PHASE]: {
    brief:
      'If request failed, the phase of its network error. If request succeeded, "application".',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'application',
  },
  [AttributeName.NEL_REFERRER]: {
    brief:
      "request's referrer, as determined by the referrer policy associated with its client.",
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'https://example.com/foo?bar=baz',
  },
  [AttributeName.NEL_SAMPLING_FUNCTION]: {
    brief: 'The sampling function used to determine if the request should be sampled.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 0.5,
  },
  [AttributeName.NEL_TYPE]: {
    brief:
      'If request failed, the type of its network error. If request succeeded, "ok".',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'dns.unreachable',
  },
  [AttributeName.NET_HOST_IP]: {
    brief:
      'Local address of the network connection - IP address or Unix domain socket name.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '192.168.0.1',
    deprecation: {
      replacement: 'network.local.address',
    },
    aliases: ['network.local.address', 'net.sock.host.addr'],
  },
  [AttributeName.NET_HOST_NAME]: {
    brief:
      'Server domain name if available without reverse DNS lookup; otherwise, IP address or Unix domain socket name.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'example.com',
    deprecation: {
      replacement: 'server.address',
    },
    aliases: ['server.address', 'http.server_name', 'http.host'],
  },
  [AttributeName.NET_HOST_PORT]: {
    brief: 'Server port number.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 1337,
    deprecation: {
      replacement: 'server.port',
    },
    aliases: ['server.port'],
  },
  [AttributeName.NET_PEER_IP]: {
    brief:
      'Peer address of the network connection - IP address or Unix domain socket name.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '192.168.0.1',
    deprecation: {
      replacement: 'network.peer.address',
    },
    aliases: ['network.peer.address', 'net.sock.peer.addr'],
  },
  [AttributeName.NET_PEER_NAME]: {
    brief:
      'Server domain name if available without reverse DNS lookup; otherwise, IP address or Unix domain socket name.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'example.com',
    deprecation: {
      replacement: 'server.address',
      reason:
        'Deprecated, use server.address on client spans and client.address on server spans.',
    },
  },
  [AttributeName.NET_PEER_PORT]: {
    brief: 'Peer port number.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 1337,
    deprecation: {
      replacement: 'server.port',
      reason:
        'Deprecated, use server.port on client spans and client.port on server spans.',
    },
  },
  [AttributeName.NET_PROTOCOL_NAME]: {
    brief: 'OSI application layer or non-OSI equivalent.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'http',
    deprecation: {
      replacement: 'network.protocol.name',
    },
    aliases: ['network.protocol.name'],
  },
  [AttributeName.NET_PROTOCOL_VERSION]: {
    brief: 'The actual version of the protocol used for network communication.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '1.1',
    deprecation: {
      replacement: 'network.protocol.version',
    },
    aliases: ['network.protocol.version', 'http.flavor'],
  },
  [AttributeName.NET_SOCK_FAMILY]: {
    brief: 'OSI transport and network layer',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'inet',
    deprecation: {
      replacement: 'network.transport',
      reason: 'Deprecated, use network.transport and network.type.',
    },
  },
  [AttributeName.NET_SOCK_HOST_ADDR]: {
    brief: 'Local address of the network connection mapping to Unix domain socket name.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '/var/my.sock',
    deprecation: {
      replacement: 'network.local.address',
    },
    aliases: ['network.local.address', 'net.host.ip'],
  },
  [AttributeName.NET_SOCK_HOST_PORT]: {
    brief: 'Local port number of the network connection.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 8080,
    deprecation: {
      replacement: 'network.local.port',
    },
    aliases: ['network.local.port'],
  },
  [AttributeName.NET_SOCK_PEER_ADDR]: {
    brief: 'Peer address of the network connection - IP address',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '192.168.0.1',
    deprecation: {
      replacement: 'network.peer.address',
    },
    aliases: ['network.peer.address', 'net.peer.ip'],
  },
  [AttributeName.NET_SOCK_PEER_NAME]: {
    brief: 'Peer address of the network connection - Unix domain socket name',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '/var/my.sock',
    deprecation: {
      reason: 'Deprecated from OTEL, no replacement at this time',
    },
  },
  [AttributeName.NET_SOCK_PEER_PORT]: {
    brief: 'Peer port number of the network connection.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 8080,
    deprecation: {
      replacement: 'network.peer.port',
    },
  },
  [AttributeName.NET_TRANSPORT]: {
    brief: 'OSI transport layer or inter-process communication method.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'tcp',
    deprecation: {
      replacement: 'network.transport',
    },
    aliases: ['network.transport'],
  },
  [AttributeName.NETWORK_LOCAL_ADDRESS]: {
    brief:
      'Local address of the network connection - IP address or Unix domain socket name.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '10.1.2.80',
    aliases: ['net.host.ip', 'net.sock.host.addr'],
  },
  [AttributeName.NETWORK_LOCAL_PORT]: {
    brief: 'Local port number of the network connection.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 65400,
    aliases: ['net.sock.host.port'],
  },
  [AttributeName.NETWORK_PEER_ADDRESS]: {
    brief:
      'Peer address of the network connection - IP address or Unix domain socket name.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '10.1.2.80',
    aliases: ['net.peer.ip', 'net.sock.peer.addr'],
  },
  [AttributeName.NETWORK_PEER_PORT]: {
    brief: 'Peer port number of the network connection.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 65400,
  },
  [AttributeName.NETWORK_PROTOCOL_NAME]: {
    brief: 'OSI application layer or non-OSI equivalent.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'http',
    aliases: ['net.protocol.name'],
  },
  [AttributeName.NETWORK_PROTOCOL_VERSION]: {
    brief: 'The actual version of the protocol used for network communication.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '1.1',
    aliases: ['http.flavor', 'net.protocol.version'],
  },
  [AttributeName.NETWORK_TRANSPORT]: {
    brief: 'OSI transport layer or inter-process communication method.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'tcp',
    aliases: ['net.transport'],
  },
  [AttributeName.NETWORK_TYPE]: {
    brief: 'OSI network layer or non-OSI equivalent.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'ipv4',
  },
  [AttributeName.OS_BUILD_ID]: {
    brief: 'The build ID of the operating system.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '1234567890',
  },
  [AttributeName.OS_DESCRIPTION]: {
    brief:
      'Human readable (not intended to be parsed) OS version information, like e.g. reported by ver or lsb_release -a commands.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'Ubuntu 18.04.1 LTS',
  },
  [AttributeName.OS_NAME]: {
    brief: 'Human readable operating system name.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'Ubuntu',
  },
  [AttributeName.OS_TYPE]: {
    brief: 'The operating system type.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'linux',
  },
  [AttributeName.OS_VERSION]: {
    brief: 'The version of the operating system.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '18.04.2',
  },
  [AttributeName.OTEL_SCOPE_NAME]: {
    brief: 'The name of the instrumentation scope - (InstrumentationScope.Name in OTLP).',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'io.opentelemetry.contrib.mongodb',
  },
  [AttributeName.OTEL_SCOPE_VERSION]: {
    brief:
      'The version of the instrumentation scope - (InstrumentationScope.Version in OTLP).',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '2.4.5',
  },
  [AttributeName.OTEL_STATUS_CODE]: {
    brief:
      'Name of the code, either “OK” or “ERROR”. MUST NOT be set if the status code is UNSET.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'OK',
  },
  [AttributeName.OTEL_STATUS_DESCRIPTION]: {
    brief: 'Description of the Status if it has a value, otherwise not set.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'resource not found',
  },
  [AttributeName.PARAMS_KEY]: {
    brief:
      'Decoded parameters extracted from a URL path. Usually added by client-side routing frameworks like vue-router.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    hasDynamicSuffix: true,
    example: "params.id='123'",
    aliases: ['url.path.parameter.<key>'],
  },
  [AttributeName.PREVIOUS_ROUTE]: {
    brief: 'Also used by mobile SDKs to indicate the previous route in the application.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'HomeScreen',
    sdks: ['javascript-reactnative'],
  },
  [AttributeName.PROCESS_EXECUTABLE_NAME]: {
    brief: 'The name of the executable that started the process.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'getsentry',
  },
  [AttributeName.PROCESS_PID]: {
    brief: 'The process ID of the running process.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 12345,
  },
  [AttributeName.PROCESS_RUNTIME_DESCRIPTION]: {
    brief:
      'An additional description about the runtime of the process, for example a specific vendor customization of the runtime environment. Equivalent to `raw_description` in the Sentry runtime context.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'Eclipse OpenJ9 VM openj9-0.21.0',
  },
  [AttributeName.PROCESS_RUNTIME_NAME]: {
    brief: 'The name of the runtime. Equivalent to `name` in the Sentry runtime context.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'node',
  },
  [AttributeName.PROCESS_RUNTIME_VERSION]: {
    brief:
      'The version of the runtime of this process, as returned by the runtime without modification. Equivalent to `version` in the Sentry runtime context.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '18.04.2',
  },
  [AttributeName.PROFILE_ID]: {
    brief: 'The id of the sentry profile.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: '123e4567e89b12d3a456426614174000',
    deprecation: {
      replacement: 'sentry.profile_id',
    },
    aliases: ['sentry.profile_id'],
  },
  [AttributeName.QUERY_KEY]: {
    brief:
      'An item in a query string. Usually added by client-side routing frameworks like vue-router.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    hasDynamicSuffix: true,
    example: "query.id='123'",
    deprecation: {
      replacement: 'url.query',
      reason:
        'Instead of sending items individually in query.<key>, they should be sent all together with url.query.',
    },
  },
  [AttributeName.RELEASE]: {
    brief: 'The sentry release.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'production',
    deprecation: {
      replacement: 'sentry.release',
    },
    aliases: ['sentry.release'],
  },
  [AttributeName.REMIX_ACTION_FORM_DATA_KEY]: {
    brief:
      'Remix form data, <key> being the form data key, the value being the form data value.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    hasDynamicSuffix: true,
    example: "http.response.header.text='test'",
    sdks: ['javascript-remix'],
  },
  [AttributeName.REPLAY_ID]: {
    brief: 'The id of the sentry replay.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: '123e4567e89b12d3a456426614174000',
    deprecation: {
      replacement: 'sentry.replay_id',
    },
    aliases: ['sentry.replay_id'],
  },
  [AttributeName.RESOURCE_RENDER_BLOCKING_STATUS]: {
    brief: 'The render blocking status of the resource.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'non-blocking',
    sdks: ['javascript-browser'],
  },
  [AttributeName.ROUTE]: {
    brief:
      'The matched route, that is, the path template in the format used by the respective server framework. Also used by mobile SDKs to indicate the current route in the application.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'App\\Controller::indexAction',
    deprecation: {
      replacement: 'http.route',
    },
    aliases: ['http.route'],
    sdks: ['php-laravel', 'javascript-reactnative'],
  },
  [AttributeName.RPC_GRPC_STATUS_CODE]: {
    brief: 'The numeric status code of the gRPC request.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 2,
  },
  [AttributeName.RPC_SERVICE]: {
    brief:
      'The full (logical) name of the service being called, including its package name, if applicable.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'myService.BestService',
  },
  [AttributeName.SENTRY_INTERNAL_DSC_ENVIRONMENT]: {
    brief: 'The environment from the dynamic sampling context.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 'prod',
  },
  [AttributeName.SENTRY_INTERNAL_DSC_ORG_ID]: {
    brief: 'The organization ID from the dynamic sampling context.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: '1',
  },
  [AttributeName.SENTRY_INTERNAL_DSC_PUBLIC_KEY]: {
    brief: 'The public key from the dynamic sampling context.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'c51734c603c4430eb57cb0a5728a479d',
  },
  [AttributeName.SENTRY_INTERNAL_DSC_RELEASE]: {
    brief: 'The release identifier from the dynamic sampling context.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 'frontend@e8211be71b214afab5b85de4b4c54be3714952bb',
  },
  [AttributeName.SENTRY_INTERNAL_DSC_SAMPLE_RAND]: {
    brief: 'The random sampling value from the dynamic sampling context.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: '0.8286147972820134',
  },
  [AttributeName.SENTRY_INTERNAL_DSC_SAMPLE_RATE]: {
    brief: 'The sample rate from the dynamic sampling context.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: '1.0',
  },
  [AttributeName.SENTRY_INTERNAL_DSC_SAMPLED]: {
    brief: 'Whether the event was sampled according to the dynamic sampling context.',
    type: AttributeType.BOOLEAN,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: true,
  },
  [AttributeName.SENTRY_INTERNAL_DSC_TRACE_ID]: {
    brief: 'The trace ID from the dynamic sampling context.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: '047372980460430cbc78d9779df33a46',
  },
  [AttributeName.SENTRY_INTERNAL_DSC_TRANSACTION]: {
    brief: 'The transaction name from the dynamic sampling context.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: '/issues/errors-outages/',
  },
  [AttributeName.SENTRY_INTERNAL_OBSERVED_TIMESTAMP_NANOS]: {
    brief: 'The timestamp at which an envelope was received by Relay, in nanoseconds.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: '1544712660300000000',
    aliases: ['sentry.observed_timestamp_nanos'],
  },
  [AttributeName.SENTRY_INTERNAL_REPLAY_IS_BUFFERING]: {
    brief:
      'A sentinel attribute on log events indicating whether the current Session Replay is being buffered (onErrorSampleRate).',
    type: AttributeType.BOOLEAN,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: true,
  },
  [AttributeName.SENTRY_BROWSER_NAME]: {
    brief: 'The name of the browser.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'Chrome',
    deprecation: {
      replacement: 'browser.name',
    },
    aliases: ['browser.name'],
  },
  [AttributeName.SENTRY_BROWSER_VERSION]: {
    brief: 'The version of the browser.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: '120.0.6099.130',
    deprecation: {
      replacement: 'browser.version',
    },
    aliases: ['browser.version'],
  },
  [AttributeName.SENTRY_CANCELLATION_REASON]: {
    brief: 'The reason why a span ended early.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 'document.hidden',
  },
  [AttributeName.SENTRY_CLIENT_SAMPLE_RATE]: {
    brief: 'Rate at which a span was sampled in the SDK.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 0.5,
  },
  [AttributeName.SENTRY_DESCRIPTION]: {
    brief: 'The human-readable description of a span.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'index view query',
  },
  [AttributeName.SENTRY_DIST]: {
    brief: 'The sentry dist.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: '1.0',
  },
  [AttributeName.SENTRY_ENVIRONMENT]: {
    brief: 'The sentry environment.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 'production',
    aliases: ['environment'],
  },
  [AttributeName.SENTRY_EXCLUSIVE_TIME]: {
    brief: 'The exclusive time duration of the span.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 1234,
  },
  [AttributeName.SENTRY_HTTP_PREFETCH]: {
    brief: 'If an http request was a prefetch request.',
    type: AttributeType.BOOLEAN,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: true,
  },
  [AttributeName.SENTRY_IDLE_SPAN_FINISH_REASON]: {
    brief: 'The reason why an idle span ended early.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 'idleTimeout',
  },
  [AttributeName.SENTRY_MESSAGE_PARAMETER_KEY]: {
    brief:
      "A parameter used in the message template. <key> can either be the number that represent the parameter's position in the template string (sentry.message.parameter.0, sentry.message.parameter.1, etc) or the parameter's name (sentry.message.parameter.item_id, sentry.message.parameter.user_id, etc)",
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: "sentry.message.parameter.0='123'",
  },
  [AttributeName.SENTRY_MESSAGE_TEMPLATE]: {
    brief: 'The parameterized template string.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'Hello, {name}!',
  },
  [AttributeName.SENTRY_MODULE_KEY]: {
    brief: 'A module that was loaded in the process. The key is the name of the module.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    hasDynamicSuffix: true,
    example: "sentry.module.brianium/paratest='v7.7.0'",
  },
  [AttributeName.SENTRY_NEXTJS_SSR_FUNCTION_ROUTE]: {
    brief:
      'A parameterized route for a function in Next.js that contributes to Server-Side Rendering. Should be present on spans that track such functions when the file location of the function is known.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: '/posts/[id]/layout',
    sdks: ['javascript'],
  },
  [AttributeName.SENTRY_NEXTJS_SSR_FUNCTION_TYPE]: {
    brief:
      'A descriptor for a for a function in Next.js that contributes to Server-Side Rendering. Should be present on spans that track such functions.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 'generateMetadata',
    sdks: ['javascript'],
  },
  [AttributeName.SENTRY_OBSERVED_TIMESTAMP_NANOS]: {
    brief: 'The timestamp at which an envelope was received by Relay, in nanoseconds.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: '1544712660300000000',
    deprecation: {
      replacement: 'sentry._internal.observed_timestamp_nanos',
    },
    aliases: ['sentry._internal.observed_timestamp_nanos'],
  },
  [AttributeName.SENTRY_OP]: {
    brief: 'The operation of a span.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 'http.client',
  },
  [AttributeName.SENTRY_ORIGIN]: {
    brief: 'The origin of the instrumentation (e.g. span, log, etc.)',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 'auto.http.otel.fastify',
  },
  [AttributeName.SENTRY_PLATFORM]: {
    brief: 'The sdk platform that generated the event.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 'php',
  },
  [AttributeName.SENTRY_PROFILE_ID]: {
    brief: 'The id of the sentry profile.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: '123e4567e89b12d3a456426614174000',
    aliases: ['profile_id'],
  },
  [AttributeName.SENTRY_RELEASE]: {
    brief: 'The sentry release.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: '7.0.0',
    aliases: ['service.version', 'release'],
  },
  [AttributeName.SENTRY_REPLAY_ID]: {
    brief: 'The id of the sentry replay.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: '123e4567e89b12d3a456426614174000',
    aliases: ['replay_id'],
  },
  [AttributeName.SENTRY_SDK_INTEGRATIONS]: {
    brief:
      'A list of names identifying enabled integrations. The list shouldhave all enabled integrations, including default integrations. Defaultintegrations are included because different SDK releases may contain differentdefault integrations.',
    type: AttributeType.STRING_ARRAY,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: ['InboundFilters', 'FunctionToString', 'BrowserApiErrors', 'Breadcrumbs'],
  },
  [AttributeName.SENTRY_SDK_NAME]: {
    brief: 'The sentry sdk name.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: '@sentry/react',
  },
  [AttributeName.SENTRY_SDK_VERSION]: {
    brief: 'The sentry sdk version.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: '7.0.0',
  },
  [AttributeName.SENTRY_SEGMENT_ID]: {
    brief: 'The segment ID of a span',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: '051581bf3cb55c13',
    aliases: ['sentry.segment_id'],
  },
  [AttributeName.SENTRY_SEGMENT_NAME]: {
    brief: 'The segment name of a span',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'GET /user',
  },
  [AttributeName._SENTRY_SEGMENT_ID]: {
    brief: 'The segment ID of a span',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: '051581bf3cb55c13',
    deprecation: {
      replacement: 'sentry.segment.id',
    },
    aliases: ['sentry.segment.id'],
  },
  [AttributeName.SENTRY_SERVER_SAMPLE_RATE]: {
    brief: 'Rate at which a span was sampled in Relay.',
    type: AttributeType.DOUBLE,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 0.5,
  },
  [AttributeName.SENTRY_SPAN_SOURCE]: {
    brief: 'The source of a span, also referred to as transaction source.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 'route',
  },
  [AttributeName.SENTRY_TRACE_PARENT_SPAN_ID]: {
    brief:
      'The span id of the span that was active when the log was collected. This should not be set if there was no active span.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 'b0e6f15b45c36b12',
  },
  [AttributeName.SENTRY_TRANSACTION]: {
    brief: 'The sentry transaction (segment name).',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 'GET /',
    aliases: ['transaction'],
  },
  [AttributeName.SERVER_ADDRESS]: {
    brief:
      'Server domain name if available without reverse DNS lookup; otherwise, IP address or Unix domain socket name.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'example.com',
    aliases: ['http.server_name', 'net.host.name', 'http.host'],
  },
  [AttributeName.SERVER_PORT]: {
    brief: 'Server port number.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 1337,
    aliases: ['net.host.port'],
  },
  [AttributeName.SERVICE_NAME]: {
    brief: 'Logical name of the service.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'omegastar',
  },
  [AttributeName.SERVICE_VERSION]: {
    brief:
      'The version string of the service API or implementation. The format is not defined by these conventions.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '5.0.0',
    aliases: ['sentry.release'],
  },
  [AttributeName.THREAD_ID]: {
    brief: 'Current “managed” thread ID.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 56,
  },
  [AttributeName.THREAD_NAME]: {
    brief: 'Current thread name.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'main',
  },
  [AttributeName.TRANSACTION]: {
    brief: 'The sentry transaction (segment name).',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'GET /',
    deprecation: {
      replacement: 'sentry.transaction',
    },
    aliases: ['sentry.transaction'],
  },
  [AttributeName.TYPE]: {
    brief: 'More granular type of the operation happening.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: 'fetch',
    sdks: ['javascript-browser', 'javascript-node'],
  },
  [AttributeName.UI_COMPONENT_NAME]: {
    brief: 'The name of the associated component.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'HomeButton',
  },
  [AttributeName.UI_CONTRIBUTES_TO_TTFD]: {
    brief:
      'Whether the span execution contributed to the TTFD (time to fully drawn) metric.',
    type: AttributeType.BOOLEAN,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: true,
  },
  [AttributeName.UI_CONTRIBUTES_TO_TTID]: {
    brief:
      'Whether the span execution contributed to the TTID (time to initial display) metric.',
    type: AttributeType.BOOLEAN,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: false,
    example: true,
  },
  [AttributeName.URL_DOMAIN]: {
    brief:
      'Server domain name if available without reverse DNS lookup; otherwise, IP address or Unix domain socket name.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'example.com',
  },
  [AttributeName.URL_FRAGMENT]: {
    brief:
      'The fragments present in the URI. Note that this does not contain the leading # character, while the `http.fragment` attribute does.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'details',
  },
  [AttributeName.URL_FULL]: {
    brief: 'The URL of the resource that was fetched.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'https://example.com/test?foo=bar#buzz',
    aliases: ['http.url', 'url'],
  },
  [AttributeName.URL_PATH]: {
    brief: 'The URI path component.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '/foo',
  },
  [AttributeName.URL_PATH_PARAMETER_KEY]: {
    brief:
      'Decoded parameters extracted from a URL path. Usually added by client-side routing frameworks like vue-router.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    hasDynamicSuffix: true,
    example: "url.path.parameter.id='123'",
    aliases: ['params.<key>'],
  },
  [AttributeName.URL_PORT]: {
    brief: 'Server port number.',
    type: AttributeType.INTEGER,
    pii: {
      isPii: IsPii.FALSE,
    },
    isInOtel: true,
    example: 1337,
  },
  [AttributeName.URL_QUERY]: {
    brief:
      'The query string present in the URL. Note that this does not contain the leading ? character, while the `http.query` attribute does.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
      reason:
        'Query string values can contain sensitive information. Clients should attempt to scrub parameters that might contain sensitive information.',
    },
    isInOtel: true,
    example: 'foo=bar&bar=baz',
  },
  [AttributeName.URL_SCHEME]: {
    brief: 'The URI scheme component identifying the used protocol.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: 'https',
    aliases: ['http.scheme'],
  },
  [AttributeName.URL_TEMPLATE]: {
    brief: 'The low-cardinality template of an absolute path reference.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example: '/users/:id',
    aliases: ['http.route'],
  },
  [AttributeName.URL]: {
    brief: 'The URL of the resource that was fetched.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'https://example.com/test?foo=bar#buzz',
    deprecation: {
      replacement: 'url.full',
    },
    aliases: ['url.full', 'http.url'],
    sdks: ['javascript-browser', 'javascript-node'],
  },
  [AttributeName.USER_EMAIL]: {
    brief: 'User email address.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: true,
    example: 'test@example.com',
  },
  [AttributeName.USER_FULL_NAME]: {
    brief: "User's full name.",
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: true,
    example: 'John Smith',
  },
  [AttributeName.USER_GEO_CITY]: {
    brief: 'Human readable city name.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'Toronto',
  },
  [AttributeName.USER_GEO_COUNTRY_CODE]: {
    brief: 'Two-letter country code (ISO 3166-1 alpha-2).',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'CA',
  },
  [AttributeName.USER_GEO_REGION]: {
    brief: 'Human readable region name or code.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'Canada',
  },
  [AttributeName.USER_GEO_SUBDIVISION]: {
    brief: 'Human readable subdivision name.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: false,
    example: 'Ontario',
  },
  [AttributeName.USER_HASH]: {
    brief: 'Unique user hash to correlate information for a user in anonymized form.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: true,
    example: '8ae4c2993e0f4f3b8b2d1b1f3b5e8f4d',
  },
  [AttributeName.USER_ID]: {
    brief: 'Unique identifier of the user.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: true,
    example: 'S-1-5-21-202424912787-2692429404-2351956786-1000',
  },
  [AttributeName.USER_IP_ADDRESS]: {
    brief: 'The IP address of the user.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: false,
    example: '192.168.1.1',
  },
  [AttributeName.USER_NAME]: {
    brief: 'Short name or login/username of the user.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: true,
    example: 'j.smith',
  },
  [AttributeName.USER_ROLES]: {
    brief: 'Array of user roles at the time of the event.',
    type: AttributeType.STRING_ARRAY,
    pii: {
      isPii: IsPii.TRUE,
    },
    isInOtel: true,
    example: ['admin', 'editor'],
  },
  [AttributeName.USER_AGENT_ORIGINAL]: {
    brief: 'Value of the HTTP User-Agent header sent by the client.',
    type: AttributeType.STRING,
    pii: {
      isPii: IsPii.MAYBE,
    },
    isInOtel: true,
    example:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
    aliases: ['http.user_agent'],
  },
};

export type AttributeValue = string | number | boolean | string[] | number[] | boolean[];

export type Attributes = {
  [AI_CITATIONS]?: AI_CITATIONS_TYPE;
  [AI_COMPLETION_TOKENS_USED]?: AI_COMPLETION_TOKENS_USED_TYPE;
  [AI_DOCUMENTS]?: AI_DOCUMENTS_TYPE;
  [AI_FINISH_REASON]?: AI_FINISH_REASON_TYPE;
  [AI_FREQUENCY_PENALTY]?: AI_FREQUENCY_PENALTY_TYPE;
  [AI_FUNCTION_CALL]?: AI_FUNCTION_CALL_TYPE;
  [AI_GENERATION_ID]?: AI_GENERATION_ID_TYPE;
  [AI_INPUT_MESSAGES]?: AI_INPUT_MESSAGES_TYPE;
  [AI_IS_SEARCH_REQUIRED]?: AI_IS_SEARCH_REQUIRED_TYPE;
  [AI_METADATA]?: AI_METADATA_TYPE;
  [AI_MODEL_ID]?: AI_MODEL_ID_TYPE;
  [AI_MODEL_PROVIDER]?: AI_MODEL_PROVIDER_TYPE;
  [AI_PIPELINE_NAME]?: AI_PIPELINE_NAME_TYPE;
  [AI_PREAMBLE]?: AI_PREAMBLE_TYPE;
  [AI_PRESENCE_PENALTY]?: AI_PRESENCE_PENALTY_TYPE;
  [AI_PROMPT_TOKENS_USED]?: AI_PROMPT_TOKENS_USED_TYPE;
  [AI_RAW_PROMPTING]?: AI_RAW_PROMPTING_TYPE;
  [AI_RESPONSES]?: AI_RESPONSES_TYPE;
  [AI_RESPONSE_FORMAT]?: AI_RESPONSE_FORMAT_TYPE;
  [AI_SEARCH_QUERIES]?: AI_SEARCH_QUERIES_TYPE;
  [AI_SEARCH_RESULTS]?: AI_SEARCH_RESULTS_TYPE;
  [AI_SEED]?: AI_SEED_TYPE;
  [AI_STREAMING]?: AI_STREAMING_TYPE;
  [AI_TAGS]?: AI_TAGS_TYPE;
  [AI_TEMPERATURE]?: AI_TEMPERATURE_TYPE;
  [AI_TEXTS]?: AI_TEXTS_TYPE;
  [AI_TOOLS]?: AI_TOOLS_TYPE;
  [AI_TOOL_CALLS]?: AI_TOOL_CALLS_TYPE;
  [AI_TOP_K]?: AI_TOP_K_TYPE;
  [AI_TOP_P]?: AI_TOP_P_TYPE;
  [AI_TOTAL_COST]?: AI_TOTAL_COST_TYPE;
  [AI_TOTAL_TOKENS_USED]?: AI_TOTAL_TOKENS_USED_TYPE;
  [AI_WARNINGS]?: AI_WARNINGS_TYPE;
  [APP_START_TYPE]?: APP_START_TYPE_TYPE;
  [BLOCKED_MAIN_THREAD]?: BLOCKED_MAIN_THREAD_TYPE;
  [BROWSER_NAME]?: BROWSER_NAME_TYPE;
  [BROWSER_REPORT_TYPE]?: BROWSER_REPORT_TYPE_TYPE;
  [BROWSER_SCRIPT_INVOKER]?: BROWSER_SCRIPT_INVOKER_TYPE;
  [BROWSER_SCRIPT_INVOKER_TYPE]?: BROWSER_SCRIPT_INVOKER_TYPE_TYPE;
  [BROWSER_SCRIPT_SOURCE_CHAR_POSITION]?: BROWSER_SCRIPT_SOURCE_CHAR_POSITION_TYPE;
  [BROWSER_VERSION]?: BROWSER_VERSION_TYPE;
  [CACHE_HIT]?: CACHE_HIT_TYPE;
  [CACHE_ITEM_SIZE]?: CACHE_ITEM_SIZE_TYPE;
  [CACHE_KEY]?: CACHE_KEY_TYPE;
  [CACHE_OPERATION]?: CACHE_OPERATION_TYPE;
  [CACHE_TTL]?: CACHE_TTL_TYPE;
  [CHANNEL]?: CHANNEL_TYPE;
  [CLIENT_ADDRESS]?: CLIENT_ADDRESS_TYPE;
  [CLIENT_PORT]?: CLIENT_PORT_TYPE;
  [CLOUDFLARE_D1_DURATION]?: CLOUDFLARE_D1_DURATION_TYPE;
  [CLOUDFLARE_D1_ROWS_READ]?: CLOUDFLARE_D1_ROWS_READ_TYPE;
  [CLOUDFLARE_D1_ROWS_WRITTEN]?: CLOUDFLARE_D1_ROWS_WRITTEN_TYPE;
  [CODE_FILEPATH]?: CODE_FILEPATH_TYPE;
  [CODE_FILE_PATH]?: CODE_FILE_PATH_TYPE;
  [CODE_FUNCTION]?: CODE_FUNCTION_TYPE;
  [CODE_FUNCTION_NAME]?: CODE_FUNCTION_NAME_TYPE;
  [CODE_LINENO]?: CODE_LINENO_TYPE;
  [CODE_LINE_NUMBER]?: CODE_LINE_NUMBER_TYPE;
  [CODE_NAMESPACE]?: CODE_NAMESPACE_TYPE;
  [DB_COLLECTION_NAME]?: DB_COLLECTION_NAME_TYPE;
  [DB_NAME]?: DB_NAME_TYPE;
  [DB_NAMESPACE]?: DB_NAMESPACE_TYPE;
  [DB_OPERATION]?: DB_OPERATION_TYPE;
  [DB_OPERATION_NAME]?: DB_OPERATION_NAME_TYPE;
  [DB_QUERY_PARAMETER_KEY]?: DB_QUERY_PARAMETER_KEY_TYPE;
  [DB_QUERY_SUMMARY]?: DB_QUERY_SUMMARY_TYPE;
  [DB_QUERY_TEXT]?: DB_QUERY_TEXT_TYPE;
  [DB_REDIS_CONNECTION]?: DB_REDIS_CONNECTION_TYPE;
  [DB_REDIS_PARAMETERS]?: DB_REDIS_PARAMETERS_TYPE;
  [DB_SQL_BINDINGS]?: DB_SQL_BINDINGS_TYPE;
  [DB_STATEMENT]?: DB_STATEMENT_TYPE;
  [DB_SYSTEM]?: DB_SYSTEM_TYPE;
  [DB_SYSTEM_NAME]?: DB_SYSTEM_NAME_TYPE;
  [DB_USER]?: DB_USER_TYPE;
  [DEVICE_BRAND]?: DEVICE_BRAND_TYPE;
  [DEVICE_FAMILY]?: DEVICE_FAMILY_TYPE;
  [DEVICE_MODEL]?: DEVICE_MODEL_TYPE;
  [ENVIRONMENT]?: ENVIRONMENT_TYPE;
  [ERROR_TYPE]?: ERROR_TYPE_TYPE;
  [EVENT_ID]?: EVENT_ID_TYPE;
  [EVENT_NAME]?: EVENT_NAME_TYPE;
  [EXCEPTION_ESCAPED]?: EXCEPTION_ESCAPED_TYPE;
  [EXCEPTION_MESSAGE]?: EXCEPTION_MESSAGE_TYPE;
  [EXCEPTION_STACKTRACE]?: EXCEPTION_STACKTRACE_TYPE;
  [EXCEPTION_TYPE]?: EXCEPTION_TYPE_TYPE;
  [FAAS_COLDSTART]?: FAAS_COLDSTART_TYPE;
  [FAAS_CRON]?: FAAS_CRON_TYPE;
  [FAAS_TIME]?: FAAS_TIME_TYPE;
  [FAAS_TRIGGER]?: FAAS_TRIGGER_TYPE;
  [FLAG_EVALUATION_KEY]?: FLAG_EVALUATION_KEY_TYPE;
  [FRAMES_DELAY]?: FRAMES_DELAY_TYPE;
  [FRAMES_FROZEN]?: FRAMES_FROZEN_TYPE;
  [FRAMES_SLOW]?: FRAMES_SLOW_TYPE;
  [FRAMES_TOTAL]?: FRAMES_TOTAL_TYPE;
  [FS_ERROR]?: FS_ERROR_TYPE;
  [GEN_AI_AGENT_NAME]?: GEN_AI_AGENT_NAME_TYPE;
  [GEN_AI_ASSISTANT_MESSAGE]?: GEN_AI_ASSISTANT_MESSAGE_TYPE;
  [GEN_AI_CHOICE]?: GEN_AI_CHOICE_TYPE;
  [GEN_AI_COST_INPUT_TOKENS]?: GEN_AI_COST_INPUT_TOKENS_TYPE;
  [GEN_AI_COST_OUTPUT_TOKENS]?: GEN_AI_COST_OUTPUT_TOKENS_TYPE;
  [GEN_AI_COST_TOTAL_TOKENS]?: GEN_AI_COST_TOTAL_TOKENS_TYPE;
  [GEN_AI_OPERATION_NAME]?: GEN_AI_OPERATION_NAME_TYPE;
  [GEN_AI_OPERATION_TYPE]?: GEN_AI_OPERATION_TYPE_TYPE;
  [GEN_AI_PIPELINE_NAME]?: GEN_AI_PIPELINE_NAME_TYPE;
  [GEN_AI_PROMPT]?: GEN_AI_PROMPT_TYPE;
  [GEN_AI_REQUEST_AVAILABLE_TOOLS]?: GEN_AI_REQUEST_AVAILABLE_TOOLS_TYPE;
  [GEN_AI_REQUEST_FREQUENCY_PENALTY]?: GEN_AI_REQUEST_FREQUENCY_PENALTY_TYPE;
  [GEN_AI_REQUEST_MAX_TOKENS]?: GEN_AI_REQUEST_MAX_TOKENS_TYPE;
  [GEN_AI_REQUEST_MESSAGES]?: GEN_AI_REQUEST_MESSAGES_TYPE;
  [GEN_AI_REQUEST_MODEL]?: GEN_AI_REQUEST_MODEL_TYPE;
  [GEN_AI_REQUEST_PRESENCE_PENALTY]?: GEN_AI_REQUEST_PRESENCE_PENALTY_TYPE;
  [GEN_AI_REQUEST_SEED]?: GEN_AI_REQUEST_SEED_TYPE;
  [GEN_AI_REQUEST_TEMPERATURE]?: GEN_AI_REQUEST_TEMPERATURE_TYPE;
  [GEN_AI_REQUEST_TOP_K]?: GEN_AI_REQUEST_TOP_K_TYPE;
  [GEN_AI_REQUEST_TOP_P]?: GEN_AI_REQUEST_TOP_P_TYPE;
  [GEN_AI_RESPONSE_FINISH_REASONS]?: GEN_AI_RESPONSE_FINISH_REASONS_TYPE;
  [GEN_AI_RESPONSE_ID]?: GEN_AI_RESPONSE_ID_TYPE;
  [GEN_AI_RESPONSE_MODEL]?: GEN_AI_RESPONSE_MODEL_TYPE;
  [GEN_AI_RESPONSE_STREAMING]?: GEN_AI_RESPONSE_STREAMING_TYPE;
  [GEN_AI_RESPONSE_TEXT]?: GEN_AI_RESPONSE_TEXT_TYPE;
  [GEN_AI_RESPONSE_TOKENS_PER_SECOND]?: GEN_AI_RESPONSE_TOKENS_PER_SECOND_TYPE;
  [GEN_AI_RESPONSE_TOOL_CALLS]?: GEN_AI_RESPONSE_TOOL_CALLS_TYPE;
  [GEN_AI_SYSTEM]?: GEN_AI_SYSTEM_TYPE;
  [GEN_AI_SYSTEM_MESSAGE]?: GEN_AI_SYSTEM_MESSAGE_TYPE;
  [GEN_AI_TOOL_DESCRIPTION]?: GEN_AI_TOOL_DESCRIPTION_TYPE;
  [GEN_AI_TOOL_INPUT]?: GEN_AI_TOOL_INPUT_TYPE;
  [GEN_AI_TOOL_MESSAGE]?: GEN_AI_TOOL_MESSAGE_TYPE;
  [GEN_AI_TOOL_NAME]?: GEN_AI_TOOL_NAME_TYPE;
  [GEN_AI_TOOL_OUTPUT]?: GEN_AI_TOOL_OUTPUT_TYPE;
  [GEN_AI_TOOL_TYPE]?: GEN_AI_TOOL_TYPE_TYPE;
  [GEN_AI_USAGE_COMPLETION_TOKENS]?: GEN_AI_USAGE_COMPLETION_TOKENS_TYPE;
  [GEN_AI_USAGE_INPUT_TOKENS]?: GEN_AI_USAGE_INPUT_TOKENS_TYPE;
  [GEN_AI_USAGE_INPUT_TOKENS_CACHED]?: GEN_AI_USAGE_INPUT_TOKENS_CACHED_TYPE;
  [GEN_AI_USAGE_OUTPUT_TOKENS]?: GEN_AI_USAGE_OUTPUT_TOKENS_TYPE;
  [GEN_AI_USAGE_OUTPUT_TOKENS_REASONING]?: GEN_AI_USAGE_OUTPUT_TOKENS_REASONING_TYPE;
  [GEN_AI_USAGE_PROMPT_TOKENS]?: GEN_AI_USAGE_PROMPT_TOKENS_TYPE;
  [GEN_AI_USAGE_TOTAL_COST]?: GEN_AI_USAGE_TOTAL_COST_TYPE;
  [GEN_AI_USAGE_TOTAL_TOKENS]?: GEN_AI_USAGE_TOTAL_TOKENS_TYPE;
  [GEN_AI_USER_MESSAGE]?: GEN_AI_USER_MESSAGE_TYPE;
  [GRAPHQL_OPERATION_NAME]?: GRAPHQL_OPERATION_NAME_TYPE;
  [GRAPHQL_OPERATION_TYPE]?: GRAPHQL_OPERATION_TYPE_TYPE;
  [HTTP_CLIENT_IP]?: HTTP_CLIENT_IP_TYPE;
  [HTTP_DECODED_RESPONSE_CONTENT_LENGTH]?: HTTP_DECODED_RESPONSE_CONTENT_LENGTH_TYPE;
  [HTTP_FLAVOR]?: HTTP_FLAVOR_TYPE;
  [HTTP_FRAGMENT]?: HTTP_FRAGMENT_TYPE;
  [HTTP_HOST]?: HTTP_HOST_TYPE;
  [HTTP_METHOD]?: HTTP_METHOD_TYPE;
  [HTTP_QUERY]?: HTTP_QUERY_TYPE;
  [HTTP_REQUEST_CONNECTION_END]?: HTTP_REQUEST_CONNECTION_END_TYPE;
  [HTTP_REQUEST_CONNECT_START]?: HTTP_REQUEST_CONNECT_START_TYPE;
  [HTTP_REQUEST_DOMAIN_LOOKUP_END]?: HTTP_REQUEST_DOMAIN_LOOKUP_END_TYPE;
  [HTTP_REQUEST_DOMAIN_LOOKUP_START]?: HTTP_REQUEST_DOMAIN_LOOKUP_START_TYPE;
  [HTTP_REQUEST_FETCH_START]?: HTTP_REQUEST_FETCH_START_TYPE;
  [HTTP_REQUEST_HEADER_KEY]?: HTTP_REQUEST_HEADER_KEY_TYPE;
  [HTTP_REQUEST_METHOD]?: HTTP_REQUEST_METHOD_TYPE;
  [HTTP_REQUEST_REDIRECT_END]?: HTTP_REQUEST_REDIRECT_END_TYPE;
  [HTTP_REQUEST_REDIRECT_START]?: HTTP_REQUEST_REDIRECT_START_TYPE;
  [HTTP_REQUEST_REQUEST_START]?: HTTP_REQUEST_REQUEST_START_TYPE;
  [HTTP_REQUEST_RESEND_COUNT]?: HTTP_REQUEST_RESEND_COUNT_TYPE;
  [HTTP_REQUEST_RESPONSE_END]?: HTTP_REQUEST_RESPONSE_END_TYPE;
  [HTTP_REQUEST_RESPONSE_START]?: HTTP_REQUEST_RESPONSE_START_TYPE;
  [HTTP_REQUEST_SECURE_CONNECTION_START]?: HTTP_REQUEST_SECURE_CONNECTION_START_TYPE;
  [HTTP_REQUEST_TIME_TO_FIRST_BYTE]?: HTTP_REQUEST_TIME_TO_FIRST_BYTE_TYPE;
  [HTTP_REQUEST_WORKER_START]?: HTTP_REQUEST_WORKER_START_TYPE;
  [HTTP_RESPONSE_BODY_SIZE]?: HTTP_RESPONSE_BODY_SIZE_TYPE;
  [HTTP_RESPONSE_CONTENT_LENGTH]?: HTTP_RESPONSE_CONTENT_LENGTH_TYPE;
  [HTTP_RESPONSE_HEADER_CONTENT_LENGTH]?: HTTP_RESPONSE_HEADER_CONTENT_LENGTH_TYPE;
  [HTTP_RESPONSE_HEADER_KEY]?: HTTP_RESPONSE_HEADER_KEY_TYPE;
  [HTTP_RESPONSE_SIZE]?: HTTP_RESPONSE_SIZE_TYPE;
  [HTTP_RESPONSE_STATUS_CODE]?: HTTP_RESPONSE_STATUS_CODE_TYPE;
  [HTTP_RESPONSE_TRANSFER_SIZE]?: HTTP_RESPONSE_TRANSFER_SIZE_TYPE;
  [HTTP_ROUTE]?: HTTP_ROUTE_TYPE;
  [HTTP_SCHEME]?: HTTP_SCHEME_TYPE;
  [HTTP_SERVER_NAME]?: HTTP_SERVER_NAME_TYPE;
  [HTTP_STATUS_CODE]?: HTTP_STATUS_CODE_TYPE;
  [HTTP_TARGET]?: HTTP_TARGET_TYPE;
  [HTTP_URL]?: HTTP_URL_TYPE;
  [HTTP_USER_AGENT]?: HTTP_USER_AGENT_TYPE;
  [ID]?: ID_TYPE;
  [JVM_GC_ACTION]?: JVM_GC_ACTION_TYPE;
  [JVM_GC_NAME]?: JVM_GC_NAME_TYPE;
  [JVM_MEMORY_POOL_NAME]?: JVM_MEMORY_POOL_NAME_TYPE;
  [JVM_MEMORY_TYPE]?: JVM_MEMORY_TYPE_TYPE;
  [JVM_THREAD_DAEMON]?: JVM_THREAD_DAEMON_TYPE;
  [JVM_THREAD_STATE]?: JVM_THREAD_STATE_TYPE;
  [LCP_ELEMENT]?: LCP_ELEMENT_TYPE;
  [LCP_ID]?: LCP_ID_TYPE;
  [LCP_SIZE]?: LCP_SIZE_TYPE;
  [LCP_URL]?: LCP_URL_TYPE;
  [LOGGER_NAME]?: LOGGER_NAME_TYPE;
  [MESSAGING_DESTINATION_CONNECTION]?: MESSAGING_DESTINATION_CONNECTION_TYPE;
  [MESSAGING_DESTINATION_NAME]?: MESSAGING_DESTINATION_NAME_TYPE;
  [MESSAGING_MESSAGE_BODY_SIZE]?: MESSAGING_MESSAGE_BODY_SIZE_TYPE;
  [MESSAGING_MESSAGE_ENVELOPE_SIZE]?: MESSAGING_MESSAGE_ENVELOPE_SIZE_TYPE;
  [MESSAGING_MESSAGE_ID]?: MESSAGING_MESSAGE_ID_TYPE;
  [MESSAGING_MESSAGE_RECEIVE_LATENCY]?: MESSAGING_MESSAGE_RECEIVE_LATENCY_TYPE;
  [MESSAGING_MESSAGE_RETRY_COUNT]?: MESSAGING_MESSAGE_RETRY_COUNT_TYPE;
  [MESSAGING_OPERATION_TYPE]?: MESSAGING_OPERATION_TYPE_TYPE;
  [MESSAGING_SYSTEM]?: MESSAGING_SYSTEM_TYPE;
  [METHOD]?: METHOD_TYPE;
  [NAVIGATION_TYPE]?: NAVIGATION_TYPE_TYPE;
  [NEL_ELAPSED_TIME]?: NEL_ELAPSED_TIME_TYPE;
  [NEL_PHASE]?: NEL_PHASE_TYPE;
  [NEL_REFERRER]?: NEL_REFERRER_TYPE;
  [NEL_SAMPLING_FUNCTION]?: NEL_SAMPLING_FUNCTION_TYPE;
  [NEL_TYPE]?: NEL_TYPE_TYPE;
  [NETWORK_LOCAL_ADDRESS]?: NETWORK_LOCAL_ADDRESS_TYPE;
  [NETWORK_LOCAL_PORT]?: NETWORK_LOCAL_PORT_TYPE;
  [NETWORK_PEER_ADDRESS]?: NETWORK_PEER_ADDRESS_TYPE;
  [NETWORK_PEER_PORT]?: NETWORK_PEER_PORT_TYPE;
  [NETWORK_PROTOCOL_NAME]?: NETWORK_PROTOCOL_NAME_TYPE;
  [NETWORK_PROTOCOL_VERSION]?: NETWORK_PROTOCOL_VERSION_TYPE;
  [NETWORK_TRANSPORT]?: NETWORK_TRANSPORT_TYPE;
  [NETWORK_TYPE]?: NETWORK_TYPE_TYPE;
  [NET_HOST_IP]?: NET_HOST_IP_TYPE;
  [NET_HOST_NAME]?: NET_HOST_NAME_TYPE;
  [NET_HOST_PORT]?: NET_HOST_PORT_TYPE;
  [NET_PEER_IP]?: NET_PEER_IP_TYPE;
  [NET_PEER_NAME]?: NET_PEER_NAME_TYPE;
  [NET_PEER_PORT]?: NET_PEER_PORT_TYPE;
  [NET_PROTOCOL_NAME]?: NET_PROTOCOL_NAME_TYPE;
  [NET_PROTOCOL_VERSION]?: NET_PROTOCOL_VERSION_TYPE;
  [NET_SOCK_FAMILY]?: NET_SOCK_FAMILY_TYPE;
  [NET_SOCK_HOST_ADDR]?: NET_SOCK_HOST_ADDR_TYPE;
  [NET_SOCK_HOST_PORT]?: NET_SOCK_HOST_PORT_TYPE;
  [NET_SOCK_PEER_ADDR]?: NET_SOCK_PEER_ADDR_TYPE;
  [NET_SOCK_PEER_NAME]?: NET_SOCK_PEER_NAME_TYPE;
  [NET_SOCK_PEER_PORT]?: NET_SOCK_PEER_PORT_TYPE;
  [NET_TRANSPORT]?: NET_TRANSPORT_TYPE;
  [OS_BUILD_ID]?: OS_BUILD_ID_TYPE;
  [OS_DESCRIPTION]?: OS_DESCRIPTION_TYPE;
  [OS_NAME]?: OS_NAME_TYPE;
  [OS_TYPE]?: OS_TYPE_TYPE;
  [OS_VERSION]?: OS_VERSION_TYPE;
  [OTEL_SCOPE_NAME]?: OTEL_SCOPE_NAME_TYPE;
  [OTEL_SCOPE_VERSION]?: OTEL_SCOPE_VERSION_TYPE;
  [OTEL_STATUS_CODE]?: OTEL_STATUS_CODE_TYPE;
  [OTEL_STATUS_DESCRIPTION]?: OTEL_STATUS_DESCRIPTION_TYPE;
  [PARAMS_KEY]?: PARAMS_KEY_TYPE;
  [PREVIOUS_ROUTE]?: PREVIOUS_ROUTE_TYPE;
  [PROCESS_EXECUTABLE_NAME]?: PROCESS_EXECUTABLE_NAME_TYPE;
  [PROCESS_PID]?: PROCESS_PID_TYPE;
  [PROCESS_RUNTIME_DESCRIPTION]?: PROCESS_RUNTIME_DESCRIPTION_TYPE;
  [PROCESS_RUNTIME_NAME]?: PROCESS_RUNTIME_NAME_TYPE;
  [PROCESS_RUNTIME_VERSION]?: PROCESS_RUNTIME_VERSION_TYPE;
  [PROFILE_ID]?: PROFILE_ID_TYPE;
  [QUERY_KEY]?: QUERY_KEY_TYPE;
  [RELEASE]?: RELEASE_TYPE;
  [REMIX_ACTION_FORM_DATA_KEY]?: REMIX_ACTION_FORM_DATA_KEY_TYPE;
  [REPLAY_ID]?: REPLAY_ID_TYPE;
  [RESOURCE_RENDER_BLOCKING_STATUS]?: RESOURCE_RENDER_BLOCKING_STATUS_TYPE;
  [ROUTE]?: ROUTE_TYPE;
  [RPC_GRPC_STATUS_CODE]?: RPC_GRPC_STATUS_CODE_TYPE;
  [RPC_SERVICE]?: RPC_SERVICE_TYPE;
  [SENTRY_BROWSER_NAME]?: SENTRY_BROWSER_NAME_TYPE;
  [SENTRY_BROWSER_VERSION]?: SENTRY_BROWSER_VERSION_TYPE;
  [SENTRY_CANCELLATION_REASON]?: SENTRY_CANCELLATION_REASON_TYPE;
  [SENTRY_CLIENT_SAMPLE_RATE]?: SENTRY_CLIENT_SAMPLE_RATE_TYPE;
  [SENTRY_DESCRIPTION]?: SENTRY_DESCRIPTION_TYPE;
  [SENTRY_DIST]?: SENTRY_DIST_TYPE;
  [SENTRY_ENVIRONMENT]?: SENTRY_ENVIRONMENT_TYPE;
  [SENTRY_EXCLUSIVE_TIME]?: SENTRY_EXCLUSIVE_TIME_TYPE;
  [SENTRY_HTTP_PREFETCH]?: SENTRY_HTTP_PREFETCH_TYPE;
  [SENTRY_IDLE_SPAN_FINISH_REASON]?: SENTRY_IDLE_SPAN_FINISH_REASON_TYPE;
  [SENTRY_INTERNAL_DSC_ENVIRONMENT]?: SENTRY_INTERNAL_DSC_ENVIRONMENT_TYPE;
  [SENTRY_INTERNAL_DSC_ORG_ID]?: SENTRY_INTERNAL_DSC_ORG_ID_TYPE;
  [SENTRY_INTERNAL_DSC_PUBLIC_KEY]?: SENTRY_INTERNAL_DSC_PUBLIC_KEY_TYPE;
  [SENTRY_INTERNAL_DSC_RELEASE]?: SENTRY_INTERNAL_DSC_RELEASE_TYPE;
  [SENTRY_INTERNAL_DSC_SAMPLED]?: SENTRY_INTERNAL_DSC_SAMPLED_TYPE;
  [SENTRY_INTERNAL_DSC_SAMPLE_RAND]?: SENTRY_INTERNAL_DSC_SAMPLE_RAND_TYPE;
  [SENTRY_INTERNAL_DSC_SAMPLE_RATE]?: SENTRY_INTERNAL_DSC_SAMPLE_RATE_TYPE;
  [SENTRY_INTERNAL_DSC_TRACE_ID]?: SENTRY_INTERNAL_DSC_TRACE_ID_TYPE;
  [SENTRY_INTERNAL_DSC_TRANSACTION]?: SENTRY_INTERNAL_DSC_TRANSACTION_TYPE;
  [SENTRY_INTERNAL_OBSERVED_TIMESTAMP_NANOS]?: SENTRY_INTERNAL_OBSERVED_TIMESTAMP_NANOS_TYPE;
  [SENTRY_INTERNAL_REPLAY_IS_BUFFERING]?: SENTRY_INTERNAL_REPLAY_IS_BUFFERING_TYPE;
  [SENTRY_MESSAGE_PARAMETER_KEY]?: SENTRY_MESSAGE_PARAMETER_KEY_TYPE;
  [SENTRY_MESSAGE_TEMPLATE]?: SENTRY_MESSAGE_TEMPLATE_TYPE;
  [SENTRY_MODULE_KEY]?: SENTRY_MODULE_KEY_TYPE;
  [SENTRY_NEXTJS_SSR_FUNCTION_ROUTE]?: SENTRY_NEXTJS_SSR_FUNCTION_ROUTE_TYPE;
  [SENTRY_NEXTJS_SSR_FUNCTION_TYPE]?: SENTRY_NEXTJS_SSR_FUNCTION_TYPE_TYPE;
  [SENTRY_OBSERVED_TIMESTAMP_NANOS]?: SENTRY_OBSERVED_TIMESTAMP_NANOS_TYPE;
  [SENTRY_OP]?: SENTRY_OP_TYPE;
  [SENTRY_ORIGIN]?: SENTRY_ORIGIN_TYPE;
  [SENTRY_PLATFORM]?: SENTRY_PLATFORM_TYPE;
  [SENTRY_PROFILE_ID]?: SENTRY_PROFILE_ID_TYPE;
  [SENTRY_RELEASE]?: SENTRY_RELEASE_TYPE;
  [SENTRY_REPLAY_ID]?: SENTRY_REPLAY_ID_TYPE;
  [SENTRY_SDK_INTEGRATIONS]?: SENTRY_SDK_INTEGRATIONS_TYPE;
  [SENTRY_SDK_NAME]?: SENTRY_SDK_NAME_TYPE;
  [SENTRY_SDK_VERSION]?: SENTRY_SDK_VERSION_TYPE;
  [SENTRY_SEGMENT_ID]?: SENTRY_SEGMENT_ID_TYPE;
  [SENTRY_SEGMENT_NAME]?: SENTRY_SEGMENT_NAME_TYPE;
  [SENTRY_SERVER_SAMPLE_RATE]?: SENTRY_SERVER_SAMPLE_RATE_TYPE;
  [SENTRY_SPAN_SOURCE]?: SENTRY_SPAN_SOURCE_TYPE;
  [SENTRY_TRACE_PARENT_SPAN_ID]?: SENTRY_TRACE_PARENT_SPAN_ID_TYPE;
  [SENTRY_TRANSACTION]?: SENTRY_TRANSACTION_TYPE;
  [SERVER_ADDRESS]?: SERVER_ADDRESS_TYPE;
  [SERVER_PORT]?: SERVER_PORT_TYPE;
  [SERVICE_NAME]?: SERVICE_NAME_TYPE;
  [SERVICE_VERSION]?: SERVICE_VERSION_TYPE;
  [THREAD_ID]?: THREAD_ID_TYPE;
  [THREAD_NAME]?: THREAD_NAME_TYPE;
  [TRANSACTION]?: TRANSACTION_TYPE;
  [TYPE]?: TYPE_TYPE;
  [UI_COMPONENT_NAME]?: UI_COMPONENT_NAME_TYPE;
  [UI_CONTRIBUTES_TO_TTFD]?: UI_CONTRIBUTES_TO_TTFD_TYPE;
  [UI_CONTRIBUTES_TO_TTID]?: UI_CONTRIBUTES_TO_TTID_TYPE;
  [URL]?: URL_TYPE;
  [URL_DOMAIN]?: URL_DOMAIN_TYPE;
  [URL_FRAGMENT]?: URL_FRAGMENT_TYPE;
  [URL_FULL]?: URL_FULL_TYPE;
  [URL_PATH]?: URL_PATH_TYPE;
  [URL_PATH_PARAMETER_KEY]?: URL_PATH_PARAMETER_KEY_TYPE;
  [URL_PORT]?: URL_PORT_TYPE;
  [URL_QUERY]?: URL_QUERY_TYPE;
  [URL_SCHEME]?: URL_SCHEME_TYPE;
  [URL_TEMPLATE]?: URL_TEMPLATE_TYPE;
  [USER_AGENT_ORIGINAL]?: USER_AGENT_ORIGINAL_TYPE;
  [USER_EMAIL]?: USER_EMAIL_TYPE;
  [USER_FULL_NAME]?: USER_FULL_NAME_TYPE;
  [USER_GEO_CITY]?: USER_GEO_CITY_TYPE;
  [USER_GEO_COUNTRY_CODE]?: USER_GEO_COUNTRY_CODE_TYPE;
  [USER_GEO_REGION]?: USER_GEO_REGION_TYPE;
  [USER_GEO_SUBDIVISION]?: USER_GEO_SUBDIVISION_TYPE;
  [USER_HASH]?: USER_HASH_TYPE;
  [USER_ID]?: USER_ID_TYPE;
  [USER_IP_ADDRESS]?: USER_IP_ADDRESS_TYPE;
  [USER_NAME]?: USER_NAME_TYPE;
  [USER_ROLES]?: USER_ROLES_TYPE;
  [_SENTRY_SEGMENT_ID]?: _SENTRY_SEGMENT_ID_TYPE;
} & Record<string, AttributeValue | undefined>;
