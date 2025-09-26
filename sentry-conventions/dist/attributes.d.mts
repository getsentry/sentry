/**
 * References or sources cited by the AI model in its response. `ai.citations`
 *
 * Attribute Value Type: `Array<string>` {@link AI_CITATIONS_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: No
 *
 * @example ["Citation 1","Citation 2"]
 */
declare const AI_CITATIONS = "ai.citations";
/**
 * Type for {@link AI_CITATIONS} ai.citations
 */
type AI_CITATIONS_TYPE = Array<string>;
/**
 * The number of tokens used to respond to the message. `ai.completion_tokens.used`
 *
 * Attribute Value Type: `number` {@link AI_COMPLETION_TOKENS_USED_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link GEN_AI_USAGE_OUTPUT_TOKENS} `gen_ai.usage.output_tokens`, {@link GEN_AI_USAGE_COMPLETION_TOKENS} `gen_ai.usage.completion_tokens`
 *
 * @deprecated Use {@link GEN_AI_USAGE_OUTPUT_TOKENS} (gen_ai.usage.output_tokens) instead
 * @example 10
 */
declare const AI_COMPLETION_TOKENS_USED = "ai.completion_tokens.used";
/**
 * Type for {@link AI_COMPLETION_TOKENS_USED} ai.completion_tokens.used
 */
type AI_COMPLETION_TOKENS_USED_TYPE = number;
/**
 * Documents or content chunks used as context for the AI model. `ai.documents`
 *
 * Attribute Value Type: `Array<string>` {@link AI_DOCUMENTS_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: No
 *
 * @example ["document1.txt","document2.pdf"]
 */
declare const AI_DOCUMENTS = "ai.documents";
/**
 * Type for {@link AI_DOCUMENTS} ai.documents
 */
type AI_DOCUMENTS_TYPE = Array<string>;
/**
 * The reason why the model stopped generating. `ai.finish_reason`
 *
 * Attribute Value Type: `string` {@link AI_FINISH_REASON_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link GEN_AI_RESPONSE_FINISH_REASONS} `gen_ai.response.finish_reasons`
 *
 * @deprecated Use {@link GEN_AI_RESPONSE_FINISH_REASON} (gen_ai.response.finish_reason) instead
 * @example "COMPLETE"
 */
declare const AI_FINISH_REASON = "ai.finish_reason";
/**
 * Type for {@link AI_FINISH_REASON} ai.finish_reason
 */
type AI_FINISH_REASON_TYPE = string;
/**
 * Used to reduce repetitiveness of generated tokens. The higher the value, the stronger a penalty is applied to previously present tokens, proportional to how many times they have already appeared in the prompt or prior generation. `ai.frequency_penalty`
 *
 * Attribute Value Type: `number` {@link AI_FREQUENCY_PENALTY_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link GEN_AI_REQUEST_FREQUENCY_PENALTY} `gen_ai.request.frequency_penalty`
 *
 * @deprecated Use {@link GEN_AI_REQUEST_FREQUENCY_PENALTY} (gen_ai.request.frequency_penalty) instead
 * @example 0.5
 */
declare const AI_FREQUENCY_PENALTY = "ai.frequency_penalty";
/**
 * Type for {@link AI_FREQUENCY_PENALTY} ai.frequency_penalty
 */
type AI_FREQUENCY_PENALTY_TYPE = number;
/**
 * For an AI model call, the function that was called. This is deprecated for OpenAI, and replaced by tool_calls `ai.function_call`
 *
 * Attribute Value Type: `string` {@link AI_FUNCTION_CALL_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link GEN_AI_TOOL_NAME} `gen_ai.tool.name`
 *
 * @deprecated Use {@link GEN_AI_TOOL_NAME} (gen_ai.tool.name) instead
 * @example "function_name"
 */
declare const AI_FUNCTION_CALL = "ai.function_call";
/**
 * Type for {@link AI_FUNCTION_CALL} ai.function_call
 */
type AI_FUNCTION_CALL_TYPE = string;
/**
 * Unique identifier for the completion. `ai.generation_id`
 *
 * Attribute Value Type: `string` {@link AI_GENERATION_ID_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link GEN_AI_RESPONSE_ID} `gen_ai.response.id`
 *
 * @deprecated Use {@link GEN_AI_RESPONSE_ID} (gen_ai.response.id) instead
 * @example "gen_123abc"
 */
declare const AI_GENERATION_ID = "ai.generation_id";
/**
 * Type for {@link AI_GENERATION_ID} ai.generation_id
 */
type AI_GENERATION_ID_TYPE = string;
/**
 * The input messages sent to the model `ai.input_messages`
 *
 * Attribute Value Type: `string` {@link AI_INPUT_MESSAGES_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link GEN_AI_REQUEST_MESSAGES} `gen_ai.request.messages`
 *
 * @deprecated Use {@link GEN_AI_REQUEST_MESSAGES} (gen_ai.request.messages) instead
 * @example "[{\"role\": \"user\", \"message\": \"hello\"}]"
 */
declare const AI_INPUT_MESSAGES = "ai.input_messages";
/**
 * Type for {@link AI_INPUT_MESSAGES} ai.input_messages
 */
type AI_INPUT_MESSAGES_TYPE = string;
/**
 * Boolean indicating if the model needs to perform a search. `ai.is_search_required`
 *
 * Attribute Value Type: `boolean` {@link AI_IS_SEARCH_REQUIRED_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example false
 */
declare const AI_IS_SEARCH_REQUIRED = "ai.is_search_required";
/**
 * Type for {@link AI_IS_SEARCH_REQUIRED} ai.is_search_required
 */
type AI_IS_SEARCH_REQUIRED_TYPE = boolean;
/**
 * Extra metadata passed to an AI pipeline step. `ai.metadata`
 *
 * Attribute Value Type: `string` {@link AI_METADATA_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "{\"user_id\": 123, \"session_id\": \"abc123\"}"
 */
declare const AI_METADATA = "ai.metadata";
/**
 * Type for {@link AI_METADATA} ai.metadata
 */
type AI_METADATA_TYPE = string;
/**
 * The provider of the model. `ai.model.provider`
 *
 * Attribute Value Type: `string` {@link AI_MODEL_PROVIDER_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link GEN_AI_SYSTEM} `gen_ai.system`
 *
 * @deprecated Use {@link GEN_AI_SYSTEM} (gen_ai.system) instead
 * @example "openai"
 */
declare const AI_MODEL_PROVIDER = "ai.model.provider";
/**
 * Type for {@link AI_MODEL_PROVIDER} ai.model.provider
 */
type AI_MODEL_PROVIDER_TYPE = string;
/**
 * The vendor-specific ID of the model used. `ai.model_id`
 *
 * Attribute Value Type: `string` {@link AI_MODEL_ID_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link GEN_AI_RESPONSE_MODEL} `gen_ai.response.model`
 *
 * @deprecated Use {@link GEN_AI_RESPONSE_MODEL} (gen_ai.response.model) instead
 * @example "gpt-4"
 */
declare const AI_MODEL_ID = "ai.model_id";
/**
 * Type for {@link AI_MODEL_ID} ai.model_id
 */
type AI_MODEL_ID_TYPE = string;
/**
 * The name of the AI pipeline. `ai.pipeline.name`
 *
 * Attribute Value Type: `string` {@link AI_PIPELINE_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link GEN_AI_PIPELINE_NAME} `gen_ai.pipeline.name`
 *
 * @deprecated Use {@link GEN_AI_PIPELINE_NAME} (gen_ai.pipeline.name) instead
 * @example "Autofix Pipeline"
 */
declare const AI_PIPELINE_NAME = "ai.pipeline.name";
/**
 * Type for {@link AI_PIPELINE_NAME} ai.pipeline.name
 */
type AI_PIPELINE_NAME_TYPE = string;
/**
 * For an AI model call, the preamble parameter. Preambles are a part of the prompt used to adjust the model's overall behavior and conversation style. `ai.preamble`
 *
 * Attribute Value Type: `string` {@link AI_PREAMBLE_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: No
 *
 * @example "You are now a clown."
 */
declare const AI_PREAMBLE = "ai.preamble";
/**
 * Type for {@link AI_PREAMBLE} ai.preamble
 */
type AI_PREAMBLE_TYPE = string;
/**
 * Used to reduce repetitiveness of generated tokens. Similar to frequency_penalty, except that this penalty is applied equally to all tokens that have already appeared, regardless of their exact frequencies. `ai.presence_penalty`
 *
 * Attribute Value Type: `number` {@link AI_PRESENCE_PENALTY_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link GEN_AI_REQUEST_PRESENCE_PENALTY} `gen_ai.request.presence_penalty`
 *
 * @deprecated Use {@link GEN_AI_REQUEST_PRESENCE_PENALTY} (gen_ai.request.presence_penalty) instead
 * @example 0.5
 */
declare const AI_PRESENCE_PENALTY = "ai.presence_penalty";
/**
 * Type for {@link AI_PRESENCE_PENALTY} ai.presence_penalty
 */
type AI_PRESENCE_PENALTY_TYPE = number;
/**
 * The number of tokens used to process just the prompt. `ai.prompt_tokens.used`
 *
 * Attribute Value Type: `number` {@link AI_PROMPT_TOKENS_USED_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link GEN_AI_USAGE_PROMPT_TOKENS} `gen_ai.usage.prompt_tokens`, {@link GEN_AI_USAGE_INPUT_TOKENS} `gen_ai.usage.input_tokens`
 *
 * @deprecated Use {@link GEN_AI_USAGE_INPUT_TOKENS} (gen_ai.usage.input_tokens) instead
 * @example 20
 */
declare const AI_PROMPT_TOKENS_USED = "ai.prompt_tokens.used";
/**
 * Type for {@link AI_PROMPT_TOKENS_USED} ai.prompt_tokens.used
 */
type AI_PROMPT_TOKENS_USED_TYPE = number;
/**
 * When enabled, the user’s prompt will be sent to the model without any pre-processing. `ai.raw_prompting`
 *
 * Attribute Value Type: `boolean` {@link AI_RAW_PROMPTING_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example true
 */
declare const AI_RAW_PROMPTING = "ai.raw_prompting";
/**
 * Type for {@link AI_RAW_PROMPTING} ai.raw_prompting
 */
type AI_RAW_PROMPTING_TYPE = boolean;
/**
 * For an AI model call, the format of the response `ai.response_format`
 *
 * Attribute Value Type: `string` {@link AI_RESPONSE_FORMAT_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "json_object"
 */
declare const AI_RESPONSE_FORMAT = "ai.response_format";
/**
 * Type for {@link AI_RESPONSE_FORMAT} ai.response_format
 */
type AI_RESPONSE_FORMAT_TYPE = string;
/**
 * The response messages sent back by the AI model. `ai.responses`
 *
 * Attribute Value Type: `Array<string>` {@link AI_RESPONSES_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @deprecated Use {@link GEN_AI_RESPONSE_TEXT} (gen_ai.response.text) instead
 * @example ["hello","world"]
 */
declare const AI_RESPONSES = "ai.responses";
/**
 * Type for {@link AI_RESPONSES} ai.responses
 */
type AI_RESPONSES_TYPE = Array<string>;
/**
 * Queries used to search for relevant context or documents. `ai.search_queries`
 *
 * Attribute Value Type: `Array<string>` {@link AI_SEARCH_QUERIES_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: No
 *
 * @example ["climate change effects","renewable energy"]
 */
declare const AI_SEARCH_QUERIES = "ai.search_queries";
/**
 * Type for {@link AI_SEARCH_QUERIES} ai.search_queries
 */
type AI_SEARCH_QUERIES_TYPE = Array<string>;
/**
 * Results returned from search queries for context. `ai.search_results`
 *
 * Attribute Value Type: `Array<string>` {@link AI_SEARCH_RESULTS_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: No
 *
 * @example ["search_result_1, search_result_2"]
 */
declare const AI_SEARCH_RESULTS = "ai.search_results";
/**
 * Type for {@link AI_SEARCH_RESULTS} ai.search_results
 */
type AI_SEARCH_RESULTS_TYPE = Array<string>;
/**
 * The seed, ideally models given the same seed and same other parameters will produce the exact same output. `ai.seed`
 *
 * Attribute Value Type: `string` {@link AI_SEED_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link GEN_AI_REQUEST_SEED} `gen_ai.request.seed`
 *
 * @deprecated Use {@link GEN_AI_REQUEST_SEED} (gen_ai.request.seed) instead
 * @example "1234567890"
 */
declare const AI_SEED = "ai.seed";
/**
 * Type for {@link AI_SEED} ai.seed
 */
type AI_SEED_TYPE = string;
/**
 * Whether the request was streamed back. `ai.streaming`
 *
 * Attribute Value Type: `boolean` {@link AI_STREAMING_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link GEN_AI_RESPONSE_STREAMING} `gen_ai.response.streaming`
 *
 * @deprecated Use {@link GEN_AI_RESPONSE_STREAMING} (gen_ai.response.streaming) instead
 * @example true
 */
declare const AI_STREAMING = "ai.streaming";
/**
 * Type for {@link AI_STREAMING} ai.streaming
 */
type AI_STREAMING_TYPE = boolean;
/**
 * Tags that describe an AI pipeline step. `ai.tags`
 *
 * Attribute Value Type: `string` {@link AI_TAGS_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "{\"executed_function\": \"add_integers\"}"
 */
declare const AI_TAGS = "ai.tags";
/**
 * Type for {@link AI_TAGS} ai.tags
 */
type AI_TAGS_TYPE = string;
/**
 * For an AI model call, the temperature parameter. Temperature essentially means how random the output will be. `ai.temperature`
 *
 * Attribute Value Type: `number` {@link AI_TEMPERATURE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link GEN_AI_REQUEST_TEMPERATURE} `gen_ai.request.temperature`
 *
 * @deprecated Use {@link GEN_AI_REQUEST_TEMPERATURE} (gen_ai.request.temperature) instead
 * @example 0.1
 */
declare const AI_TEMPERATURE = "ai.temperature";
/**
 * Type for {@link AI_TEMPERATURE} ai.temperature
 */
type AI_TEMPERATURE_TYPE = number;
/**
 * Raw text inputs provided to the model. `ai.texts`
 *
 * Attribute Value Type: `Array<string>` {@link AI_TEXTS_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: No
 *
 * @example ["Hello, how are you?","What is the capital of France?"]
 */
declare const AI_TEXTS = "ai.texts";
/**
 * Type for {@link AI_TEXTS} ai.texts
 */
type AI_TEXTS_TYPE = Array<string>;
/**
 * For an AI model call, the tool calls that were made. `ai.tool_calls`
 *
 * Attribute Value Type: `Array<string>` {@link AI_TOOL_CALLS_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: No
 *
 * @deprecated Use {@link GEN_AI_RESPONSE_TOOL_CALLS} (gen_ai.response.tool_calls) instead
 * @example ["tool_call_1","tool_call_2"]
 */
declare const AI_TOOL_CALLS = "ai.tool_calls";
/**
 * Type for {@link AI_TOOL_CALLS} ai.tool_calls
 */
type AI_TOOL_CALLS_TYPE = Array<string>;
/**
 * For an AI model call, the functions that are available `ai.tools`
 *
 * Attribute Value Type: `Array<string>` {@link AI_TOOLS_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @deprecated Use {@link GEN_AI_REQUEST_AVAILABLE_TOOLS} (gen_ai.request.available_tools) instead
 * @example ["function_1","function_2"]
 */
declare const AI_TOOLS = "ai.tools";
/**
 * Type for {@link AI_TOOLS} ai.tools
 */
type AI_TOOLS_TYPE = Array<string>;
/**
 * Limits the model to only consider the K most likely next tokens, where K is an integer (e.g., top_k=20 means only the 20 highest probability tokens are considered). `ai.top_k`
 *
 * Attribute Value Type: `number` {@link AI_TOP_K_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link GEN_AI_REQUEST_TOP_K} `gen_ai.request.top_k`
 *
 * @deprecated Use {@link GEN_AI_REQUEST_TOP_K} (gen_ai.request.top_k) instead
 * @example 35
 */
declare const AI_TOP_K = "ai.top_k";
/**
 * Type for {@link AI_TOP_K} ai.top_k
 */
type AI_TOP_K_TYPE = number;
/**
 * Limits the model to only consider tokens whose cumulative probability mass adds up to p, where p is a float between 0 and 1 (e.g., top_p=0.7 means only tokens that sum up to 70% of the probability mass are considered). `ai.top_p`
 *
 * Attribute Value Type: `number` {@link AI_TOP_P_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link GEN_AI_REQUEST_TOP_P} `gen_ai.request.top_p`
 *
 * @deprecated Use {@link GEN_AI_REQUEST_TOP_P} (gen_ai.request.top_p) instead
 * @example 0.7
 */
declare const AI_TOP_P = "ai.top_p";
/**
 * Type for {@link AI_TOP_P} ai.top_p
 */
type AI_TOP_P_TYPE = number;
/**
 * The total cost for the tokens used. `ai.total_cost`
 *
 * Attribute Value Type: `number` {@link AI_TOTAL_COST_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 12.34
 */
declare const AI_TOTAL_COST = "ai.total_cost";
/**
 * Type for {@link AI_TOTAL_COST} ai.total_cost
 */
type AI_TOTAL_COST_TYPE = number;
/**
 * The total number of tokens used to process the prompt. `ai.total_tokens.used`
 *
 * Attribute Value Type: `number` {@link AI_TOTAL_TOKENS_USED_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link GEN_AI_USAGE_TOTAL_TOKENS} `gen_ai.usage.total_tokens`
 *
 * @deprecated Use {@link GEN_AI_USAGE_TOTAL_TOKENS} (gen_ai.usage.total_tokens) instead
 * @example 30
 */
declare const AI_TOTAL_TOKENS_USED = "ai.total_tokens.used";
/**
 * Type for {@link AI_TOTAL_TOKENS_USED} ai.total_tokens.used
 */
type AI_TOTAL_TOKENS_USED_TYPE = number;
/**
 * Warning messages generated during model execution. `ai.warnings`
 *
 * Attribute Value Type: `Array<string>` {@link AI_WARNINGS_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: No
 *
 * @example ["Token limit exceeded"]
 */
declare const AI_WARNINGS = "ai.warnings";
/**
 * Type for {@link AI_WARNINGS} ai.warnings
 */
type AI_WARNINGS_TYPE = Array<string>;
/**
 * Mobile app start variant. Either cold or warm. `app_start_type`
 *
 * Attribute Value Type: `string` {@link APP_START_TYPE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "cold"
 */
declare const APP_START_TYPE = "app_start_type";
/**
 * Type for {@link APP_START_TYPE} app_start_type
 */
type APP_START_TYPE_TYPE = string;
/**
 * Whether the main thread was blocked by the span. `blocked_main_thread`
 *
 * Attribute Value Type: `boolean` {@link BLOCKED_MAIN_THREAD_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example true
 */
declare const BLOCKED_MAIN_THREAD = "blocked_main_thread";
/**
 * Type for {@link BLOCKED_MAIN_THREAD} blocked_main_thread
 */
type BLOCKED_MAIN_THREAD_TYPE = boolean;
/**
 * The name of the browser. `browser.name`
 *
 * Attribute Value Type: `string` {@link BROWSER_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link SENTRY_BROWSER_NAME} `sentry.browser.name`
 *
 * @example "Chrome"
 */
declare const BROWSER_NAME = "browser.name";
/**
 * Type for {@link BROWSER_NAME} browser.name
 */
type BROWSER_NAME_TYPE = string;
/**
 * A browser report sent via reporting API.. `browser.report.type`
 *
 * Attribute Value Type: `string` {@link BROWSER_REPORT_TYPE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "network-error"
 */
declare const BROWSER_REPORT_TYPE = "browser.report.type";
/**
 * Type for {@link BROWSER_REPORT_TYPE} browser.report.type
 */
type BROWSER_REPORT_TYPE_TYPE = string;
/**
 * How a script was called in the browser. `browser.script.invoker`
 *
 * Attribute Value Type: `string` {@link BROWSER_SCRIPT_INVOKER_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "Window.requestAnimationFrame"
 */
declare const BROWSER_SCRIPT_INVOKER = "browser.script.invoker";
/**
 * Type for {@link BROWSER_SCRIPT_INVOKER} browser.script.invoker
 */
type BROWSER_SCRIPT_INVOKER_TYPE = string;
/**
 * Browser script entry point type. `browser.script.invoker_type`
 *
 * Attribute Value Type: `string` {@link BROWSER_SCRIPT_INVOKER_TYPE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "event-listener"
 */
declare const BROWSER_SCRIPT_INVOKER_TYPE = "browser.script.invoker_type";
/**
 * Type for {@link BROWSER_SCRIPT_INVOKER_TYPE} browser.script.invoker_type
 */
type BROWSER_SCRIPT_INVOKER_TYPE_TYPE = string;
/**
 * A number representing the script character position of the script. `browser.script.source_char_position`
 *
 * Attribute Value Type: `number` {@link BROWSER_SCRIPT_SOURCE_CHAR_POSITION_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 678
 */
declare const BROWSER_SCRIPT_SOURCE_CHAR_POSITION = "browser.script.source_char_position";
/**
 * Type for {@link BROWSER_SCRIPT_SOURCE_CHAR_POSITION} browser.script.source_char_position
 */
type BROWSER_SCRIPT_SOURCE_CHAR_POSITION_TYPE = number;
/**
 * The version of the browser. `browser.version`
 *
 * Attribute Value Type: `string` {@link BROWSER_VERSION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link SENTRY_BROWSER_VERSION} `sentry.browser.version`
 *
 * @example "120.0.6099.130"
 */
declare const BROWSER_VERSION = "browser.version";
/**
 * Type for {@link BROWSER_VERSION} browser.version
 */
type BROWSER_VERSION_TYPE = string;
/**
 * If the cache was hit during this span. `cache.hit`
 *
 * Attribute Value Type: `boolean` {@link CACHE_HIT_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example true
 */
declare const CACHE_HIT = "cache.hit";
/**
 * Type for {@link CACHE_HIT} cache.hit
 */
type CACHE_HIT_TYPE = boolean;
/**
 * The size of the requested item in the cache. In bytes. `cache.item_size`
 *
 * Attribute Value Type: `number` {@link CACHE_ITEM_SIZE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 58
 */
declare const CACHE_ITEM_SIZE = "cache.item_size";
/**
 * Type for {@link CACHE_ITEM_SIZE} cache.item_size
 */
type CACHE_ITEM_SIZE_TYPE = number;
/**
 * The key of the cache accessed. `cache.key`
 *
 * Attribute Value Type: `Array<string>` {@link CACHE_KEY_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example ["my-cache-key","my-other-cache-key"]
 */
declare const CACHE_KEY = "cache.key";
/**
 * Type for {@link CACHE_KEY} cache.key
 */
type CACHE_KEY_TYPE = Array<string>;
/**
 * The operation being performed on the cache. `cache.operation`
 *
 * Attribute Value Type: `string` {@link CACHE_OPERATION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "get"
 */
declare const CACHE_OPERATION = "cache.operation";
/**
 * Type for {@link CACHE_OPERATION} cache.operation
 */
type CACHE_OPERATION_TYPE = string;
/**
 * The ttl of the cache in seconds `cache.ttl`
 *
 * Attribute Value Type: `number` {@link CACHE_TTL_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 120
 */
declare const CACHE_TTL = "cache.ttl";
/**
 * Type for {@link CACHE_TTL} cache.ttl
 */
type CACHE_TTL_TYPE = number;
/**
 * The channel name that is being used. `channel`
 *
 * Attribute Value Type: `string` {@link CHANNEL_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "mail"
 */
declare const CHANNEL = "channel";
/**
 * Type for {@link CHANNEL} channel
 */
type CHANNEL_TYPE = string;
/**
 * Client address - domain name if available without reverse DNS lookup; otherwise, IP address or Unix domain socket name. `client.address`
 *
 * Attribute Value Type: `string` {@link CLIENT_ADDRESS_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link HTTP_CLIENT_IP} `http.client_ip`
 *
 * @example "example.com"
 */
declare const CLIENT_ADDRESS = "client.address";
/**
 * Type for {@link CLIENT_ADDRESS} client.address
 */
type CLIENT_ADDRESS_TYPE = string;
/**
 * Client port number. `client.port`
 *
 * Attribute Value Type: `number` {@link CLIENT_PORT_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * @example 5432
 */
declare const CLIENT_PORT = "client.port";
/**
 * Type for {@link CLIENT_PORT} client.port
 */
type CLIENT_PORT_TYPE = number;
/**
 * The duration of a Cloudflare D1 operation. `cloudflare.d1.duration`
 *
 * Attribute Value Type: `number` {@link CLOUDFLARE_D1_DURATION_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 543
 */
declare const CLOUDFLARE_D1_DURATION = "cloudflare.d1.duration";
/**
 * Type for {@link CLOUDFLARE_D1_DURATION} cloudflare.d1.duration
 */
type CLOUDFLARE_D1_DURATION_TYPE = number;
/**
 * The number of rows read in a Cloudflare D1 operation. `cloudflare.d1.rows_read`
 *
 * Attribute Value Type: `number` {@link CLOUDFLARE_D1_ROWS_READ_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 12
 */
declare const CLOUDFLARE_D1_ROWS_READ = "cloudflare.d1.rows_read";
/**
 * Type for {@link CLOUDFLARE_D1_ROWS_READ} cloudflare.d1.rows_read
 */
type CLOUDFLARE_D1_ROWS_READ_TYPE = number;
/**
 * The number of rows written in a Cloudflare D1 operation. `cloudflare.d1.rows_written`
 *
 * Attribute Value Type: `number` {@link CLOUDFLARE_D1_ROWS_WRITTEN_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 12
 */
declare const CLOUDFLARE_D1_ROWS_WRITTEN = "cloudflare.d1.rows_written";
/**
 * Type for {@link CLOUDFLARE_D1_ROWS_WRITTEN} cloudflare.d1.rows_written
 */
type CLOUDFLARE_D1_ROWS_WRITTEN_TYPE = number;
/**
 * The source code file name that identifies the code unit as uniquely as possible (preferably an absolute file path). `code.file.path`
 *
 * Attribute Value Type: `string` {@link CODE_FILE_PATH_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link CODE_FILEPATH} `code.filepath`
 *
 * @example "/app/myapplication/http/handler/server.py"
 */
declare const CODE_FILE_PATH = "code.file.path";
/**
 * Type for {@link CODE_FILE_PATH} code.file.path
 */
type CODE_FILE_PATH_TYPE = string;
/**
 * The source code file name that identifies the code unit as uniquely as possible (preferably an absolute file path). `code.filepath`
 *
 * Attribute Value Type: `string` {@link CODE_FILEPATH_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link CODE_FILE_PATH} `code.file.path`
 *
 * @deprecated Use {@link CODE_FILE_PATH} (code.file.path) instead
 * @example "/app/myapplication/http/handler/server.py"
 */
declare const CODE_FILEPATH = "code.filepath";
/**
 * Type for {@link CODE_FILEPATH} code.filepath
 */
type CODE_FILEPATH_TYPE = string;
/**
 * The method or function name, or equivalent (usually rightmost part of the code unit's name). `code.function`
 *
 * Attribute Value Type: `string` {@link CODE_FUNCTION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link CODE_FUNCTION_NAME} `code.function.name`
 *
 * @deprecated Use {@link CODE_FUNCTION_NAME} (code.function.name) instead
 * @example "server_request"
 */
declare const CODE_FUNCTION = "code.function";
/**
 * Type for {@link CODE_FUNCTION} code.function
 */
type CODE_FUNCTION_TYPE = string;
/**
 * The method or function name, or equivalent (usually rightmost part of the code unit's name). `code.function.name`
 *
 * Attribute Value Type: `string` {@link CODE_FUNCTION_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link CODE_FUNCTION} `code.function`
 *
 * @example "server_request"
 */
declare const CODE_FUNCTION_NAME = "code.function.name";
/**
 * Type for {@link CODE_FUNCTION_NAME} code.function.name
 */
type CODE_FUNCTION_NAME_TYPE = string;
/**
 * The line number in code.filepath best representing the operation. It SHOULD point within the code unit named in code.function `code.line.number`
 *
 * Attribute Value Type: `number` {@link CODE_LINE_NUMBER_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link CODE_LINENO} `code.lineno`
 *
 * @example 42
 */
declare const CODE_LINE_NUMBER = "code.line.number";
/**
 * Type for {@link CODE_LINE_NUMBER} code.line.number
 */
type CODE_LINE_NUMBER_TYPE = number;
/**
 * The line number in code.filepath best representing the operation. It SHOULD point within the code unit named in code.function `code.lineno`
 *
 * Attribute Value Type: `number` {@link CODE_LINENO_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link CODE_LINE_NUMBER} `code.line.number`
 *
 * @deprecated Use {@link CODE_LINE_NUMBER} (code.line.number) instead
 * @example 42
 */
declare const CODE_LINENO = "code.lineno";
/**
 * Type for {@link CODE_LINENO} code.lineno
 */
type CODE_LINENO_TYPE = number;
/**
 * The 'namespace' within which code.function is defined. Usually the qualified class or module name, such that code.namespace + some separator + code.function form a unique identifier for the code unit. `code.namespace`
 *
 * Attribute Value Type: `string` {@link CODE_NAMESPACE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @deprecated Use {@link CODE_FUNCTION_NAME} (code.function.name) instead - code.function.name should include the namespace.
 * @example "http.handler"
 */
declare const CODE_NAMESPACE = "code.namespace";
/**
 * Type for {@link CODE_NAMESPACE} code.namespace
 */
type CODE_NAMESPACE_TYPE = string;
/**
 * The name of a collection (table, container) within the database. `db.collection.name`
 *
 * Attribute Value Type: `string` {@link DB_COLLECTION_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "users"
 */
declare const DB_COLLECTION_NAME = "db.collection.name";
/**
 * Type for {@link DB_COLLECTION_NAME} db.collection.name
 */
type DB_COLLECTION_NAME_TYPE = string;
/**
 * The name of the database being accessed. `db.name`
 *
 * Attribute Value Type: `string` {@link DB_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link DB_NAMESPACE} `db.namespace`
 *
 * @deprecated Use {@link DB_NAMESPACE} (db.namespace) instead
 * @example "customers"
 */
declare const DB_NAME = "db.name";
/**
 * Type for {@link DB_NAME} db.name
 */
type DB_NAME_TYPE = string;
/**
 * The name of the database being accessed. `db.namespace`
 *
 * Attribute Value Type: `string` {@link DB_NAMESPACE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link DB_NAME} `db.name`
 *
 * @example "customers"
 */
declare const DB_NAMESPACE = "db.namespace";
/**
 * Type for {@link DB_NAMESPACE} db.namespace
 */
type DB_NAMESPACE_TYPE = string;
/**
 * The name of the operation being executed. `db.operation`
 *
 * Attribute Value Type: `string` {@link DB_OPERATION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link DB_OPERATION_NAME} `db.operation.name`
 *
 * @deprecated Use {@link DB_OPERATION_NAME} (db.operation.name) instead
 * @example "SELECT"
 */
declare const DB_OPERATION = "db.operation";
/**
 * Type for {@link DB_OPERATION} db.operation
 */
type DB_OPERATION_TYPE = string;
/**
 * The name of the operation being executed. `db.operation.name`
 *
 * Attribute Value Type: `string` {@link DB_OPERATION_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link DB_OPERATION} `db.operation`
 *
 * @example "SELECT"
 */
declare const DB_OPERATION_NAME = "db.operation.name";
/**
 * Type for {@link DB_OPERATION_NAME} db.operation.name
 */
type DB_OPERATION_NAME_TYPE = string;
/**
 * A query parameter used in db.query.text, with <key> being the parameter name, and the attribute value being a string representation of the parameter value. `db.query.parameter.<key>`
 *
 * Attribute Value Type: `string` {@link DB_QUERY_PARAMETER_KEY_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Has Dynamic Suffix: true
 *
 * @example "db.query.parameter.foo='123'"
 */
declare const DB_QUERY_PARAMETER_KEY = "db.query.parameter.<key>";
/**
 * Type for {@link DB_QUERY_PARAMETER_KEY} db.query.parameter.<key>
 */
type DB_QUERY_PARAMETER_KEY_TYPE = string;
/**
 * A database query being executed. Should be paramaterized. The full version of the query is in `db.query.text`. `db.query.summary`
 *
 * Attribute Value Type: `string` {@link DB_QUERY_SUMMARY_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "SELECT * FROM users"
 */
declare const DB_QUERY_SUMMARY = "db.query.summary";
/**
 * Type for {@link DB_QUERY_SUMMARY} db.query.summary
 */
type DB_QUERY_SUMMARY_TYPE = string;
/**
 * The database query being executed. Should be the full query, not a parameterized version. The parameterized version is in `db.query.summary`. `db.query.text`
 *
 * Attribute Value Type: `string` {@link DB_QUERY_TEXT_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link DB_STATEMENT} `db.statement`
 *
 * @example "SELECT * FROM users"
 */
declare const DB_QUERY_TEXT = "db.query.text";
/**
 * Type for {@link DB_QUERY_TEXT} db.query.text
 */
type DB_QUERY_TEXT_TYPE = string;
/**
 * The redis connection name. `db.redis.connection`
 *
 * Attribute Value Type: `string` {@link DB_REDIS_CONNECTION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "my-redis-instance"
 */
declare const DB_REDIS_CONNECTION = "db.redis.connection";
/**
 * Type for {@link DB_REDIS_CONNECTION} db.redis.connection
 */
type DB_REDIS_CONNECTION_TYPE = string;
/**
 * The array of command parameters given to a redis command. `db.redis.parameters`
 *
 * Attribute Value Type: `Array<string>` {@link DB_REDIS_PARAMETERS_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example ["test","*"]
 */
declare const DB_REDIS_PARAMETERS = "db.redis.parameters";
/**
 * Type for {@link DB_REDIS_PARAMETERS} db.redis.parameters
 */
type DB_REDIS_PARAMETERS_TYPE = Array<string>;
/**
 * The array of query bindings. `db.sql.bindings`
 *
 * Attribute Value Type: `Array<string>` {@link DB_SQL_BINDINGS_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @deprecated Use {@link DB_QUERY_PARAMETER_KEY} (db.query.parameter.<key>) instead - Instead of adding every binding in the db.sql.bindings attribute, add them as individual entires with db.query.parameter.<key>.
 * @example ["1","foo"]
 */
declare const DB_SQL_BINDINGS = "db.sql.bindings";
/**
 * Type for {@link DB_SQL_BINDINGS} db.sql.bindings
 */
type DB_SQL_BINDINGS_TYPE = Array<string>;
/**
 * The database statement being executed. `db.statement`
 *
 * Attribute Value Type: `string` {@link DB_STATEMENT_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link DB_QUERY_TEXT} `db.query.text`
 *
 * @deprecated Use {@link DB_QUERY_TEXT} (db.query.text) instead
 * @example "SELECT * FROM users"
 */
declare const DB_STATEMENT = "db.statement";
/**
 * Type for {@link DB_STATEMENT} db.statement
 */
type DB_STATEMENT_TYPE = string;
/**
 * An identifier for the database management system (DBMS) product being used. See [OpenTelemetry docs](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/database/database-spans.md#notes-and-well-known-identifiers-for-dbsystem) for a list of well-known identifiers. `db.system`
 *
 * Attribute Value Type: `string` {@link DB_SYSTEM_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link DB_SYSTEM_NAME} `db.system.name`
 *
 * @deprecated Use {@link DB_SYSTEM_NAME} (db.system.name) instead
 * @example "postgresql"
 */
declare const DB_SYSTEM = "db.system";
/**
 * Type for {@link DB_SYSTEM} db.system
 */
type DB_SYSTEM_TYPE = string;
/**
 * An identifier for the database management system (DBMS) product being used. See [OpenTelemetry docs](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/database/database-spans.md#notes-and-well-known-identifiers-for-dbsystem) for a list of well-known identifiers. `db.system.name`
 *
 * Attribute Value Type: `string` {@link DB_SYSTEM_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link DB_SYSTEM} `db.system`
 *
 * @example "postgresql"
 */
declare const DB_SYSTEM_NAME = "db.system.name";
/**
 * Type for {@link DB_SYSTEM_NAME} db.system.name
 */
type DB_SYSTEM_NAME_TYPE = string;
/**
 * The database user. `db.user`
 *
 * Attribute Value Type: `string` {@link DB_USER_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "fancy_user"
 */
declare const DB_USER = "db.user";
/**
 * Type for {@link DB_USER} db.user
 */
type DB_USER_TYPE = string;
/**
 * The brand of the device. `device.brand`
 *
 * Attribute Value Type: `string` {@link DEVICE_BRAND_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "Apple"
 */
declare const DEVICE_BRAND = "device.brand";
/**
 * Type for {@link DEVICE_BRAND} device.brand
 */
type DEVICE_BRAND_TYPE = string;
/**
 * The family of the device. `device.family`
 *
 * Attribute Value Type: `string` {@link DEVICE_FAMILY_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "iPhone"
 */
declare const DEVICE_FAMILY = "device.family";
/**
 * Type for {@link DEVICE_FAMILY} device.family
 */
type DEVICE_FAMILY_TYPE = string;
/**
 * The model of the device. `device.model`
 *
 * Attribute Value Type: `string` {@link DEVICE_MODEL_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "iPhone 15 Pro Max"
 */
declare const DEVICE_MODEL = "device.model";
/**
 * Type for {@link DEVICE_MODEL} device.model
 */
type DEVICE_MODEL_TYPE = string;
/**
 * The sentry environment. `environment`
 *
 * Attribute Value Type: `string` {@link ENVIRONMENT_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link SENTRY_ENVIRONMENT} `sentry.environment`
 *
 * @deprecated Use {@link SENTRY_ENVIRONMENT} (sentry.environment) instead
 * @example "production"
 */
declare const ENVIRONMENT = "environment";
/**
 * Type for {@link ENVIRONMENT} environment
 */
type ENVIRONMENT_TYPE = string;
/**
 * Describes a class of error the operation ended with. `error.type`
 *
 * Attribute Value Type: `string` {@link ERROR_TYPE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "timeout"
 */
declare const ERROR_TYPE = "error.type";
/**
 * Type for {@link ERROR_TYPE} error.type
 */
type ERROR_TYPE_TYPE = string;
/**
 * The unique identifier for this event (log record) `event.id`
 *
 * Attribute Value Type: `number` {@link EVENT_ID_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 1234567890
 */
declare const EVENT_ID = "event.id";
/**
 * Type for {@link EVENT_ID} event.id
 */
type EVENT_ID_TYPE = number;
/**
 * The name that uniquely identifies this event (log record) `event.name`
 *
 * Attribute Value Type: `string` {@link EVENT_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "Process Payload"
 */
declare const EVENT_NAME = "event.name";
/**
 * Type for {@link EVENT_NAME} event.name
 */
type EVENT_NAME_TYPE = string;
/**
 * SHOULD be set to true if the exception event is recorded at a point where it is known that the exception is escaping the scope of the span. `exception.escaped`
 *
 * Attribute Value Type: `boolean` {@link EXCEPTION_ESCAPED_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * @example true
 */
declare const EXCEPTION_ESCAPED = "exception.escaped";
/**
 * Type for {@link EXCEPTION_ESCAPED} exception.escaped
 */
type EXCEPTION_ESCAPED_TYPE = boolean;
/**
 * The error message. `exception.message`
 *
 * Attribute Value Type: `string` {@link EXCEPTION_MESSAGE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "ENOENT: no such file or directory"
 */
declare const EXCEPTION_MESSAGE = "exception.message";
/**
 * Type for {@link EXCEPTION_MESSAGE} exception.message
 */
type EXCEPTION_MESSAGE_TYPE = string;
/**
 * A stacktrace as a string in the natural representation for the language runtime. The representation is to be determined and documented by each language SIG. `exception.stacktrace`
 *
 * Attribute Value Type: `string` {@link EXCEPTION_STACKTRACE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "Exception in thread \"main\" java.lang.RuntimeException: Test exception\n at com.example.GenerateTrace.methodB(GenerateTrace.java:13)\n at com.example.GenerateTrace.methodA(GenerateTrace.java:9)\n at com.example.GenerateTrace.main(GenerateTrace.java:5)"
 */
declare const EXCEPTION_STACKTRACE = "exception.stacktrace";
/**
 * Type for {@link EXCEPTION_STACKTRACE} exception.stacktrace
 */
type EXCEPTION_STACKTRACE_TYPE = string;
/**
 * The type of the exception (its fully-qualified class name, if applicable). The dynamic type of the exception should be preferred over the static type in languages that support it. `exception.type`
 *
 * Attribute Value Type: `string` {@link EXCEPTION_TYPE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "OSError"
 */
declare const EXCEPTION_TYPE = "exception.type";
/**
 * Type for {@link EXCEPTION_TYPE} exception.type
 */
type EXCEPTION_TYPE_TYPE = string;
/**
 * A boolean that is true if the serverless function is executed for the first time (aka cold-start). `faas.coldstart`
 *
 * Attribute Value Type: `boolean` {@link FAAS_COLDSTART_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * @example true
 */
declare const FAAS_COLDSTART = "faas.coldstart";
/**
 * Type for {@link FAAS_COLDSTART} faas.coldstart
 */
type FAAS_COLDSTART_TYPE = boolean;
/**
 * A string containing the schedule period as Cron Expression. `faas.cron`
 *
 * Attribute Value Type: `string` {@link FAAS_CRON_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "0/5 * * * ? *"
 */
declare const FAAS_CRON = "faas.cron";
/**
 * Type for {@link FAAS_CRON} faas.cron
 */
type FAAS_CRON_TYPE = string;
/**
 * A string containing the function invocation time in the ISO 8601 format expressed in UTC. `faas.time`
 *
 * Attribute Value Type: `string` {@link FAAS_TIME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "2020-01-23T13:47:06Z"
 */
declare const FAAS_TIME = "faas.time";
/**
 * Type for {@link FAAS_TIME} faas.time
 */
type FAAS_TIME_TYPE = string;
/**
 * Type of the trigger which caused this function invocation. `faas.trigger`
 *
 * Attribute Value Type: `string` {@link FAAS_TRIGGER_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "timer"
 */
declare const FAAS_TRIGGER = "faas.trigger";
/**
 * Type for {@link FAAS_TRIGGER} faas.trigger
 */
type FAAS_TRIGGER_TYPE = string;
/**
 * An instance of a feature flag evaluation. The value of this attribute is the boolean representing the evaluation result. The <key> suffix is the name of the feature flag. `flag.evaluation.<key>`
 *
 * Attribute Value Type: `boolean` {@link FLAG_EVALUATION_KEY_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Has Dynamic Suffix: true
 *
 * @example "flag.evaluation.is_new_ui=true"
 */
declare const FLAG_EVALUATION_KEY = "flag.evaluation.<key>";
/**
 * Type for {@link FLAG_EVALUATION_KEY} flag.evaluation.<key>
 */
type FLAG_EVALUATION_KEY_TYPE = boolean;
/**
 * The sum of all delayed frame durations in seconds during the lifetime of the span. For more information see [frames delay](https://develop.sentry.dev/sdk/performance/frames-delay/). `frames.delay`
 *
 * Attribute Value Type: `number` {@link FRAMES_DELAY_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 5
 */
declare const FRAMES_DELAY = "frames.delay";
/**
 * Type for {@link FRAMES_DELAY} frames.delay
 */
type FRAMES_DELAY_TYPE = number;
/**
 * The number of frozen frames rendered during the lifetime of the span. `frames.frozen`
 *
 * Attribute Value Type: `number` {@link FRAMES_FROZEN_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 3
 */
declare const FRAMES_FROZEN = "frames.frozen";
/**
 * Type for {@link FRAMES_FROZEN} frames.frozen
 */
type FRAMES_FROZEN_TYPE = number;
/**
 * The number of slow frames rendered during the lifetime of the span. `frames.slow`
 *
 * Attribute Value Type: `number` {@link FRAMES_SLOW_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 1
 */
declare const FRAMES_SLOW = "frames.slow";
/**
 * Type for {@link FRAMES_SLOW} frames.slow
 */
type FRAMES_SLOW_TYPE = number;
/**
 * The number of total frames rendered during the lifetime of the span. `frames.total`
 *
 * Attribute Value Type: `number` {@link FRAMES_TOTAL_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 60
 */
declare const FRAMES_TOTAL = "frames.total";
/**
 * Type for {@link FRAMES_TOTAL} frames.total
 */
type FRAMES_TOTAL_TYPE = number;
/**
 * The error message of a file system error. `fs_error`
 *
 * Attribute Value Type: `string` {@link FS_ERROR_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @deprecated Use {@link ERROR_TYPE} (error.type) instead - This attribute is not part of the OpenTelemetry specification and error.type fits much better.
 * @example "ENOENT: no such file or directory"
 */
declare const FS_ERROR = "fs_error";
/**
 * Type for {@link FS_ERROR} fs_error
 */
type FS_ERROR_TYPE = string;
/**
 * The name of the agent being used. `gen_ai.agent.name`
 *
 * Attribute Value Type: `string` {@link GEN_AI_AGENT_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "ResearchAssistant"
 */
declare const GEN_AI_AGENT_NAME = "gen_ai.agent.name";
/**
 * Type for {@link GEN_AI_AGENT_NAME} gen_ai.agent.name
 */
type GEN_AI_AGENT_NAME_TYPE = string;
/**
 * The assistant message passed to the model. `gen_ai.assistant.message`
 *
 * Attribute Value Type: `string` {@link GEN_AI_ASSISTANT_MESSAGE_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: No
 *
 * @example "get_weather tool call"
 */
declare const GEN_AI_ASSISTANT_MESSAGE = "gen_ai.assistant.message";
/**
 * Type for {@link GEN_AI_ASSISTANT_MESSAGE} gen_ai.assistant.message
 */
type GEN_AI_ASSISTANT_MESSAGE_TYPE = string;
/**
 * The model's response message. `gen_ai.choice`
 *
 * Attribute Value Type: `string` {@link GEN_AI_CHOICE_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: No
 *
 * @example "The weather in Paris is rainy and overcast, with temperatures around 57°F"
 */
declare const GEN_AI_CHOICE = "gen_ai.choice";
/**
 * Type for {@link GEN_AI_CHOICE} gen_ai.choice
 */
type GEN_AI_CHOICE_TYPE = string;
/**
 * The cost of tokens used to process the AI input (prompt) in USD (without cached input tokens). `gen_ai.cost.input_tokens`
 *
 * Attribute Value Type: `number` {@link GEN_AI_COST_INPUT_TOKENS_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 123.45
 */
declare const GEN_AI_COST_INPUT_TOKENS = "gen_ai.cost.input_tokens";
/**
 * Type for {@link GEN_AI_COST_INPUT_TOKENS} gen_ai.cost.input_tokens
 */
type GEN_AI_COST_INPUT_TOKENS_TYPE = number;
/**
 * The cost of tokens used for creating the AI output in USD (without reasoning tokens). `gen_ai.cost.output_tokens`
 *
 * Attribute Value Type: `number` {@link GEN_AI_COST_OUTPUT_TOKENS_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 123.45
 */
declare const GEN_AI_COST_OUTPUT_TOKENS = "gen_ai.cost.output_tokens";
/**
 * Type for {@link GEN_AI_COST_OUTPUT_TOKENS} gen_ai.cost.output_tokens
 */
type GEN_AI_COST_OUTPUT_TOKENS_TYPE = number;
/**
 * The total cost for the tokens used. `gen_ai.cost.total_tokens`
 *
 * Attribute Value Type: `number` {@link GEN_AI_COST_TOTAL_TOKENS_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 12.34
 */
declare const GEN_AI_COST_TOTAL_TOKENS = "gen_ai.cost.total_tokens";
/**
 * Type for {@link GEN_AI_COST_TOTAL_TOKENS} gen_ai.cost.total_tokens
 */
type GEN_AI_COST_TOTAL_TOKENS_TYPE = number;
/**
 * The name of the operation being performed. `gen_ai.operation.name`
 *
 * Attribute Value Type: `string` {@link GEN_AI_OPERATION_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "chat"
 */
declare const GEN_AI_OPERATION_NAME = "gen_ai.operation.name";
/**
 * Type for {@link GEN_AI_OPERATION_NAME} gen_ai.operation.name
 */
type GEN_AI_OPERATION_NAME_TYPE = string;
/**
 * The type of AI operation. Must be one of 'agent', 'ai_client', 'tool', 'handoff', 'guardrail'. Makes querying for spans in the UI easier. `gen_ai.operation.type`
 *
 * Attribute Value Type: `string` {@link GEN_AI_OPERATION_TYPE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "tool"
 */
declare const GEN_AI_OPERATION_TYPE = "gen_ai.operation.type";
/**
 * Type for {@link GEN_AI_OPERATION_TYPE} gen_ai.operation.type
 */
type GEN_AI_OPERATION_TYPE_TYPE = string;
/**
 * Name of the AI pipeline or chain being executed. `gen_ai.pipeline.name`
 *
 * Attribute Value Type: `string` {@link GEN_AI_PIPELINE_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link AI_PIPELINE_NAME} `ai.pipeline.name`
 *
 * @example "Autofix Pipeline"
 */
declare const GEN_AI_PIPELINE_NAME = "gen_ai.pipeline.name";
/**
 * Type for {@link GEN_AI_PIPELINE_NAME} gen_ai.pipeline.name
 */
type GEN_AI_PIPELINE_NAME_TYPE = string;
/**
 * The input messages sent to the model `gen_ai.prompt`
 *
 * Attribute Value Type: `string` {@link GEN_AI_PROMPT_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @deprecated  - Deprecated from OTEL, use gen_ai.input.messages with the new format instead.
 * @example "[{\"role\": \"user\", \"message\": \"hello\"}]"
 */
declare const GEN_AI_PROMPT = "gen_ai.prompt";
/**
 * Type for {@link GEN_AI_PROMPT} gen_ai.prompt
 */
type GEN_AI_PROMPT_TYPE = string;
/**
 * The available tools for the model. It has to be a stringified version of an array of objects. `gen_ai.request.available_tools`
 *
 * Attribute Value Type: `string` {@link GEN_AI_REQUEST_AVAILABLE_TOOLS_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "[{\"name\": \"get_weather\", \"description\": \"Get the weather for a given location\"}, {\"name\": \"get_news\", \"description\": \"Get the news for a given topic\"}]"
 */
declare const GEN_AI_REQUEST_AVAILABLE_TOOLS = "gen_ai.request.available_tools";
/**
 * Type for {@link GEN_AI_REQUEST_AVAILABLE_TOOLS} gen_ai.request.available_tools
 */
type GEN_AI_REQUEST_AVAILABLE_TOOLS_TYPE = string;
/**
 * Used to reduce repetitiveness of generated tokens. The higher the value, the stronger a penalty is applied to previously present tokens, proportional to how many times they have already appeared in the prompt or prior generation. `gen_ai.request.frequency_penalty`
 *
 * Attribute Value Type: `number` {@link GEN_AI_REQUEST_FREQUENCY_PENALTY_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link AI_FREQUENCY_PENALTY} `ai.frequency_penalty`
 *
 * @example 0.5
 */
declare const GEN_AI_REQUEST_FREQUENCY_PENALTY = "gen_ai.request.frequency_penalty";
/**
 * Type for {@link GEN_AI_REQUEST_FREQUENCY_PENALTY} gen_ai.request.frequency_penalty
 */
type GEN_AI_REQUEST_FREQUENCY_PENALTY_TYPE = number;
/**
 * The maximum number of tokens to generate in the response. `gen_ai.request.max_tokens`
 *
 * Attribute Value Type: `number` {@link GEN_AI_REQUEST_MAX_TOKENS_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * @example 2048
 */
declare const GEN_AI_REQUEST_MAX_TOKENS = "gen_ai.request.max_tokens";
/**
 * Type for {@link GEN_AI_REQUEST_MAX_TOKENS} gen_ai.request.max_tokens
 */
type GEN_AI_REQUEST_MAX_TOKENS_TYPE = number;
/**
 * The messages passed to the model. It has to be a stringified version of an array of objects. The `role` attribute of each object must be `"user"`, `"assistant"`, `"tool"`, or `"system"`. For messages of the role `"tool"`, the `content` can be a string or an arbitrary object with information about the tool call. For other messages the `content` can be either a string or a list of objects in the format `{type: "text", text:"..."}`. `gen_ai.request.messages`
 *
 * Attribute Value Type: `string` {@link GEN_AI_REQUEST_MESSAGES_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link AI_INPUT_MESSAGES} `ai.input_messages`
 *
 * @example "[{\"role\": \"system\", \"content\": \"Generate a random number.\"}, {\"role\": \"user\", \"content\": [{\"text\": \"Generate a random number between 0 and 10.\", \"type\": \"text\"}]}, {\"role\": \"tool\", \"content\": {\"toolCallId\": \"1\", \"toolName\": \"Weather\", \"output\": \"rainy\"}}]"
 */
declare const GEN_AI_REQUEST_MESSAGES = "gen_ai.request.messages";
/**
 * Type for {@link GEN_AI_REQUEST_MESSAGES} gen_ai.request.messages
 */
type GEN_AI_REQUEST_MESSAGES_TYPE = string;
/**
 * The model identifier being used for the request. `gen_ai.request.model`
 *
 * Attribute Value Type: `string` {@link GEN_AI_REQUEST_MODEL_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "gpt-4-turbo-preview"
 */
declare const GEN_AI_REQUEST_MODEL = "gen_ai.request.model";
/**
 * Type for {@link GEN_AI_REQUEST_MODEL} gen_ai.request.model
 */
type GEN_AI_REQUEST_MODEL_TYPE = string;
/**
 * Used to reduce repetitiveness of generated tokens. Similar to frequency_penalty, except that this penalty is applied equally to all tokens that have already appeared, regardless of their exact frequencies. `gen_ai.request.presence_penalty`
 *
 * Attribute Value Type: `number` {@link GEN_AI_REQUEST_PRESENCE_PENALTY_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link AI_PRESENCE_PENALTY} `ai.presence_penalty`
 *
 * @example 0.5
 */
declare const GEN_AI_REQUEST_PRESENCE_PENALTY = "gen_ai.request.presence_penalty";
/**
 * Type for {@link GEN_AI_REQUEST_PRESENCE_PENALTY} gen_ai.request.presence_penalty
 */
type GEN_AI_REQUEST_PRESENCE_PENALTY_TYPE = number;
/**
 * The seed, ideally models given the same seed and same other parameters will produce the exact same output. `gen_ai.request.seed`
 *
 * Attribute Value Type: `string` {@link GEN_AI_REQUEST_SEED_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link AI_SEED} `ai.seed`
 *
 * @example "1234567890"
 */
declare const GEN_AI_REQUEST_SEED = "gen_ai.request.seed";
/**
 * Type for {@link GEN_AI_REQUEST_SEED} gen_ai.request.seed
 */
type GEN_AI_REQUEST_SEED_TYPE = string;
/**
 * For an AI model call, the temperature parameter. Temperature essentially means how random the output will be. `gen_ai.request.temperature`
 *
 * Attribute Value Type: `number` {@link GEN_AI_REQUEST_TEMPERATURE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link AI_TEMPERATURE} `ai.temperature`
 *
 * @example 0.1
 */
declare const GEN_AI_REQUEST_TEMPERATURE = "gen_ai.request.temperature";
/**
 * Type for {@link GEN_AI_REQUEST_TEMPERATURE} gen_ai.request.temperature
 */
type GEN_AI_REQUEST_TEMPERATURE_TYPE = number;
/**
 * Limits the model to only consider the K most likely next tokens, where K is an integer (e.g., top_k=20 means only the 20 highest probability tokens are considered). `gen_ai.request.top_k`
 *
 * Attribute Value Type: `number` {@link GEN_AI_REQUEST_TOP_K_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link AI_TOP_K} `ai.top_k`
 *
 * @example 35
 */
declare const GEN_AI_REQUEST_TOP_K = "gen_ai.request.top_k";
/**
 * Type for {@link GEN_AI_REQUEST_TOP_K} gen_ai.request.top_k
 */
type GEN_AI_REQUEST_TOP_K_TYPE = number;
/**
 * Limits the model to only consider tokens whose cumulative probability mass adds up to p, where p is a float between 0 and 1 (e.g., top_p=0.7 means only tokens that sum up to 70% of the probability mass are considered). `gen_ai.request.top_p`
 *
 * Attribute Value Type: `number` {@link GEN_AI_REQUEST_TOP_P_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link AI_TOP_P} `ai.top_p`
 *
 * @example 0.7
 */
declare const GEN_AI_REQUEST_TOP_P = "gen_ai.request.top_p";
/**
 * Type for {@link GEN_AI_REQUEST_TOP_P} gen_ai.request.top_p
 */
type GEN_AI_REQUEST_TOP_P_TYPE = number;
/**
 * The reason why the model stopped generating. `gen_ai.response.finish_reasons`
 *
 * Attribute Value Type: `string` {@link GEN_AI_RESPONSE_FINISH_REASONS_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link AI_FINISH_REASON} `ai.finish_reason`
 *
 * @example "COMPLETE"
 */
declare const GEN_AI_RESPONSE_FINISH_REASONS = "gen_ai.response.finish_reasons";
/**
 * Type for {@link GEN_AI_RESPONSE_FINISH_REASONS} gen_ai.response.finish_reasons
 */
type GEN_AI_RESPONSE_FINISH_REASONS_TYPE = string;
/**
 * Unique identifier for the completion. `gen_ai.response.id`
 *
 * Attribute Value Type: `string` {@link GEN_AI_RESPONSE_ID_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link AI_GENERATION_ID} `ai.generation_id`
 *
 * @example "gen_123abc"
 */
declare const GEN_AI_RESPONSE_ID = "gen_ai.response.id";
/**
 * Type for {@link GEN_AI_RESPONSE_ID} gen_ai.response.id
 */
type GEN_AI_RESPONSE_ID_TYPE = string;
/**
 * The vendor-specific ID of the model used. `gen_ai.response.model`
 *
 * Attribute Value Type: `string` {@link GEN_AI_RESPONSE_MODEL_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link AI_MODEL_ID} `ai.model_id`
 *
 * @example "gpt-4"
 */
declare const GEN_AI_RESPONSE_MODEL = "gen_ai.response.model";
/**
 * Type for {@link GEN_AI_RESPONSE_MODEL} gen_ai.response.model
 */
type GEN_AI_RESPONSE_MODEL_TYPE = string;
/**
 * Whether or not the AI model call's response was streamed back asynchronously `gen_ai.response.streaming`
 *
 * Attribute Value Type: `boolean` {@link GEN_AI_RESPONSE_STREAMING_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link AI_STREAMING} `ai.streaming`
 *
 * @example true
 */
declare const GEN_AI_RESPONSE_STREAMING = "gen_ai.response.streaming";
/**
 * Type for {@link GEN_AI_RESPONSE_STREAMING} gen_ai.response.streaming
 */
type GEN_AI_RESPONSE_STREAMING_TYPE = boolean;
/**
 * The model's response text messages. It has to be a stringified version of an array of response text messages. `gen_ai.response.text`
 *
 * Attribute Value Type: `string` {@link GEN_AI_RESPONSE_TEXT_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "[\"The weather in Paris is rainy and overcast, with temperatures around 57°F\", \"The weather in London is sunny and warm, with temperatures around 65°F\"]"
 */
declare const GEN_AI_RESPONSE_TEXT = "gen_ai.response.text";
/**
 * Type for {@link GEN_AI_RESPONSE_TEXT} gen_ai.response.text
 */
type GEN_AI_RESPONSE_TEXT_TYPE = string;
/**
 * The total output tokens per seconds throughput `gen_ai.response.tokens_per_second`
 *
 * Attribute Value Type: `number` {@link GEN_AI_RESPONSE_TOKENS_PER_SECOND_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 12345.67
 */
declare const GEN_AI_RESPONSE_TOKENS_PER_SECOND = "gen_ai.response.tokens_per_second";
/**
 * Type for {@link GEN_AI_RESPONSE_TOKENS_PER_SECOND} gen_ai.response.tokens_per_second
 */
type GEN_AI_RESPONSE_TOKENS_PER_SECOND_TYPE = number;
/**
 * The tool calls in the model's response. It has to be a stringified version of an array of objects. `gen_ai.response.tool_calls`
 *
 * Attribute Value Type: `string` {@link GEN_AI_RESPONSE_TOOL_CALLS_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "[{\"name\": \"get_weather\", \"arguments\": {\"location\": \"Paris\"}}]"
 */
declare const GEN_AI_RESPONSE_TOOL_CALLS = "gen_ai.response.tool_calls";
/**
 * Type for {@link GEN_AI_RESPONSE_TOOL_CALLS} gen_ai.response.tool_calls
 */
type GEN_AI_RESPONSE_TOOL_CALLS_TYPE = string;
/**
 * The provider of the model. `gen_ai.system`
 *
 * Attribute Value Type: `string` {@link GEN_AI_SYSTEM_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link AI_MODEL_PROVIDER} `ai.model.provider`
 *
 * @example "openai"
 */
declare const GEN_AI_SYSTEM = "gen_ai.system";
/**
 * Type for {@link GEN_AI_SYSTEM} gen_ai.system
 */
type GEN_AI_SYSTEM_TYPE = string;
/**
 * The system instructions passed to the model. `gen_ai.system.message`
 *
 * Attribute Value Type: `string` {@link GEN_AI_SYSTEM_MESSAGE_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: No
 *
 * @example "You are a helpful assistant"
 */
declare const GEN_AI_SYSTEM_MESSAGE = "gen_ai.system.message";
/**
 * Type for {@link GEN_AI_SYSTEM_MESSAGE} gen_ai.system.message
 */
type GEN_AI_SYSTEM_MESSAGE_TYPE = string;
/**
 * The description of the tool being used. `gen_ai.tool.description`
 *
 * Attribute Value Type: `string` {@link GEN_AI_TOOL_DESCRIPTION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "Searches the web for current information about a topic"
 */
declare const GEN_AI_TOOL_DESCRIPTION = "gen_ai.tool.description";
/**
 * Type for {@link GEN_AI_TOOL_DESCRIPTION} gen_ai.tool.description
 */
type GEN_AI_TOOL_DESCRIPTION_TYPE = string;
/**
 * The input of the tool being used. It has to be a stringified version of the input to the tool. `gen_ai.tool.input`
 *
 * Attribute Value Type: `string` {@link GEN_AI_TOOL_INPUT_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "{\"location\": \"Paris\"}"
 */
declare const GEN_AI_TOOL_INPUT = "gen_ai.tool.input";
/**
 * Type for {@link GEN_AI_TOOL_INPUT} gen_ai.tool.input
 */
type GEN_AI_TOOL_INPUT_TYPE = string;
/**
 * The response from a tool or function call passed to the model. `gen_ai.tool.message`
 *
 * Attribute Value Type: `string` {@link GEN_AI_TOOL_MESSAGE_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: No
 *
 * @example "rainy, 57°F"
 */
declare const GEN_AI_TOOL_MESSAGE = "gen_ai.tool.message";
/**
 * Type for {@link GEN_AI_TOOL_MESSAGE} gen_ai.tool.message
 */
type GEN_AI_TOOL_MESSAGE_TYPE = string;
/**
 * Name of the tool utilized by the agent. `gen_ai.tool.name`
 *
 * Attribute Value Type: `string` {@link GEN_AI_TOOL_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link AI_FUNCTION_CALL} `ai.function_call`
 *
 * @example "Flights"
 */
declare const GEN_AI_TOOL_NAME = "gen_ai.tool.name";
/**
 * Type for {@link GEN_AI_TOOL_NAME} gen_ai.tool.name
 */
type GEN_AI_TOOL_NAME_TYPE = string;
/**
 * The output of the tool being used. It has to be a stringified version of the output of the tool. `gen_ai.tool.output`
 *
 * Attribute Value Type: `string` {@link GEN_AI_TOOL_OUTPUT_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "rainy, 57°F"
 */
declare const GEN_AI_TOOL_OUTPUT = "gen_ai.tool.output";
/**
 * Type for {@link GEN_AI_TOOL_OUTPUT} gen_ai.tool.output
 */
type GEN_AI_TOOL_OUTPUT_TYPE = string;
/**
 * The type of tool being used. `gen_ai.tool.type`
 *
 * Attribute Value Type: `string` {@link GEN_AI_TOOL_TYPE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "function"
 */
declare const GEN_AI_TOOL_TYPE = "gen_ai.tool.type";
/**
 * Type for {@link GEN_AI_TOOL_TYPE} gen_ai.tool.type
 */
type GEN_AI_TOOL_TYPE_TYPE = string;
/**
 * The number of tokens used in the GenAI response (completion). `gen_ai.usage.completion_tokens`
 *
 * Attribute Value Type: `number` {@link GEN_AI_USAGE_COMPLETION_TOKENS_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link AI_COMPLETION_TOKENS_USED} `ai.completion_tokens.used`, {@link GEN_AI_USAGE_OUTPUT_TOKENS} `gen_ai.usage.output_tokens`
 *
 * @deprecated Use {@link GEN_AI_USAGE_OUTPUT_TOKENS} (gen_ai.usage.output_tokens) instead
 * @example 10
 */
declare const GEN_AI_USAGE_COMPLETION_TOKENS = "gen_ai.usage.completion_tokens";
/**
 * Type for {@link GEN_AI_USAGE_COMPLETION_TOKENS} gen_ai.usage.completion_tokens
 */
type GEN_AI_USAGE_COMPLETION_TOKENS_TYPE = number;
/**
 * The number of tokens used to process the AI input (prompt) without cached input tokens. `gen_ai.usage.input_tokens`
 *
 * Attribute Value Type: `number` {@link GEN_AI_USAGE_INPUT_TOKENS_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link AI_PROMPT_TOKENS_USED} `ai.prompt_tokens.used`, {@link GEN_AI_USAGE_PROMPT_TOKENS} `gen_ai.usage.prompt_tokens`
 *
 * @example 10
 */
declare const GEN_AI_USAGE_INPUT_TOKENS = "gen_ai.usage.input_tokens";
/**
 * Type for {@link GEN_AI_USAGE_INPUT_TOKENS} gen_ai.usage.input_tokens
 */
type GEN_AI_USAGE_INPUT_TOKENS_TYPE = number;
/**
 * The number of cached tokens used to process the AI input (prompt). `gen_ai.usage.input_tokens.cached`
 *
 * Attribute Value Type: `number` {@link GEN_AI_USAGE_INPUT_TOKENS_CACHED_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 50
 */
declare const GEN_AI_USAGE_INPUT_TOKENS_CACHED = "gen_ai.usage.input_tokens.cached";
/**
 * Type for {@link GEN_AI_USAGE_INPUT_TOKENS_CACHED} gen_ai.usage.input_tokens.cached
 */
type GEN_AI_USAGE_INPUT_TOKENS_CACHED_TYPE = number;
/**
 * The number of tokens used for creating the AI output (without reasoning tokens). `gen_ai.usage.output_tokens`
 *
 * Attribute Value Type: `number` {@link GEN_AI_USAGE_OUTPUT_TOKENS_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link AI_COMPLETION_TOKENS_USED} `ai.completion_tokens.used`, {@link GEN_AI_USAGE_COMPLETION_TOKENS} `gen_ai.usage.completion_tokens`
 *
 * @example 10
 */
declare const GEN_AI_USAGE_OUTPUT_TOKENS = "gen_ai.usage.output_tokens";
/**
 * Type for {@link GEN_AI_USAGE_OUTPUT_TOKENS} gen_ai.usage.output_tokens
 */
type GEN_AI_USAGE_OUTPUT_TOKENS_TYPE = number;
/**
 * The number of tokens used for reasoning to create the AI output. `gen_ai.usage.output_tokens.reasoning`
 *
 * Attribute Value Type: `number` {@link GEN_AI_USAGE_OUTPUT_TOKENS_REASONING_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 75
 */
declare const GEN_AI_USAGE_OUTPUT_TOKENS_REASONING = "gen_ai.usage.output_tokens.reasoning";
/**
 * Type for {@link GEN_AI_USAGE_OUTPUT_TOKENS_REASONING} gen_ai.usage.output_tokens.reasoning
 */
type GEN_AI_USAGE_OUTPUT_TOKENS_REASONING_TYPE = number;
/**
 * The number of tokens used in the GenAI input (prompt). `gen_ai.usage.prompt_tokens`
 *
 * Attribute Value Type: `number` {@link GEN_AI_USAGE_PROMPT_TOKENS_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link AI_PROMPT_TOKENS_USED} `ai.prompt_tokens.used`, {@link GEN_AI_USAGE_INPUT_TOKENS} `gen_ai.usage.input_tokens`
 *
 * @deprecated Use {@link GEN_AI_USAGE_INPUT_TOKENS} (gen_ai.usage.input_tokens) instead
 * @example 20
 */
declare const GEN_AI_USAGE_PROMPT_TOKENS = "gen_ai.usage.prompt_tokens";
/**
 * Type for {@link GEN_AI_USAGE_PROMPT_TOKENS} gen_ai.usage.prompt_tokens
 */
type GEN_AI_USAGE_PROMPT_TOKENS_TYPE = number;
/**
 * The total cost for the tokens used. `gen_ai.usage.total_cost`
 *
 * Attribute Value Type: `number` {@link GEN_AI_USAGE_TOTAL_COST_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @deprecated Use {@link GEN_AI_COST_TOTAL_TOKENS} (gen_ai.cost.total_tokens) instead
 * @example 12.34
 */
declare const GEN_AI_USAGE_TOTAL_COST = "gen_ai.usage.total_cost";
/**
 * Type for {@link GEN_AI_USAGE_TOTAL_COST} gen_ai.usage.total_cost
 */
type GEN_AI_USAGE_TOTAL_COST_TYPE = number;
/**
 * The total number of tokens used to process the prompt. (input tokens plus output todkens) `gen_ai.usage.total_tokens`
 *
 * Attribute Value Type: `number` {@link GEN_AI_USAGE_TOTAL_TOKENS_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link AI_TOTAL_TOKENS_USED} `ai.total_tokens.used`
 *
 * @example 20
 */
declare const GEN_AI_USAGE_TOTAL_TOKENS = "gen_ai.usage.total_tokens";
/**
 * Type for {@link GEN_AI_USAGE_TOTAL_TOKENS} gen_ai.usage.total_tokens
 */
type GEN_AI_USAGE_TOTAL_TOKENS_TYPE = number;
/**
 * The user message passed to the model. `gen_ai.user.message`
 *
 * Attribute Value Type: `string` {@link GEN_AI_USER_MESSAGE_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: No
 *
 * @example "What's the weather in Paris?"
 */
declare const GEN_AI_USER_MESSAGE = "gen_ai.user.message";
/**
 * Type for {@link GEN_AI_USER_MESSAGE} gen_ai.user.message
 */
type GEN_AI_USER_MESSAGE_TYPE = string;
/**
 * The name of the operation being executed. `graphql.operation.name`
 *
 * Attribute Value Type: `string` {@link GRAPHQL_OPERATION_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "findBookById"
 */
declare const GRAPHQL_OPERATION_NAME = "graphql.operation.name";
/**
 * Type for {@link GRAPHQL_OPERATION_NAME} graphql.operation.name
 */
type GRAPHQL_OPERATION_NAME_TYPE = string;
/**
 * The type of the operation being executed. `graphql.operation.type`
 *
 * Attribute Value Type: `string` {@link GRAPHQL_OPERATION_TYPE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "query"
 */
declare const GRAPHQL_OPERATION_TYPE = "graphql.operation.type";
/**
 * Type for {@link GRAPHQL_OPERATION_TYPE} graphql.operation.type
 */
type GRAPHQL_OPERATION_TYPE_TYPE = string;
/**
 * Client address - domain name if available without reverse DNS lookup; otherwise, IP address or Unix domain socket name. `http.client_ip`
 *
 * Attribute Value Type: `string` {@link HTTP_CLIENT_IP_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link CLIENT_ADDRESS} `client.address`
 *
 * @deprecated Use {@link CLIENT_ADDRESS} (client.address) instead
 * @example "example.com"
 */
declare const HTTP_CLIENT_IP = "http.client_ip";
/**
 * Type for {@link HTTP_CLIENT_IP} http.client_ip
 */
type HTTP_CLIENT_IP_TYPE = string;
/**
 * The decoded body size of the response (in bytes). `http.decoded_response_content_length`
 *
 * Attribute Value Type: `number` {@link HTTP_DECODED_RESPONSE_CONTENT_LENGTH_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 456
 */
declare const HTTP_DECODED_RESPONSE_CONTENT_LENGTH = "http.decoded_response_content_length";
/**
 * Type for {@link HTTP_DECODED_RESPONSE_CONTENT_LENGTH} http.decoded_response_content_length
 */
type HTTP_DECODED_RESPONSE_CONTENT_LENGTH_TYPE = number;
/**
 * The actual version of the protocol used for network communication. `http.flavor`
 *
 * Attribute Value Type: `string` {@link HTTP_FLAVOR_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link NETWORK_PROTOCOL_VERSION} `network.protocol.version`, {@link NET_PROTOCOL_VERSION} `net.protocol.version`
 *
 * @deprecated Use {@link NETWORK_PROTOCOL_VERSION} (network.protocol.version) instead
 * @example "1.1"
 */
declare const HTTP_FLAVOR = "http.flavor";
/**
 * Type for {@link HTTP_FLAVOR} http.flavor
 */
type HTTP_FLAVOR_TYPE = string;
/**
 * The fragments present in the URI. Note that this contains the leading # character, while the `url.fragment` attribute does not. `http.fragment`
 *
 * Attribute Value Type: `string` {@link HTTP_FRAGMENT_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "#details"
 */
declare const HTTP_FRAGMENT = "http.fragment";
/**
 * Type for {@link HTTP_FRAGMENT} http.fragment
 */
type HTTP_FRAGMENT_TYPE = string;
/**
 * The domain name. `http.host`
 *
 * Attribute Value Type: `string` {@link HTTP_HOST_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link SERVER_ADDRESS} `server.address`, {@link CLIENT_ADDRESS} `client.address`, {@link HTTP_SERVER_NAME} `http.server_name`, {@link NET_HOST_NAME} `net.host.name`
 *
 * @deprecated Use {@link SERVER_ADDRESS} (server.address) instead - Deprecated, use one of `server.address` or `client.address`, depending on the usage
 * @example "example.com"
 */
declare const HTTP_HOST = "http.host";
/**
 * Type for {@link HTTP_HOST} http.host
 */
type HTTP_HOST_TYPE = string;
/**
 * The HTTP method used. `http.method`
 *
 * Attribute Value Type: `string` {@link HTTP_METHOD_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link HTTP_REQUEST_METHOD} `http.request.method`
 *
 * @deprecated Use {@link HTTP_REQUEST_METHOD} (http.request.method) instead
 * @example "GET"
 */
declare const HTTP_METHOD = "http.method";
/**
 * Type for {@link HTTP_METHOD} http.method
 */
type HTTP_METHOD_TYPE = string;
/**
 * The query string present in the URL. Note that this contains the leading ? character, while the `url.query` attribute does not. `http.query`
 *
 * Attribute Value Type: `string` {@link HTTP_QUERY_TYPE}
 *
 * Contains PII: maybe - Query string values can contain sensitive information. Clients should attempt to scrub parameters that might contain sensitive information.
 *
 * Attribute defined in OTEL: No
 *
 * @example "?foo=bar&bar=baz"
 */
declare const HTTP_QUERY = "http.query";
/**
 * Type for {@link HTTP_QUERY} http.query
 */
type HTTP_QUERY_TYPE = string;
/**
 * The UNIX timestamp representing the time immediately before the user agent starts establishing the connection to the server to retrieve the resource. `http.request.connect_start`
 *
 * Attribute Value Type: `number` {@link HTTP_REQUEST_CONNECT_START_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 1732829555.111
 */
declare const HTTP_REQUEST_CONNECT_START = "http.request.connect_start";
/**
 * Type for {@link HTTP_REQUEST_CONNECT_START} http.request.connect_start
 */
type HTTP_REQUEST_CONNECT_START_TYPE = number;
/**
 * The UNIX timestamp representing the time immediately after the browser finishes establishing the connection to the server to retrieve the resource. The timestamp value includes the time interval to establish the transport connection, as well as other time intervals such as TLS handshake and SOCKS authentication. `http.request.connection_end`
 *
 * Attribute Value Type: `number` {@link HTTP_REQUEST_CONNECTION_END_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 1732829555.15
 */
declare const HTTP_REQUEST_CONNECTION_END = "http.request.connection_end";
/**
 * Type for {@link HTTP_REQUEST_CONNECTION_END} http.request.connection_end
 */
type HTTP_REQUEST_CONNECTION_END_TYPE = number;
/**
 * The UNIX timestamp representing the time immediately after the browser finishes the domain-name lookup for the resource. `http.request.domain_lookup_end`
 *
 * Attribute Value Type: `number` {@link HTTP_REQUEST_DOMAIN_LOOKUP_END_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 1732829555.201
 */
declare const HTTP_REQUEST_DOMAIN_LOOKUP_END = "http.request.domain_lookup_end";
/**
 * Type for {@link HTTP_REQUEST_DOMAIN_LOOKUP_END} http.request.domain_lookup_end
 */
type HTTP_REQUEST_DOMAIN_LOOKUP_END_TYPE = number;
/**
 * The UNIX timestamp representing the time immediately before the browser starts the domain name lookup for the resource. `http.request.domain_lookup_start`
 *
 * Attribute Value Type: `number` {@link HTTP_REQUEST_DOMAIN_LOOKUP_START_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 1732829555.322
 */
declare const HTTP_REQUEST_DOMAIN_LOOKUP_START = "http.request.domain_lookup_start";
/**
 * Type for {@link HTTP_REQUEST_DOMAIN_LOOKUP_START} http.request.domain_lookup_start
 */
type HTTP_REQUEST_DOMAIN_LOOKUP_START_TYPE = number;
/**
 * The UNIX timestamp representing the time immediately before the browser starts to fetch the resource. `http.request.fetch_start`
 *
 * Attribute Value Type: `number` {@link HTTP_REQUEST_FETCH_START_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 1732829555.389
 */
declare const HTTP_REQUEST_FETCH_START = "http.request.fetch_start";
/**
 * Type for {@link HTTP_REQUEST_FETCH_START} http.request.fetch_start
 */
type HTTP_REQUEST_FETCH_START_TYPE = number;
/**
 * HTTP request headers, <key> being the normalized HTTP Header name (lowercase), the value being the header values. `http.request.header.<key>`
 *
 * Attribute Value Type: `Array<string>` {@link HTTP_REQUEST_HEADER_KEY_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Has Dynamic Suffix: true
 *
 * @example "http.request.header.custom-header=['foo', 'bar']"
 */
declare const HTTP_REQUEST_HEADER_KEY = "http.request.header.<key>";
/**
 * Type for {@link HTTP_REQUEST_HEADER_KEY} http.request.header.<key>
 */
type HTTP_REQUEST_HEADER_KEY_TYPE = Array<string>;
/**
 * The HTTP method used. `http.request.method`
 *
 * Attribute Value Type: `string` {@link HTTP_REQUEST_METHOD_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link METHOD} `method`, {@link HTTP_METHOD} `http.method`
 *
 * @example "GET"
 */
declare const HTTP_REQUEST_METHOD = "http.request.method";
/**
 * Type for {@link HTTP_REQUEST_METHOD} http.request.method
 */
type HTTP_REQUEST_METHOD_TYPE = string;
/**
 * The UNIX timestamp representing the timestamp immediately after receiving the last byte of the response of the last redirect `http.request.redirect_end`
 *
 * Attribute Value Type: `number` {@link HTTP_REQUEST_REDIRECT_END_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 1732829558.502
 */
declare const HTTP_REQUEST_REDIRECT_END = "http.request.redirect_end";
/**
 * Type for {@link HTTP_REQUEST_REDIRECT_END} http.request.redirect_end
 */
type HTTP_REQUEST_REDIRECT_END_TYPE = number;
/**
 * The UNIX timestamp representing the start time of the fetch which that initiates the redirect. `http.request.redirect_start`
 *
 * Attribute Value Type: `number` {@link HTTP_REQUEST_REDIRECT_START_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 1732829555.495
 */
declare const HTTP_REQUEST_REDIRECT_START = "http.request.redirect_start";
/**
 * Type for {@link HTTP_REQUEST_REDIRECT_START} http.request.redirect_start
 */
type HTTP_REQUEST_REDIRECT_START_TYPE = number;
/**
 * The UNIX timestamp representing the time immediately before the browser starts requesting the resource from the server, cache, or local resource. If the transport connection fails and the browser retires the request, the value returned will be the start of the retry request. `http.request.request_start`
 *
 * Attribute Value Type: `number` {@link HTTP_REQUEST_REQUEST_START_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 1732829555.51
 */
declare const HTTP_REQUEST_REQUEST_START = "http.request.request_start";
/**
 * Type for {@link HTTP_REQUEST_REQUEST_START} http.request.request_start
 */
type HTTP_REQUEST_REQUEST_START_TYPE = number;
/**
 * The ordinal number of request resending attempt (for any reason, including redirects). `http.request.resend_count`
 *
 * Attribute Value Type: `number` {@link HTTP_REQUEST_RESEND_COUNT_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 2
 */
declare const HTTP_REQUEST_RESEND_COUNT = "http.request.resend_count";
/**
 * Type for {@link HTTP_REQUEST_RESEND_COUNT} http.request.resend_count
 */
type HTTP_REQUEST_RESEND_COUNT_TYPE = number;
/**
 * The UNIX timestamp representing the time immediately after the browser receives the last byte of the resource or immediately before the transport connection is closed, whichever comes first. `http.request.response_end`
 *
 * Attribute Value Type: `number` {@link HTTP_REQUEST_RESPONSE_END_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 1732829555.89
 */
declare const HTTP_REQUEST_RESPONSE_END = "http.request.response_end";
/**
 * Type for {@link HTTP_REQUEST_RESPONSE_END} http.request.response_end
 */
type HTTP_REQUEST_RESPONSE_END_TYPE = number;
/**
 * The UNIX timestamp representing the time immediately before the browser starts requesting the resource from the server, cache, or local resource. If the transport connection fails and the browser retires the request, the value returned will be the start of the retry request. `http.request.response_start`
 *
 * Attribute Value Type: `number` {@link HTTP_REQUEST_RESPONSE_START_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 1732829555.7
 */
declare const HTTP_REQUEST_RESPONSE_START = "http.request.response_start";
/**
 * Type for {@link HTTP_REQUEST_RESPONSE_START} http.request.response_start
 */
type HTTP_REQUEST_RESPONSE_START_TYPE = number;
/**
 * The UNIX timestamp representing the time immediately before the browser starts the handshake process to secure the current connection. If a secure connection is not used, the property returns zero. `http.request.secure_connection_start`
 *
 * Attribute Value Type: `number` {@link HTTP_REQUEST_SECURE_CONNECTION_START_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 1732829555.73
 */
declare const HTTP_REQUEST_SECURE_CONNECTION_START = "http.request.secure_connection_start";
/**
 * Type for {@link HTTP_REQUEST_SECURE_CONNECTION_START} http.request.secure_connection_start
 */
type HTTP_REQUEST_SECURE_CONNECTION_START_TYPE = number;
/**
 * The time in seconds from the browser's timeorigin to when the first byte of the request's response was received. See https://web.dev/articles/ttfb#measure-resource-requests `http.request.time_to_first_byte`
 *
 * Attribute Value Type: `number` {@link HTTP_REQUEST_TIME_TO_FIRST_BYTE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 1.032
 */
declare const HTTP_REQUEST_TIME_TO_FIRST_BYTE = "http.request.time_to_first_byte";
/**
 * Type for {@link HTTP_REQUEST_TIME_TO_FIRST_BYTE} http.request.time_to_first_byte
 */
type HTTP_REQUEST_TIME_TO_FIRST_BYTE_TYPE = number;
/**
 * The UNIX timestamp representing the timestamp immediately before dispatching the FetchEvent if a Service Worker thread is already running, or immediately before starting the Service Worker thread if it is not already running. `http.request.worker_start`
 *
 * Attribute Value Type: `number` {@link HTTP_REQUEST_WORKER_START_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 1732829553.68
 */
declare const HTTP_REQUEST_WORKER_START = "http.request.worker_start";
/**
 * Type for {@link HTTP_REQUEST_WORKER_START} http.request.worker_start
 */
type HTTP_REQUEST_WORKER_START_TYPE = number;
/**
 * The encoded body size of the response (in bytes). `http.response.body.size`
 *
 * Attribute Value Type: `number` {@link HTTP_RESPONSE_BODY_SIZE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link HTTP_RESPONSE_CONTENT_LENGTH} `http.response_content_length`, {@link HTTP_RESPONSE_HEADER_CONTENT_LENGTH} `http.response.header.content-length`
 *
 * @example 123
 */
declare const HTTP_RESPONSE_BODY_SIZE = "http.response.body.size";
/**
 * Type for {@link HTTP_RESPONSE_BODY_SIZE} http.response.body.size
 */
type HTTP_RESPONSE_BODY_SIZE_TYPE = number;
/**
 * HTTP response headers, <key> being the normalized HTTP Header name (lowercase), the value being the header values. `http.response.header.<key>`
 *
 * Attribute Value Type: `Array<string>` {@link HTTP_RESPONSE_HEADER_KEY_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Has Dynamic Suffix: true
 *
 * @example "http.response.header.custom-header=['foo', 'bar']"
 */
declare const HTTP_RESPONSE_HEADER_KEY = "http.response.header.<key>";
/**
 * Type for {@link HTTP_RESPONSE_HEADER_KEY} http.response.header.<key>
 */
type HTTP_RESPONSE_HEADER_KEY_TYPE = Array<string>;
/**
 * The size of the message body sent to the recipient (in bytes) `http.response.header.content-length`
 *
 * Attribute Value Type: `string` {@link HTTP_RESPONSE_HEADER_CONTENT_LENGTH_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link HTTP_RESPONSE_CONTENT_LENGTH} `http.response_content_length`, {@link HTTP_RESPONSE_BODY_SIZE} `http.response.body.size`
 *
 * @example "http.response.header.custom-header=['foo', 'bar']"
 */
declare const HTTP_RESPONSE_HEADER_CONTENT_LENGTH = "http.response.header.content-length";
/**
 * Type for {@link HTTP_RESPONSE_HEADER_CONTENT_LENGTH} http.response.header.content-length
 */
type HTTP_RESPONSE_HEADER_CONTENT_LENGTH_TYPE = string;
/**
 * The transfer size of the response (in bytes). `http.response.size`
 *
 * Attribute Value Type: `number` {@link HTTP_RESPONSE_SIZE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link HTTP_RESPONSE_TRANSFER_SIZE} `http.response_transfer_size`
 *
 * @example 456
 */
declare const HTTP_RESPONSE_SIZE = "http.response.size";
/**
 * Type for {@link HTTP_RESPONSE_SIZE} http.response.size
 */
type HTTP_RESPONSE_SIZE_TYPE = number;
/**
 * The status code of the HTTP response. `http.response.status_code`
 *
 * Attribute Value Type: `number` {@link HTTP_RESPONSE_STATUS_CODE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link HTTP_STATUS_CODE} `http.status_code`
 *
 * @example 404
 */
declare const HTTP_RESPONSE_STATUS_CODE = "http.response.status_code";
/**
 * Type for {@link HTTP_RESPONSE_STATUS_CODE} http.response.status_code
 */
type HTTP_RESPONSE_STATUS_CODE_TYPE = number;
/**
 * The encoded body size of the response (in bytes). `http.response_content_length`
 *
 * Attribute Value Type: `number` {@link HTTP_RESPONSE_CONTENT_LENGTH_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link HTTP_RESPONSE_BODY_SIZE} `http.response.body.size`, {@link HTTP_RESPONSE_HEADER_CONTENT_LENGTH} `http.response.header.content-length`
 *
 * @deprecated Use {@link HTTP_RESPONSE_BODY_SIZE} (http.response.body.size) instead
 * @example 123
 */
declare const HTTP_RESPONSE_CONTENT_LENGTH = "http.response_content_length";
/**
 * Type for {@link HTTP_RESPONSE_CONTENT_LENGTH} http.response_content_length
 */
type HTTP_RESPONSE_CONTENT_LENGTH_TYPE = number;
/**
 * The transfer size of the response (in bytes). `http.response_transfer_size`
 *
 * Attribute Value Type: `number` {@link HTTP_RESPONSE_TRANSFER_SIZE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link HTTP_RESPONSE_SIZE} `http.response.size`
 *
 * @deprecated Use {@link HTTP_RESPONSE_SIZE} (http.response.size) instead
 * @example 456
 */
declare const HTTP_RESPONSE_TRANSFER_SIZE = "http.response_transfer_size";
/**
 * Type for {@link HTTP_RESPONSE_TRANSFER_SIZE} http.response_transfer_size
 */
type HTTP_RESPONSE_TRANSFER_SIZE_TYPE = number;
/**
 * The matched route, that is, the path template in the format used by the respective server framework. `http.route`
 *
 * Attribute Value Type: `string` {@link HTTP_ROUTE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link URL_TEMPLATE} `url.template`
 *
 * @example "/users/:id"
 */
declare const HTTP_ROUTE = "http.route";
/**
 * Type for {@link HTTP_ROUTE} http.route
 */
type HTTP_ROUTE_TYPE = string;
/**
 * The URI scheme component identifying the used protocol. `http.scheme`
 *
 * Attribute Value Type: `string` {@link HTTP_SCHEME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link URL_SCHEME} `url.scheme`
 *
 * @deprecated Use {@link URL_SCHEME} (url.scheme) instead
 * @example "https"
 */
declare const HTTP_SCHEME = "http.scheme";
/**
 * Type for {@link HTTP_SCHEME} http.scheme
 */
type HTTP_SCHEME_TYPE = string;
/**
 * The server domain name `http.server_name`
 *
 * Attribute Value Type: `string` {@link HTTP_SERVER_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link SERVER_ADDRESS} `server.address`, {@link NET_HOST_NAME} `net.host.name`, {@link HTTP_HOST} `http.host`
 *
 * @deprecated Use {@link SERVER_ADDRESS} (server.address) instead
 * @example "example.com"
 */
declare const HTTP_SERVER_NAME = "http.server_name";
/**
 * Type for {@link HTTP_SERVER_NAME} http.server_name
 */
type HTTP_SERVER_NAME_TYPE = string;
/**
 * The status code of the HTTP response. `http.status_code`
 *
 * Attribute Value Type: `number` {@link HTTP_STATUS_CODE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link HTTP_RESPONSE_STATUS_CODE} `http.response.status_code`
 *
 * @deprecated Use {@link HTTP_RESPONSE_STATUS_CODE} (http.response.status_code) instead
 * @example 404
 */
declare const HTTP_STATUS_CODE = "http.status_code";
/**
 * Type for {@link HTTP_STATUS_CODE} http.status_code
 */
type HTTP_STATUS_CODE_TYPE = number;
/**
 * The pathname and query string of the URL. `http.target`
 *
 * Attribute Value Type: `string` {@link HTTP_TARGET_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @deprecated Use {@link URL_PATH} (url.path) instead - This attribute is being deprecated in favor of url.path and url.query
 * @example "/test?foo=bar#buzz"
 */
declare const HTTP_TARGET = "http.target";
/**
 * Type for {@link HTTP_TARGET} http.target
 */
type HTTP_TARGET_TYPE = string;
/**
 * The URL of the resource that was fetched. `http.url`
 *
 * Attribute Value Type: `string` {@link HTTP_URL_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link URL_FULL} `url.full`, {@link URL} `url`
 *
 * @deprecated Use {@link URL_FULL} (url.full) instead
 * @example "https://example.com/test?foo=bar#buzz"
 */
declare const HTTP_URL = "http.url";
/**
 * Type for {@link HTTP_URL} http.url
 */
type HTTP_URL_TYPE = string;
/**
 * Value of the HTTP User-Agent header sent by the client. `http.user_agent`
 *
 * Attribute Value Type: `string` {@link HTTP_USER_AGENT_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link USER_AGENT_ORIGINAL} `user_agent.original`
 *
 * @deprecated Use {@link USER_AGENT_ORIGINAL} (user_agent.original) instead
 * @example "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1"
 */
declare const HTTP_USER_AGENT = "http.user_agent";
/**
 * Type for {@link HTTP_USER_AGENT} http.user_agent
 */
type HTTP_USER_AGENT_TYPE = string;
/**
 * A unique identifier for the span. `id`
 *
 * Attribute Value Type: `string` {@link ID_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "f47ac10b58cc4372a5670e02b2c3d479"
 */
declare const ID = "id";
/**
 * Type for {@link ID} id
 */
type ID_TYPE = string;
/**
 * Name of the garbage collector action. `jvm.gc.action`
 *
 * Attribute Value Type: `string` {@link JVM_GC_ACTION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "end of minor GC"
 */
declare const JVM_GC_ACTION = "jvm.gc.action";
/**
 * Type for {@link JVM_GC_ACTION} jvm.gc.action
 */
type JVM_GC_ACTION_TYPE = string;
/**
 * Name of the garbage collector. `jvm.gc.name`
 *
 * Attribute Value Type: `string` {@link JVM_GC_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "G1 Young Generation"
 */
declare const JVM_GC_NAME = "jvm.gc.name";
/**
 * Type for {@link JVM_GC_NAME} jvm.gc.name
 */
type JVM_GC_NAME_TYPE = string;
/**
 * Name of the memory pool. `jvm.memory.pool.name`
 *
 * Attribute Value Type: `string` {@link JVM_MEMORY_POOL_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "G1 Old Gen"
 */
declare const JVM_MEMORY_POOL_NAME = "jvm.memory.pool.name";
/**
 * Type for {@link JVM_MEMORY_POOL_NAME} jvm.memory.pool.name
 */
type JVM_MEMORY_POOL_NAME_TYPE = string;
/**
 * Name of the memory pool. `jvm.memory.type`
 *
 * Attribute Value Type: `string` {@link JVM_MEMORY_TYPE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "G1 Old Gen"
 */
declare const JVM_MEMORY_TYPE = "jvm.memory.type";
/**
 * Type for {@link JVM_MEMORY_TYPE} jvm.memory.type
 */
type JVM_MEMORY_TYPE_TYPE = string;
/**
 * Whether the thread is daemon or not. `jvm.thread.daemon`
 *
 * Attribute Value Type: `boolean` {@link JVM_THREAD_DAEMON_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * @example true
 */
declare const JVM_THREAD_DAEMON = "jvm.thread.daemon";
/**
 * Type for {@link JVM_THREAD_DAEMON} jvm.thread.daemon
 */
type JVM_THREAD_DAEMON_TYPE = boolean;
/**
 * State of the thread. `jvm.thread.state`
 *
 * Attribute Value Type: `string` {@link JVM_THREAD_STATE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "blocked"
 */
declare const JVM_THREAD_STATE = "jvm.thread.state";
/**
 * Type for {@link JVM_THREAD_STATE} jvm.thread.state
 */
type JVM_THREAD_STATE_TYPE = string;
/**
 * The dom element responsible for the largest contentful paint. `lcp.element`
 *
 * Attribute Value Type: `string` {@link LCP_ELEMENT_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "img"
 */
declare const LCP_ELEMENT = "lcp.element";
/**
 * Type for {@link LCP_ELEMENT} lcp.element
 */
type LCP_ELEMENT_TYPE = string;
/**
 * The id of the dom element responsible for the largest contentful paint. `lcp.id`
 *
 * Attribute Value Type: `string` {@link LCP_ID_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "#hero"
 */
declare const LCP_ID = "lcp.id";
/**
 * Type for {@link LCP_ID} lcp.id
 */
type LCP_ID_TYPE = string;
/**
 * The size of the largest contentful paint element. `lcp.size`
 *
 * Attribute Value Type: `number` {@link LCP_SIZE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 1234
 */
declare const LCP_SIZE = "lcp.size";
/**
 * Type for {@link LCP_SIZE} lcp.size
 */
type LCP_SIZE_TYPE = number;
/**
 * The url of the dom element responsible for the largest contentful paint. `lcp.url`
 *
 * Attribute Value Type: `string` {@link LCP_URL_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "https://example.com"
 */
declare const LCP_URL = "lcp.url";
/**
 * Type for {@link LCP_URL} lcp.url
 */
type LCP_URL_TYPE = string;
/**
 * The name of the logger that generated this event. `logger.name`
 *
 * Attribute Value Type: `string` {@link LOGGER_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "myLogger"
 */
declare const LOGGER_NAME = "logger.name";
/**
 * Type for {@link LOGGER_NAME} logger.name
 */
type LOGGER_NAME_TYPE = string;
/**
 * The message destination connection. `messaging.destination.connection`
 *
 * Attribute Value Type: `string` {@link MESSAGING_DESTINATION_CONNECTION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "BestTopic"
 */
declare const MESSAGING_DESTINATION_CONNECTION = "messaging.destination.connection";
/**
 * Type for {@link MESSAGING_DESTINATION_CONNECTION} messaging.destination.connection
 */
type MESSAGING_DESTINATION_CONNECTION_TYPE = string;
/**
 * The message destination name. `messaging.destination.name`
 *
 * Attribute Value Type: `string` {@link MESSAGING_DESTINATION_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "BestTopic"
 */
declare const MESSAGING_DESTINATION_NAME = "messaging.destination.name";
/**
 * Type for {@link MESSAGING_DESTINATION_NAME} messaging.destination.name
 */
type MESSAGING_DESTINATION_NAME_TYPE = string;
/**
 * The size of the message body in bytes. `messaging.message.body.size`
 *
 * Attribute Value Type: `number` {@link MESSAGING_MESSAGE_BODY_SIZE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * @example 839
 */
declare const MESSAGING_MESSAGE_BODY_SIZE = "messaging.message.body.size";
/**
 * Type for {@link MESSAGING_MESSAGE_BODY_SIZE} messaging.message.body.size
 */
type MESSAGING_MESSAGE_BODY_SIZE_TYPE = number;
/**
 * The size of the message body and metadata in bytes. `messaging.message.envelope.size`
 *
 * Attribute Value Type: `number` {@link MESSAGING_MESSAGE_ENVELOPE_SIZE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * @example 1045
 */
declare const MESSAGING_MESSAGE_ENVELOPE_SIZE = "messaging.message.envelope.size";
/**
 * Type for {@link MESSAGING_MESSAGE_ENVELOPE_SIZE} messaging.message.envelope.size
 */
type MESSAGING_MESSAGE_ENVELOPE_SIZE_TYPE = number;
/**
 * A value used by the messaging system as an identifier for the message, represented as a string. `messaging.message.id`
 *
 * Attribute Value Type: `string` {@link MESSAGING_MESSAGE_ID_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "f47ac10b58cc4372a5670e02b2c3d479"
 */
declare const MESSAGING_MESSAGE_ID = "messaging.message.id";
/**
 * Type for {@link MESSAGING_MESSAGE_ID} messaging.message.id
 */
type MESSAGING_MESSAGE_ID_TYPE = string;
/**
 * The latency between when the message was published and received. `messaging.message.receive.latency`
 *
 * Attribute Value Type: `number` {@link MESSAGING_MESSAGE_RECEIVE_LATENCY_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 1732847252
 */
declare const MESSAGING_MESSAGE_RECEIVE_LATENCY = "messaging.message.receive.latency";
/**
 * Type for {@link MESSAGING_MESSAGE_RECEIVE_LATENCY} messaging.message.receive.latency
 */
type MESSAGING_MESSAGE_RECEIVE_LATENCY_TYPE = number;
/**
 * The amount of attempts to send the message. `messaging.message.retry.count`
 *
 * Attribute Value Type: `number` {@link MESSAGING_MESSAGE_RETRY_COUNT_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 2
 */
declare const MESSAGING_MESSAGE_RETRY_COUNT = "messaging.message.retry.count";
/**
 * Type for {@link MESSAGING_MESSAGE_RETRY_COUNT} messaging.message.retry.count
 */
type MESSAGING_MESSAGE_RETRY_COUNT_TYPE = number;
/**
 * A string identifying the type of the messaging operation `messaging.operation.type`
 *
 * Attribute Value Type: `string` {@link MESSAGING_OPERATION_TYPE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "create"
 */
declare const MESSAGING_OPERATION_TYPE = "messaging.operation.type";
/**
 * Type for {@link MESSAGING_OPERATION_TYPE} messaging.operation.type
 */
type MESSAGING_OPERATION_TYPE_TYPE = string;
/**
 * The messaging system as identified by the client instrumentation. `messaging.system`
 *
 * Attribute Value Type: `string` {@link MESSAGING_SYSTEM_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "activemq"
 */
declare const MESSAGING_SYSTEM = "messaging.system";
/**
 * Type for {@link MESSAGING_SYSTEM} messaging.system
 */
type MESSAGING_SYSTEM_TYPE = string;
/**
 * The HTTP method used. `method`
 *
 * Attribute Value Type: `string` {@link METHOD_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link HTTP_REQUEST_METHOD} `http.request.method`
 *
 * @deprecated Use {@link HTTP_REQUEST_METHOD} (http.request.method) instead
 * @example "GET"
 */
declare const METHOD = "method";
/**
 * Type for {@link METHOD} method
 */
type METHOD_TYPE = string;
/**
 * The type of navigation done by a client-side router. `navigation.type`
 *
 * Attribute Value Type: `string` {@link NAVIGATION_TYPE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "router.push"
 */
declare const NAVIGATION_TYPE = "navigation.type";
/**
 * Type for {@link NAVIGATION_TYPE} navigation.type
 */
type NAVIGATION_TYPE_TYPE = string;
/**
 * The elapsed number of milliseconds between the start of the resource fetch and when it was completed or aborted by the user agent. `nel.elapsed_time`
 *
 * Attribute Value Type: `number` {@link NEL_ELAPSED_TIME_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 100
 */
declare const NEL_ELAPSED_TIME = "nel.elapsed_time";
/**
 * Type for {@link NEL_ELAPSED_TIME} nel.elapsed_time
 */
type NEL_ELAPSED_TIME_TYPE = number;
/**
 * If request failed, the phase of its network error. If request succeeded, "application". `nel.phase`
 *
 * Attribute Value Type: `string` {@link NEL_PHASE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "application"
 */
declare const NEL_PHASE = "nel.phase";
/**
 * Type for {@link NEL_PHASE} nel.phase
 */
type NEL_PHASE_TYPE = string;
/**
 * request's referrer, as determined by the referrer policy associated with its client. `nel.referrer`
 *
 * Attribute Value Type: `string` {@link NEL_REFERRER_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "https://example.com/foo?bar=baz"
 */
declare const NEL_REFERRER = "nel.referrer";
/**
 * Type for {@link NEL_REFERRER} nel.referrer
 */
type NEL_REFERRER_TYPE = string;
/**
 * The sampling function used to determine if the request should be sampled. `nel.sampling_function`
 *
 * Attribute Value Type: `number` {@link NEL_SAMPLING_FUNCTION_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 0.5
 */
declare const NEL_SAMPLING_FUNCTION = "nel.sampling_function";
/**
 * Type for {@link NEL_SAMPLING_FUNCTION} nel.sampling_function
 */
type NEL_SAMPLING_FUNCTION_TYPE = number;
/**
 * If request failed, the type of its network error. If request succeeded, "ok". `nel.type`
 *
 * Attribute Value Type: `string` {@link NEL_TYPE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "dns.unreachable"
 */
declare const NEL_TYPE = "nel.type";
/**
 * Type for {@link NEL_TYPE} nel.type
 */
type NEL_TYPE_TYPE = string;
/**
 * Local address of the network connection - IP address or Unix domain socket name. `net.host.ip`
 *
 * Attribute Value Type: `string` {@link NET_HOST_IP_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link NETWORK_LOCAL_ADDRESS} `network.local.address`, {@link NET_SOCK_HOST_ADDR} `net.sock.host.addr`
 *
 * @deprecated Use {@link NETWORK_LOCAL_ADDRESS} (network.local.address) instead
 * @example "192.168.0.1"
 */
declare const NET_HOST_IP = "net.host.ip";
/**
 * Type for {@link NET_HOST_IP} net.host.ip
 */
type NET_HOST_IP_TYPE = string;
/**
 * Server domain name if available without reverse DNS lookup; otherwise, IP address or Unix domain socket name. `net.host.name`
 *
 * Attribute Value Type: `string` {@link NET_HOST_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link SERVER_ADDRESS} `server.address`, {@link HTTP_SERVER_NAME} `http.server_name`, {@link HTTP_HOST} `http.host`
 *
 * @deprecated Use {@link SERVER_ADDRESS} (server.address) instead
 * @example "example.com"
 */
declare const NET_HOST_NAME = "net.host.name";
/**
 * Type for {@link NET_HOST_NAME} net.host.name
 */
type NET_HOST_NAME_TYPE = string;
/**
 * Server port number. `net.host.port`
 *
 * Attribute Value Type: `number` {@link NET_HOST_PORT_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link SERVER_PORT} `server.port`
 *
 * @deprecated Use {@link SERVER_PORT} (server.port) instead
 * @example 1337
 */
declare const NET_HOST_PORT = "net.host.port";
/**
 * Type for {@link NET_HOST_PORT} net.host.port
 */
type NET_HOST_PORT_TYPE = number;
/**
 * Peer address of the network connection - IP address or Unix domain socket name. `net.peer.ip`
 *
 * Attribute Value Type: `string` {@link NET_PEER_IP_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link NETWORK_PEER_ADDRESS} `network.peer.address`, {@link NET_SOCK_PEER_ADDR} `net.sock.peer.addr`
 *
 * @deprecated Use {@link NETWORK_PEER_ADDRESS} (network.peer.address) instead
 * @example "192.168.0.1"
 */
declare const NET_PEER_IP = "net.peer.ip";
/**
 * Type for {@link NET_PEER_IP} net.peer.ip
 */
type NET_PEER_IP_TYPE = string;
/**
 * Server domain name if available without reverse DNS lookup; otherwise, IP address or Unix domain socket name. `net.peer.name`
 *
 * Attribute Value Type: `string` {@link NET_PEER_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @deprecated Use {@link SERVER_ADDRESS} (server.address) instead - Deprecated, use server.address on client spans and client.address on server spans.
 * @example "example.com"
 */
declare const NET_PEER_NAME = "net.peer.name";
/**
 * Type for {@link NET_PEER_NAME} net.peer.name
 */
type NET_PEER_NAME_TYPE = string;
/**
 * Peer port number. `net.peer.port`
 *
 * Attribute Value Type: `number` {@link NET_PEER_PORT_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * @deprecated Use {@link SERVER_PORT} (server.port) instead - Deprecated, use server.port on client spans and client.port on server spans.
 * @example 1337
 */
declare const NET_PEER_PORT = "net.peer.port";
/**
 * Type for {@link NET_PEER_PORT} net.peer.port
 */
type NET_PEER_PORT_TYPE = number;
/**
 * OSI application layer or non-OSI equivalent. `net.protocol.name`
 *
 * Attribute Value Type: `string` {@link NET_PROTOCOL_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link NETWORK_PROTOCOL_NAME} `network.protocol.name`
 *
 * @deprecated Use {@link NETWORK_PROTOCOL_NAME} (network.protocol.name) instead
 * @example "http"
 */
declare const NET_PROTOCOL_NAME = "net.protocol.name";
/**
 * Type for {@link NET_PROTOCOL_NAME} net.protocol.name
 */
type NET_PROTOCOL_NAME_TYPE = string;
/**
 * The actual version of the protocol used for network communication. `net.protocol.version`
 *
 * Attribute Value Type: `string` {@link NET_PROTOCOL_VERSION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link NETWORK_PROTOCOL_VERSION} `network.protocol.version`, {@link HTTP_FLAVOR} `http.flavor`
 *
 * @deprecated Use {@link NETWORK_PROTOCOL_VERSION} (network.protocol.version) instead
 * @example "1.1"
 */
declare const NET_PROTOCOL_VERSION = "net.protocol.version";
/**
 * Type for {@link NET_PROTOCOL_VERSION} net.protocol.version
 */
type NET_PROTOCOL_VERSION_TYPE = string;
/**
 * OSI transport and network layer `net.sock.family`
 *
 * Attribute Value Type: `string` {@link NET_SOCK_FAMILY_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @deprecated Use {@link NETWORK_TRANSPORT} (network.transport) instead - Deprecated, use network.transport and network.type.
 * @example "inet"
 */
declare const NET_SOCK_FAMILY = "net.sock.family";
/**
 * Type for {@link NET_SOCK_FAMILY} net.sock.family
 */
type NET_SOCK_FAMILY_TYPE = string;
/**
 * Local address of the network connection mapping to Unix domain socket name. `net.sock.host.addr`
 *
 * Attribute Value Type: `string` {@link NET_SOCK_HOST_ADDR_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link NETWORK_LOCAL_ADDRESS} `network.local.address`, {@link NET_HOST_IP} `net.host.ip`
 *
 * @deprecated Use {@link NETWORK_LOCAL_ADDRESS} (network.local.address) instead
 * @example "/var/my.sock"
 */
declare const NET_SOCK_HOST_ADDR = "net.sock.host.addr";
/**
 * Type for {@link NET_SOCK_HOST_ADDR} net.sock.host.addr
 */
type NET_SOCK_HOST_ADDR_TYPE = string;
/**
 * Local port number of the network connection. `net.sock.host.port`
 *
 * Attribute Value Type: `number` {@link NET_SOCK_HOST_PORT_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link NETWORK_LOCAL_PORT} `network.local.port`
 *
 * @deprecated Use {@link NETWORK_LOCAL_PORT} (network.local.port) instead
 * @example 8080
 */
declare const NET_SOCK_HOST_PORT = "net.sock.host.port";
/**
 * Type for {@link NET_SOCK_HOST_PORT} net.sock.host.port
 */
type NET_SOCK_HOST_PORT_TYPE = number;
/**
 * Peer address of the network connection - IP address `net.sock.peer.addr`
 *
 * Attribute Value Type: `string` {@link NET_SOCK_PEER_ADDR_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link NETWORK_PEER_ADDRESS} `network.peer.address`, {@link NET_PEER_IP} `net.peer.ip`
 *
 * @deprecated Use {@link NETWORK_PEER_ADDRESS} (network.peer.address) instead
 * @example "192.168.0.1"
 */
declare const NET_SOCK_PEER_ADDR = "net.sock.peer.addr";
/**
 * Type for {@link NET_SOCK_PEER_ADDR} net.sock.peer.addr
 */
type NET_SOCK_PEER_ADDR_TYPE = string;
/**
 * Peer address of the network connection - Unix domain socket name `net.sock.peer.name`
 *
 * Attribute Value Type: `string` {@link NET_SOCK_PEER_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @deprecated  - Deprecated from OTEL, no replacement at this time
 * @example "/var/my.sock"
 */
declare const NET_SOCK_PEER_NAME = "net.sock.peer.name";
/**
 * Type for {@link NET_SOCK_PEER_NAME} net.sock.peer.name
 */
type NET_SOCK_PEER_NAME_TYPE = string;
/**
 * Peer port number of the network connection. `net.sock.peer.port`
 *
 * Attribute Value Type: `number` {@link NET_SOCK_PEER_PORT_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * @deprecated Use {@link NETWORK_PEER_PORT} (network.peer.port) instead
 * @example 8080
 */
declare const NET_SOCK_PEER_PORT = "net.sock.peer.port";
/**
 * Type for {@link NET_SOCK_PEER_PORT} net.sock.peer.port
 */
type NET_SOCK_PEER_PORT_TYPE = number;
/**
 * OSI transport layer or inter-process communication method. `net.transport`
 *
 * Attribute Value Type: `string` {@link NET_TRANSPORT_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link NETWORK_TRANSPORT} `network.transport`
 *
 * @deprecated Use {@link NETWORK_TRANSPORT} (network.transport) instead
 * @example "tcp"
 */
declare const NET_TRANSPORT = "net.transport";
/**
 * Type for {@link NET_TRANSPORT} net.transport
 */
type NET_TRANSPORT_TYPE = string;
/**
 * Local address of the network connection - IP address or Unix domain socket name. `network.local.address`
 *
 * Attribute Value Type: `string` {@link NETWORK_LOCAL_ADDRESS_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link NET_HOST_IP} `net.host.ip`, {@link NET_SOCK_HOST_ADDR} `net.sock.host.addr`
 *
 * @example "10.1.2.80"
 */
declare const NETWORK_LOCAL_ADDRESS = "network.local.address";
/**
 * Type for {@link NETWORK_LOCAL_ADDRESS} network.local.address
 */
type NETWORK_LOCAL_ADDRESS_TYPE = string;
/**
 * Local port number of the network connection. `network.local.port`
 *
 * Attribute Value Type: `number` {@link NETWORK_LOCAL_PORT_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link NET_SOCK_HOST_PORT} `net.sock.host.port`
 *
 * @example 65400
 */
declare const NETWORK_LOCAL_PORT = "network.local.port";
/**
 * Type for {@link NETWORK_LOCAL_PORT} network.local.port
 */
type NETWORK_LOCAL_PORT_TYPE = number;
/**
 * Peer address of the network connection - IP address or Unix domain socket name. `network.peer.address`
 *
 * Attribute Value Type: `string` {@link NETWORK_PEER_ADDRESS_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link NET_PEER_IP} `net.peer.ip`, {@link NET_SOCK_PEER_ADDR} `net.sock.peer.addr`
 *
 * @example "10.1.2.80"
 */
declare const NETWORK_PEER_ADDRESS = "network.peer.address";
/**
 * Type for {@link NETWORK_PEER_ADDRESS} network.peer.address
 */
type NETWORK_PEER_ADDRESS_TYPE = string;
/**
 * Peer port number of the network connection. `network.peer.port`
 *
 * Attribute Value Type: `number` {@link NETWORK_PEER_PORT_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * @example 65400
 */
declare const NETWORK_PEER_PORT = "network.peer.port";
/**
 * Type for {@link NETWORK_PEER_PORT} network.peer.port
 */
type NETWORK_PEER_PORT_TYPE = number;
/**
 * OSI application layer or non-OSI equivalent. `network.protocol.name`
 *
 * Attribute Value Type: `string` {@link NETWORK_PROTOCOL_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link NET_PROTOCOL_NAME} `net.protocol.name`
 *
 * @example "http"
 */
declare const NETWORK_PROTOCOL_NAME = "network.protocol.name";
/**
 * Type for {@link NETWORK_PROTOCOL_NAME} network.protocol.name
 */
type NETWORK_PROTOCOL_NAME_TYPE = string;
/**
 * The actual version of the protocol used for network communication. `network.protocol.version`
 *
 * Attribute Value Type: `string` {@link NETWORK_PROTOCOL_VERSION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link HTTP_FLAVOR} `http.flavor`, {@link NET_PROTOCOL_VERSION} `net.protocol.version`
 *
 * @example "1.1"
 */
declare const NETWORK_PROTOCOL_VERSION = "network.protocol.version";
/**
 * Type for {@link NETWORK_PROTOCOL_VERSION} network.protocol.version
 */
type NETWORK_PROTOCOL_VERSION_TYPE = string;
/**
 * OSI transport layer or inter-process communication method. `network.transport`
 *
 * Attribute Value Type: `string` {@link NETWORK_TRANSPORT_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link NET_TRANSPORT} `net.transport`
 *
 * @example "tcp"
 */
declare const NETWORK_TRANSPORT = "network.transport";
/**
 * Type for {@link NETWORK_TRANSPORT} network.transport
 */
type NETWORK_TRANSPORT_TYPE = string;
/**
 * OSI network layer or non-OSI equivalent. `network.type`
 *
 * Attribute Value Type: `string` {@link NETWORK_TYPE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "ipv4"
 */
declare const NETWORK_TYPE = "network.type";
/**
 * Type for {@link NETWORK_TYPE} network.type
 */
type NETWORK_TYPE_TYPE = string;
/**
 * The build ID of the operating system. `os.build_id`
 *
 * Attribute Value Type: `string` {@link OS_BUILD_ID_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "1234567890"
 */
declare const OS_BUILD_ID = "os.build_id";
/**
 * Type for {@link OS_BUILD_ID} os.build_id
 */
type OS_BUILD_ID_TYPE = string;
/**
 * Human readable (not intended to be parsed) OS version information, like e.g. reported by ver or lsb_release -a commands. `os.description`
 *
 * Attribute Value Type: `string` {@link OS_DESCRIPTION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "Ubuntu 18.04.1 LTS"
 */
declare const OS_DESCRIPTION = "os.description";
/**
 * Type for {@link OS_DESCRIPTION} os.description
 */
type OS_DESCRIPTION_TYPE = string;
/**
 * Human readable operating system name. `os.name`
 *
 * Attribute Value Type: `string` {@link OS_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "Ubuntu"
 */
declare const OS_NAME = "os.name";
/**
 * Type for {@link OS_NAME} os.name
 */
type OS_NAME_TYPE = string;
/**
 * The operating system type. `os.type`
 *
 * Attribute Value Type: `string` {@link OS_TYPE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "linux"
 */
declare const OS_TYPE = "os.type";
/**
 * Type for {@link OS_TYPE} os.type
 */
type OS_TYPE_TYPE = string;
/**
 * The version of the operating system. `os.version`
 *
 * Attribute Value Type: `string` {@link OS_VERSION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "18.04.2"
 */
declare const OS_VERSION = "os.version";
/**
 * Type for {@link OS_VERSION} os.version
 */
type OS_VERSION_TYPE = string;
/**
 * The name of the instrumentation scope - (InstrumentationScope.Name in OTLP). `otel.scope.name`
 *
 * Attribute Value Type: `string` {@link OTEL_SCOPE_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "io.opentelemetry.contrib.mongodb"
 */
declare const OTEL_SCOPE_NAME = "otel.scope.name";
/**
 * Type for {@link OTEL_SCOPE_NAME} otel.scope.name
 */
type OTEL_SCOPE_NAME_TYPE = string;
/**
 * The version of the instrumentation scope - (InstrumentationScope.Version in OTLP). `otel.scope.version`
 *
 * Attribute Value Type: `string` {@link OTEL_SCOPE_VERSION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "2.4.5"
 */
declare const OTEL_SCOPE_VERSION = "otel.scope.version";
/**
 * Type for {@link OTEL_SCOPE_VERSION} otel.scope.version
 */
type OTEL_SCOPE_VERSION_TYPE = string;
/**
 * Name of the code, either “OK” or “ERROR”. MUST NOT be set if the status code is UNSET. `otel.status_code`
 *
 * Attribute Value Type: `string` {@link OTEL_STATUS_CODE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "OK"
 */
declare const OTEL_STATUS_CODE = "otel.status_code";
/**
 * Type for {@link OTEL_STATUS_CODE} otel.status_code
 */
type OTEL_STATUS_CODE_TYPE = string;
/**
 * Description of the Status if it has a value, otherwise not set. `otel.status_description`
 *
 * Attribute Value Type: `string` {@link OTEL_STATUS_DESCRIPTION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "resource not found"
 */
declare const OTEL_STATUS_DESCRIPTION = "otel.status_description";
/**
 * Type for {@link OTEL_STATUS_DESCRIPTION} otel.status_description
 */
type OTEL_STATUS_DESCRIPTION_TYPE = string;
/**
 * Decoded parameters extracted from a URL path. Usually added by client-side routing frameworks like vue-router. `params.<key>`
 *
 * Attribute Value Type: `string` {@link PARAMS_KEY_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Has Dynamic Suffix: true
 *
 * Aliases: {@link URL_PATH_PARAMETER_KEY} `url.path.parameter.<key>`
 *
 * @example "params.id='123'"
 */
declare const PARAMS_KEY = "params.<key>";
/**
 * Type for {@link PARAMS_KEY} params.<key>
 */
type PARAMS_KEY_TYPE = string;
/**
 * Also used by mobile SDKs to indicate the previous route in the application. `previous_route`
 *
 * Attribute Value Type: `string` {@link PREVIOUS_ROUTE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "HomeScreen"
 */
declare const PREVIOUS_ROUTE = "previous_route";
/**
 * Type for {@link PREVIOUS_ROUTE} previous_route
 */
type PREVIOUS_ROUTE_TYPE = string;
/**
 * The name of the executable that started the process. `process.executable.name`
 *
 * Attribute Value Type: `string` {@link PROCESS_EXECUTABLE_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "getsentry"
 */
declare const PROCESS_EXECUTABLE_NAME = "process.executable.name";
/**
 * Type for {@link PROCESS_EXECUTABLE_NAME} process.executable.name
 */
type PROCESS_EXECUTABLE_NAME_TYPE = string;
/**
 * The process ID of the running process. `process.pid`
 *
 * Attribute Value Type: `number` {@link PROCESS_PID_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * @example 12345
 */
declare const PROCESS_PID = "process.pid";
/**
 * Type for {@link PROCESS_PID} process.pid
 */
type PROCESS_PID_TYPE = number;
/**
 * An additional description about the runtime of the process, for example a specific vendor customization of the runtime environment. Equivalent to `raw_description` in the Sentry runtime context. `process.runtime.description`
 *
 * Attribute Value Type: `string` {@link PROCESS_RUNTIME_DESCRIPTION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "Eclipse OpenJ9 VM openj9-0.21.0"
 */
declare const PROCESS_RUNTIME_DESCRIPTION = "process.runtime.description";
/**
 * Type for {@link PROCESS_RUNTIME_DESCRIPTION} process.runtime.description
 */
type PROCESS_RUNTIME_DESCRIPTION_TYPE = string;
/**
 * The name of the runtime. Equivalent to `name` in the Sentry runtime context. `process.runtime.name`
 *
 * Attribute Value Type: `string` {@link PROCESS_RUNTIME_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "node"
 */
declare const PROCESS_RUNTIME_NAME = "process.runtime.name";
/**
 * Type for {@link PROCESS_RUNTIME_NAME} process.runtime.name
 */
type PROCESS_RUNTIME_NAME_TYPE = string;
/**
 * The version of the runtime of this process, as returned by the runtime without modification. Equivalent to `version` in the Sentry runtime context. `process.runtime.version`
 *
 * Attribute Value Type: `string` {@link PROCESS_RUNTIME_VERSION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "18.04.2"
 */
declare const PROCESS_RUNTIME_VERSION = "process.runtime.version";
/**
 * Type for {@link PROCESS_RUNTIME_VERSION} process.runtime.version
 */
type PROCESS_RUNTIME_VERSION_TYPE = string;
/**
 * The id of the sentry profile. `profile_id`
 *
 * Attribute Value Type: `string` {@link PROFILE_ID_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link SENTRY_PROFILE_ID} `sentry.profile_id`
 *
 * @deprecated Use {@link SENTRY_PROFILE_ID} (sentry.profile_id) instead
 * @example "123e4567e89b12d3a456426614174000"
 */
declare const PROFILE_ID = "profile_id";
/**
 * Type for {@link PROFILE_ID} profile_id
 */
type PROFILE_ID_TYPE = string;
/**
 * An item in a query string. Usually added by client-side routing frameworks like vue-router. `query.<key>`
 *
 * Attribute Value Type: `string` {@link QUERY_KEY_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Has Dynamic Suffix: true
 *
 * @deprecated Use {@link URL_QUERY} (url.query) instead - Instead of sending items individually in query.<key>, they should be sent all together with url.query.
 * @example "query.id='123'"
 */
declare const QUERY_KEY = "query.<key>";
/**
 * Type for {@link QUERY_KEY} query.<key>
 */
type QUERY_KEY_TYPE = string;
/**
 * The sentry release. `release`
 *
 * Attribute Value Type: `string` {@link RELEASE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link SENTRY_RELEASE} `sentry.release`
 *
 * @deprecated Use {@link SENTRY_RELEASE} (sentry.release) instead
 * @example "production"
 */
declare const RELEASE = "release";
/**
 * Type for {@link RELEASE} release
 */
type RELEASE_TYPE = string;
/**
 * Remix form data, <key> being the form data key, the value being the form data value. `remix.action_form_data.<key>`
 *
 * Attribute Value Type: `string` {@link REMIX_ACTION_FORM_DATA_KEY_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Has Dynamic Suffix: true
 *
 * @example "http.response.header.text='test'"
 */
declare const REMIX_ACTION_FORM_DATA_KEY = "remix.action_form_data.<key>";
/**
 * Type for {@link REMIX_ACTION_FORM_DATA_KEY} remix.action_form_data.<key>
 */
type REMIX_ACTION_FORM_DATA_KEY_TYPE = string;
/**
 * The id of the sentry replay. `replay_id`
 *
 * Attribute Value Type: `string` {@link REPLAY_ID_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link SENTRY_REPLAY_ID} `sentry.replay_id`
 *
 * @deprecated Use {@link SENTRY_REPLAY_ID} (sentry.replay_id) instead
 * @example "123e4567e89b12d3a456426614174000"
 */
declare const REPLAY_ID = "replay_id";
/**
 * Type for {@link REPLAY_ID} replay_id
 */
type REPLAY_ID_TYPE = string;
/**
 * The render blocking status of the resource. `resource.render_blocking_status`
 *
 * Attribute Value Type: `string` {@link RESOURCE_RENDER_BLOCKING_STATUS_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "non-blocking"
 */
declare const RESOURCE_RENDER_BLOCKING_STATUS = "resource.render_blocking_status";
/**
 * Type for {@link RESOURCE_RENDER_BLOCKING_STATUS} resource.render_blocking_status
 */
type RESOURCE_RENDER_BLOCKING_STATUS_TYPE = string;
/**
 * The matched route, that is, the path template in the format used by the respective server framework. Also used by mobile SDKs to indicate the current route in the application. `route`
 *
 * Attribute Value Type: `string` {@link ROUTE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link HTTP_ROUTE} `http.route`
 *
 * @deprecated Use {@link HTTP_ROUTE} (http.route) instead
 * @example "App\\Controller::indexAction"
 */
declare const ROUTE = "route";
/**
 * Type for {@link ROUTE} route
 */
type ROUTE_TYPE = string;
/**
 * The numeric status code of the gRPC request. `rpc.grpc.status_code`
 *
 * Attribute Value Type: `number` {@link RPC_GRPC_STATUS_CODE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * @example 2
 */
declare const RPC_GRPC_STATUS_CODE = "rpc.grpc.status_code";
/**
 * Type for {@link RPC_GRPC_STATUS_CODE} rpc.grpc.status_code
 */
type RPC_GRPC_STATUS_CODE_TYPE = number;
/**
 * The full (logical) name of the service being called, including its package name, if applicable. `rpc.service`
 *
 * Attribute Value Type: `string` {@link RPC_SERVICE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "myService.BestService"
 */
declare const RPC_SERVICE = "rpc.service";
/**
 * Type for {@link RPC_SERVICE} rpc.service
 */
type RPC_SERVICE_TYPE = string;
/**
 * The environment from the dynamic sampling context. `sentry._internal.dsc.environment`
 *
 * Attribute Value Type: `string` {@link SENTRY_INTERNAL_DSC_ENVIRONMENT_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "prod"
 */
declare const SENTRY_INTERNAL_DSC_ENVIRONMENT = "sentry._internal.dsc.environment";
/**
 * Type for {@link SENTRY_INTERNAL_DSC_ENVIRONMENT} sentry._internal.dsc.environment
 */
type SENTRY_INTERNAL_DSC_ENVIRONMENT_TYPE = string;
/**
 * The organization ID from the dynamic sampling context. `sentry._internal.dsc.org_id`
 *
 * Attribute Value Type: `string` {@link SENTRY_INTERNAL_DSC_ORG_ID_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "1"
 */
declare const SENTRY_INTERNAL_DSC_ORG_ID = "sentry._internal.dsc.org_id";
/**
 * Type for {@link SENTRY_INTERNAL_DSC_ORG_ID} sentry._internal.dsc.org_id
 */
type SENTRY_INTERNAL_DSC_ORG_ID_TYPE = string;
/**
 * The public key from the dynamic sampling context. `sentry._internal.dsc.public_key`
 *
 * Attribute Value Type: `string` {@link SENTRY_INTERNAL_DSC_PUBLIC_KEY_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "c51734c603c4430eb57cb0a5728a479d"
 */
declare const SENTRY_INTERNAL_DSC_PUBLIC_KEY = "sentry._internal.dsc.public_key";
/**
 * Type for {@link SENTRY_INTERNAL_DSC_PUBLIC_KEY} sentry._internal.dsc.public_key
 */
type SENTRY_INTERNAL_DSC_PUBLIC_KEY_TYPE = string;
/**
 * The release identifier from the dynamic sampling context. `sentry._internal.dsc.release`
 *
 * Attribute Value Type: `string` {@link SENTRY_INTERNAL_DSC_RELEASE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "frontend@e8211be71b214afab5b85de4b4c54be3714952bb"
 */
declare const SENTRY_INTERNAL_DSC_RELEASE = "sentry._internal.dsc.release";
/**
 * Type for {@link SENTRY_INTERNAL_DSC_RELEASE} sentry._internal.dsc.release
 */
type SENTRY_INTERNAL_DSC_RELEASE_TYPE = string;
/**
 * The random sampling value from the dynamic sampling context. `sentry._internal.dsc.sample_rand`
 *
 * Attribute Value Type: `string` {@link SENTRY_INTERNAL_DSC_SAMPLE_RAND_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "0.8286147972820134"
 */
declare const SENTRY_INTERNAL_DSC_SAMPLE_RAND = "sentry._internal.dsc.sample_rand";
/**
 * Type for {@link SENTRY_INTERNAL_DSC_SAMPLE_RAND} sentry._internal.dsc.sample_rand
 */
type SENTRY_INTERNAL_DSC_SAMPLE_RAND_TYPE = string;
/**
 * The sample rate from the dynamic sampling context. `sentry._internal.dsc.sample_rate`
 *
 * Attribute Value Type: `string` {@link SENTRY_INTERNAL_DSC_SAMPLE_RATE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "1.0"
 */
declare const SENTRY_INTERNAL_DSC_SAMPLE_RATE = "sentry._internal.dsc.sample_rate";
/**
 * Type for {@link SENTRY_INTERNAL_DSC_SAMPLE_RATE} sentry._internal.dsc.sample_rate
 */
type SENTRY_INTERNAL_DSC_SAMPLE_RATE_TYPE = string;
/**
 * Whether the event was sampled according to the dynamic sampling context. `sentry._internal.dsc.sampled`
 *
 * Attribute Value Type: `boolean` {@link SENTRY_INTERNAL_DSC_SAMPLED_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example true
 */
declare const SENTRY_INTERNAL_DSC_SAMPLED = "sentry._internal.dsc.sampled";
/**
 * Type for {@link SENTRY_INTERNAL_DSC_SAMPLED} sentry._internal.dsc.sampled
 */
type SENTRY_INTERNAL_DSC_SAMPLED_TYPE = boolean;
/**
 * The trace ID from the dynamic sampling context. `sentry._internal.dsc.trace_id`
 *
 * Attribute Value Type: `string` {@link SENTRY_INTERNAL_DSC_TRACE_ID_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "047372980460430cbc78d9779df33a46"
 */
declare const SENTRY_INTERNAL_DSC_TRACE_ID = "sentry._internal.dsc.trace_id";
/**
 * Type for {@link SENTRY_INTERNAL_DSC_TRACE_ID} sentry._internal.dsc.trace_id
 */
type SENTRY_INTERNAL_DSC_TRACE_ID_TYPE = string;
/**
 * The transaction name from the dynamic sampling context. `sentry._internal.dsc.transaction`
 *
 * Attribute Value Type: `string` {@link SENTRY_INTERNAL_DSC_TRANSACTION_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "/issues/errors-outages/"
 */
declare const SENTRY_INTERNAL_DSC_TRANSACTION = "sentry._internal.dsc.transaction";
/**
 * Type for {@link SENTRY_INTERNAL_DSC_TRANSACTION} sentry._internal.dsc.transaction
 */
type SENTRY_INTERNAL_DSC_TRANSACTION_TYPE = string;
/**
 * The timestamp at which an envelope was received by Relay, in nanoseconds. `sentry._internal.observed_timestamp_nanos`
 *
 * Attribute Value Type: `string` {@link SENTRY_INTERNAL_OBSERVED_TIMESTAMP_NANOS_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link SENTRY_OBSERVED_TIMESTAMP_NANOS} `sentry.observed_timestamp_nanos`
 *
 * @example "1544712660300000000"
 */
declare const SENTRY_INTERNAL_OBSERVED_TIMESTAMP_NANOS = "sentry._internal.observed_timestamp_nanos";
/**
 * Type for {@link SENTRY_INTERNAL_OBSERVED_TIMESTAMP_NANOS} sentry._internal.observed_timestamp_nanos
 */
type SENTRY_INTERNAL_OBSERVED_TIMESTAMP_NANOS_TYPE = string;
/**
 * True if any of the spans in the segment contain gen_ai attributes. This attribute is only set on the main segment span. `sentry._internal.segment.contains_gen_ai_spans`
 *
 * Attribute Value Type: `boolean` {@link SENTRY_INTERNAL_SEGMENT_CONTAINS_GEN_AI_SPANS_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example true
 */
declare const SENTRY_INTERNAL_SEGMENT_CONTAINS_GEN_AI_SPANS = "sentry._internal.segment.contains_gen_ai_spans";
/**
 * Type for {@link SENTRY_INTERNAL_SEGMENT_CONTAINS_GEN_AI_SPANS} sentry._internal.segment.contains_gen_ai_spans
 */
type SENTRY_INTERNAL_SEGMENT_CONTAINS_GEN_AI_SPANS_TYPE = boolean;
/**
 * The name of the browser. `sentry.browser.name`
 *
 * Attribute Value Type: `string` {@link SENTRY_BROWSER_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link BROWSER_NAME} `browser.name`
 *
 * @deprecated Use {@link BROWSER_NAME} (browser.name) instead
 * @example "Chrome"
 */
declare const SENTRY_BROWSER_NAME = "sentry.browser.name";
/**
 * Type for {@link SENTRY_BROWSER_NAME} sentry.browser.name
 */
type SENTRY_BROWSER_NAME_TYPE = string;
/**
 * The version of the browser. `sentry.browser.version`
 *
 * Attribute Value Type: `string` {@link SENTRY_BROWSER_VERSION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link BROWSER_VERSION} `browser.version`
 *
 * @deprecated Use {@link BROWSER_VERSION} (browser.version) instead
 * @example "120.0.6099.130"
 */
declare const SENTRY_BROWSER_VERSION = "sentry.browser.version";
/**
 * Type for {@link SENTRY_BROWSER_VERSION} sentry.browser.version
 */
type SENTRY_BROWSER_VERSION_TYPE = string;
/**
 * The reason why a span ended early. `sentry.cancellation_reason`
 *
 * Attribute Value Type: `string` {@link SENTRY_CANCELLATION_REASON_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "document.hidden"
 */
declare const SENTRY_CANCELLATION_REASON = "sentry.cancellation_reason";
/**
 * Type for {@link SENTRY_CANCELLATION_REASON} sentry.cancellation_reason
 */
type SENTRY_CANCELLATION_REASON_TYPE = string;
/**
 * Rate at which a span was sampled in the SDK. `sentry.client_sample_rate`
 *
 * Attribute Value Type: `number` {@link SENTRY_CLIENT_SAMPLE_RATE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 0.5
 */
declare const SENTRY_CLIENT_SAMPLE_RATE = "sentry.client_sample_rate";
/**
 * Type for {@link SENTRY_CLIENT_SAMPLE_RATE} sentry.client_sample_rate
 */
type SENTRY_CLIENT_SAMPLE_RATE_TYPE = number;
/**
 * The human-readable description of a span. `sentry.description`
 *
 * Attribute Value Type: `string` {@link SENTRY_DESCRIPTION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "index view query"
 */
declare const SENTRY_DESCRIPTION = "sentry.description";
/**
 * Type for {@link SENTRY_DESCRIPTION} sentry.description
 */
type SENTRY_DESCRIPTION_TYPE = string;
/**
 * The sentry dist. `sentry.dist`
 *
 * Attribute Value Type: `string` {@link SENTRY_DIST_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "1.0"
 */
declare const SENTRY_DIST = "sentry.dist";
/**
 * Type for {@link SENTRY_DIST} sentry.dist
 */
type SENTRY_DIST_TYPE = string;
/**
 * The sentry environment. `sentry.environment`
 *
 * Attribute Value Type: `string` {@link SENTRY_ENVIRONMENT_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link ENVIRONMENT} `environment`
 *
 * @example "production"
 */
declare const SENTRY_ENVIRONMENT = "sentry.environment";
/**
 * Type for {@link SENTRY_ENVIRONMENT} sentry.environment
 */
type SENTRY_ENVIRONMENT_TYPE = string;
/**
 * The exclusive time duration of the span. `sentry.exclusive_time`
 *
 * Attribute Value Type: `number` {@link SENTRY_EXCLUSIVE_TIME_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 1234
 */
declare const SENTRY_EXCLUSIVE_TIME = "sentry.exclusive_time";
/**
 * Type for {@link SENTRY_EXCLUSIVE_TIME} sentry.exclusive_time
 */
type SENTRY_EXCLUSIVE_TIME_TYPE = number;
/**
 * If an http request was a prefetch request. `sentry.http.prefetch`
 *
 * Attribute Value Type: `boolean` {@link SENTRY_HTTP_PREFETCH_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example true
 */
declare const SENTRY_HTTP_PREFETCH = "sentry.http.prefetch";
/**
 * Type for {@link SENTRY_HTTP_PREFETCH} sentry.http.prefetch
 */
type SENTRY_HTTP_PREFETCH_TYPE = boolean;
/**
 * The reason why an idle span ended early. `sentry.idle_span_finish_reason`
 *
 * Attribute Value Type: `string` {@link SENTRY_IDLE_SPAN_FINISH_REASON_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "idleTimeout"
 */
declare const SENTRY_IDLE_SPAN_FINISH_REASON = "sentry.idle_span_finish_reason";
/**
 * Type for {@link SENTRY_IDLE_SPAN_FINISH_REASON} sentry.idle_span_finish_reason
 */
type SENTRY_IDLE_SPAN_FINISH_REASON_TYPE = string;
/**
 * A parameter used in the message template. <key> can either be the number that represent the parameter's position in the template string (sentry.message.parameter.0, sentry.message.parameter.1, etc) or the parameter's name (sentry.message.parameter.item_id, sentry.message.parameter.user_id, etc) `sentry.message.parameter.<key>`
 *
 * Attribute Value Type: `string` {@link SENTRY_MESSAGE_PARAMETER_KEY_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "sentry.message.parameter.0='123'"
 */
declare const SENTRY_MESSAGE_PARAMETER_KEY = "sentry.message.parameter.<key>";
/**
 * Type for {@link SENTRY_MESSAGE_PARAMETER_KEY} sentry.message.parameter.<key>
 */
type SENTRY_MESSAGE_PARAMETER_KEY_TYPE = string;
/**
 * The parameterized template string. `sentry.message.template`
 *
 * Attribute Value Type: `string` {@link SENTRY_MESSAGE_TEMPLATE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "Hello, {name}!"
 */
declare const SENTRY_MESSAGE_TEMPLATE = "sentry.message.template";
/**
 * Type for {@link SENTRY_MESSAGE_TEMPLATE} sentry.message.template
 */
type SENTRY_MESSAGE_TEMPLATE_TYPE = string;
/**
 * A module that was loaded in the process. The key is the name of the module. `sentry.module.<key>`
 *
 * Attribute Value Type: `string` {@link SENTRY_MODULE_KEY_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Has Dynamic Suffix: true
 *
 * @example "sentry.module.brianium/paratest='v7.7.0'"
 */
declare const SENTRY_MODULE_KEY = "sentry.module.<key>";
/**
 * Type for {@link SENTRY_MODULE_KEY} sentry.module.<key>
 */
type SENTRY_MODULE_KEY_TYPE = string;
/**
 * A parameterized route for a function in Next.js that contributes to Server-Side Rendering. Should be present on spans that track such functions when the file location of the function is known. `sentry.nextjs.ssr.function.route`
 *
 * Attribute Value Type: `string` {@link SENTRY_NEXTJS_SSR_FUNCTION_ROUTE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "/posts/[id]/layout"
 */
declare const SENTRY_NEXTJS_SSR_FUNCTION_ROUTE = "sentry.nextjs.ssr.function.route";
/**
 * Type for {@link SENTRY_NEXTJS_SSR_FUNCTION_ROUTE} sentry.nextjs.ssr.function.route
 */
type SENTRY_NEXTJS_SSR_FUNCTION_ROUTE_TYPE = string;
/**
 * A descriptor for a for a function in Next.js that contributes to Server-Side Rendering. Should be present on spans that track such functions. `sentry.nextjs.ssr.function.type`
 *
 * Attribute Value Type: `string` {@link SENTRY_NEXTJS_SSR_FUNCTION_TYPE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "generateMetadata"
 */
declare const SENTRY_NEXTJS_SSR_FUNCTION_TYPE = "sentry.nextjs.ssr.function.type";
/**
 * Type for {@link SENTRY_NEXTJS_SSR_FUNCTION_TYPE} sentry.nextjs.ssr.function.type
 */
type SENTRY_NEXTJS_SSR_FUNCTION_TYPE_TYPE = string;
/**
 * The timestamp at which an envelope was received by Relay, in nanoseconds. `sentry.observed_timestamp_nanos`
 *
 * Attribute Value Type: `string` {@link SENTRY_OBSERVED_TIMESTAMP_NANOS_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link SENTRY_INTERNAL_OBSERVED_TIMESTAMP_NANOS} `sentry._internal.observed_timestamp_nanos`
 *
 * @deprecated Use {@link SENTRY_INTERNAL_OBSERVED_TIMESTAMP_NANOS} (sentry._internal.observed_timestamp_nanos) instead
 * @example "1544712660300000000"
 */
declare const SENTRY_OBSERVED_TIMESTAMP_NANOS = "sentry.observed_timestamp_nanos";
/**
 * Type for {@link SENTRY_OBSERVED_TIMESTAMP_NANOS} sentry.observed_timestamp_nanos
 */
type SENTRY_OBSERVED_TIMESTAMP_NANOS_TYPE = string;
/**
 * The operation of a span. `sentry.op`
 *
 * Attribute Value Type: `string` {@link SENTRY_OP_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "http.client"
 */
declare const SENTRY_OP = "sentry.op";
/**
 * Type for {@link SENTRY_OP} sentry.op
 */
type SENTRY_OP_TYPE = string;
/**
 * The origin of the instrumentation (e.g. span, log, etc.) `sentry.origin`
 *
 * Attribute Value Type: `string` {@link SENTRY_ORIGIN_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "auto.http.otel.fastify"
 */
declare const SENTRY_ORIGIN = "sentry.origin";
/**
 * Type for {@link SENTRY_ORIGIN} sentry.origin
 */
type SENTRY_ORIGIN_TYPE = string;
/**
 * The sdk platform that generated the event. `sentry.platform`
 *
 * Attribute Value Type: `string` {@link SENTRY_PLATFORM_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "php"
 */
declare const SENTRY_PLATFORM = "sentry.platform";
/**
 * Type for {@link SENTRY_PLATFORM} sentry.platform
 */
type SENTRY_PLATFORM_TYPE = string;
/**
 * The id of the sentry profile. `sentry.profile_id`
 *
 * Attribute Value Type: `string` {@link SENTRY_PROFILE_ID_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link PROFILE_ID} `profile_id`
 *
 * @example "123e4567e89b12d3a456426614174000"
 */
declare const SENTRY_PROFILE_ID = "sentry.profile_id";
/**
 * Type for {@link SENTRY_PROFILE_ID} sentry.profile_id
 */
type SENTRY_PROFILE_ID_TYPE = string;
/**
 * The sentry release. `sentry.release`
 *
 * Attribute Value Type: `string` {@link SENTRY_RELEASE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link SERVICE_VERSION} `service.version`, {@link RELEASE} `release`
 *
 * @example "7.0.0"
 */
declare const SENTRY_RELEASE = "sentry.release";
/**
 * Type for {@link SENTRY_RELEASE} sentry.release
 */
type SENTRY_RELEASE_TYPE = string;
/**
 * The id of the sentry replay. `sentry.replay_id`
 *
 * Attribute Value Type: `string` {@link SENTRY_REPLAY_ID_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link REPLAY_ID} `replay_id`
 *
 * @example "123e4567e89b12d3a456426614174000"
 */
declare const SENTRY_REPLAY_ID = "sentry.replay_id";
/**
 * Type for {@link SENTRY_REPLAY_ID} sentry.replay_id
 */
type SENTRY_REPLAY_ID_TYPE = string;
/**
 * A list of names identifying enabled integrations. The list shouldhave all enabled integrations, including default integrations. Defaultintegrations are included because different SDK releases may contain differentdefault integrations. `sentry.sdk.integrations`
 *
 * Attribute Value Type: `Array<string>` {@link SENTRY_SDK_INTEGRATIONS_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example ["InboundFilters","FunctionToString","BrowserApiErrors","Breadcrumbs"]
 */
declare const SENTRY_SDK_INTEGRATIONS = "sentry.sdk.integrations";
/**
 * Type for {@link SENTRY_SDK_INTEGRATIONS} sentry.sdk.integrations
 */
type SENTRY_SDK_INTEGRATIONS_TYPE = Array<string>;
/**
 * The sentry sdk name. `sentry.sdk.name`
 *
 * Attribute Value Type: `string` {@link SENTRY_SDK_NAME_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "@sentry/react"
 */
declare const SENTRY_SDK_NAME = "sentry.sdk.name";
/**
 * Type for {@link SENTRY_SDK_NAME} sentry.sdk.name
 */
type SENTRY_SDK_NAME_TYPE = string;
/**
 * The sentry sdk version. `sentry.sdk.version`
 *
 * Attribute Value Type: `string` {@link SENTRY_SDK_VERSION_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "7.0.0"
 */
declare const SENTRY_SDK_VERSION = "sentry.sdk.version";
/**
 * Type for {@link SENTRY_SDK_VERSION} sentry.sdk.version
 */
type SENTRY_SDK_VERSION_TYPE = string;
/**
 * The segment ID of a span `sentry.segment.id`
 *
 * Attribute Value Type: `string` {@link SENTRY_SEGMENT_ID_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link _SENTRY_SEGMENT_ID} `sentry.segment_id`
 *
 * @example "051581bf3cb55c13"
 */
declare const SENTRY_SEGMENT_ID = "sentry.segment.id";
/**
 * Type for {@link SENTRY_SEGMENT_ID} sentry.segment.id
 */
type SENTRY_SEGMENT_ID_TYPE = string;
/**
 * The segment name of a span `sentry.segment.name`
 *
 * Attribute Value Type: `string` {@link SENTRY_SEGMENT_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "GET /user"
 */
declare const SENTRY_SEGMENT_NAME = "sentry.segment.name";
/**
 * Type for {@link SENTRY_SEGMENT_NAME} sentry.segment.name
 */
type SENTRY_SEGMENT_NAME_TYPE = string;
/**
 * The segment ID of a span `sentry.segment_id`
 *
 * Attribute Value Type: `string` {@link _SENTRY_SEGMENT_ID_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link SENTRY_SEGMENT_ID} `sentry.segment.id`
 *
 * @deprecated Use {@link SENTRY_SEGMENT_ID} (sentry.segment.id) instead
 * @example "051581bf3cb55c13"
 */
declare const _SENTRY_SEGMENT_ID = "sentry.segment_id";
/**
 * Type for {@link _SENTRY_SEGMENT_ID} sentry.segment_id
 */
type _SENTRY_SEGMENT_ID_TYPE = string;
/**
 * Rate at which a span was sampled in Relay. `sentry.server_sample_rate`
 *
 * Attribute Value Type: `number` {@link SENTRY_SERVER_SAMPLE_RATE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example 0.5
 */
declare const SENTRY_SERVER_SAMPLE_RATE = "sentry.server_sample_rate";
/**
 * Type for {@link SENTRY_SERVER_SAMPLE_RATE} sentry.server_sample_rate
 */
type SENTRY_SERVER_SAMPLE_RATE_TYPE = number;
/**
 * The source of a span, also referred to as transaction source. `sentry.span.source`
 *
 * Attribute Value Type: `string` {@link SENTRY_SPAN_SOURCE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "route"
 */
declare const SENTRY_SPAN_SOURCE = "sentry.span.source";
/**
 * Type for {@link SENTRY_SPAN_SOURCE} sentry.span.source
 */
type SENTRY_SPAN_SOURCE_TYPE = string;
/**
 * The span id of the span that was active when the log was collected. This should not be set if there was no active span. `sentry.trace.parent_span_id`
 *
 * Attribute Value Type: `string` {@link SENTRY_TRACE_PARENT_SPAN_ID_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "b0e6f15b45c36b12"
 */
declare const SENTRY_TRACE_PARENT_SPAN_ID = "sentry.trace.parent_span_id";
/**
 * Type for {@link SENTRY_TRACE_PARENT_SPAN_ID} sentry.trace.parent_span_id
 */
type SENTRY_TRACE_PARENT_SPAN_ID_TYPE = string;
/**
 * The sentry transaction (segment name). `sentry.transaction`
 *
 * Attribute Value Type: `string` {@link SENTRY_TRANSACTION_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link TRANSACTION} `transaction`
 *
 * @example "GET /"
 */
declare const SENTRY_TRANSACTION = "sentry.transaction";
/**
 * Type for {@link SENTRY_TRANSACTION} sentry.transaction
 */
type SENTRY_TRANSACTION_TYPE = string;
/**
 * Server domain name if available without reverse DNS lookup; otherwise, IP address or Unix domain socket name. `server.address`
 *
 * Attribute Value Type: `string` {@link SERVER_ADDRESS_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link HTTP_SERVER_NAME} `http.server_name`, {@link NET_HOST_NAME} `net.host.name`, {@link HTTP_HOST} `http.host`
 *
 * @example "example.com"
 */
declare const SERVER_ADDRESS = "server.address";
/**
 * Type for {@link SERVER_ADDRESS} server.address
 */
type SERVER_ADDRESS_TYPE = string;
/**
 * Server port number. `server.port`
 *
 * Attribute Value Type: `number` {@link SERVER_PORT_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link NET_HOST_PORT} `net.host.port`
 *
 * @example 1337
 */
declare const SERVER_PORT = "server.port";
/**
 * Type for {@link SERVER_PORT} server.port
 */
type SERVER_PORT_TYPE = number;
/**
 * Logical name of the service. `service.name`
 *
 * Attribute Value Type: `string` {@link SERVICE_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "omegastar"
 */
declare const SERVICE_NAME = "service.name";
/**
 * Type for {@link SERVICE_NAME} service.name
 */
type SERVICE_NAME_TYPE = string;
/**
 * The version string of the service API or implementation. The format is not defined by these conventions. `service.version`
 *
 * Attribute Value Type: `string` {@link SERVICE_VERSION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link SENTRY_RELEASE} `sentry.release`
 *
 * @example "5.0.0"
 */
declare const SERVICE_VERSION = "service.version";
/**
 * Type for {@link SERVICE_VERSION} service.version
 */
type SERVICE_VERSION_TYPE = string;
/**
 * Current “managed” thread ID. `thread.id`
 *
 * Attribute Value Type: `number` {@link THREAD_ID_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * @example 56
 */
declare const THREAD_ID = "thread.id";
/**
 * Type for {@link THREAD_ID} thread.id
 */
type THREAD_ID_TYPE = number;
/**
 * Current thread name. `thread.name`
 *
 * Attribute Value Type: `string` {@link THREAD_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "main"
 */
declare const THREAD_NAME = "thread.name";
/**
 * Type for {@link THREAD_NAME} thread.name
 */
type THREAD_NAME_TYPE = string;
/**
 * The sentry transaction (segment name). `transaction`
 *
 * Attribute Value Type: `string` {@link TRANSACTION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link SENTRY_TRANSACTION} `sentry.transaction`
 *
 * @deprecated Use {@link SENTRY_TRANSACTION} (sentry.transaction) instead
 * @example "GET /"
 */
declare const TRANSACTION = "transaction";
/**
 * Type for {@link TRANSACTION} transaction
 */
type TRANSACTION_TYPE = string;
/**
 * More granular type of the operation happening. `type`
 *
 * Attribute Value Type: `string` {@link TYPE_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example "fetch"
 */
declare const TYPE = "type";
/**
 * Type for {@link TYPE} type
 */
type TYPE_TYPE = string;
/**
 * The name of the associated component. `ui.component_name`
 *
 * Attribute Value Type: `string` {@link UI_COMPONENT_NAME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "HomeButton"
 */
declare const UI_COMPONENT_NAME = "ui.component_name";
/**
 * Type for {@link UI_COMPONENT_NAME} ui.component_name
 */
type UI_COMPONENT_NAME_TYPE = string;
/**
 * Whether the span execution contributed to the TTFD (time to fully drawn) metric. `ui.contributes_to_ttfd`
 *
 * Attribute Value Type: `boolean` {@link UI_CONTRIBUTES_TO_TTFD_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example true
 */
declare const UI_CONTRIBUTES_TO_TTFD = "ui.contributes_to_ttfd";
/**
 * Type for {@link UI_CONTRIBUTES_TO_TTFD} ui.contributes_to_ttfd
 */
type UI_CONTRIBUTES_TO_TTFD_TYPE = boolean;
/**
 * Whether the span execution contributed to the TTID (time to initial display) metric. `ui.contributes_to_ttid`
 *
 * Attribute Value Type: `boolean` {@link UI_CONTRIBUTES_TO_TTID_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: No
 *
 * @example true
 */
declare const UI_CONTRIBUTES_TO_TTID = "ui.contributes_to_ttid";
/**
 * Type for {@link UI_CONTRIBUTES_TO_TTID} ui.contributes_to_ttid
 */
type UI_CONTRIBUTES_TO_TTID_TYPE = boolean;
/**
 * Server domain name if available without reverse DNS lookup; otherwise, IP address or Unix domain socket name. `url.domain`
 *
 * Attribute Value Type: `string` {@link URL_DOMAIN_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "example.com"
 */
declare const URL_DOMAIN = "url.domain";
/**
 * Type for {@link URL_DOMAIN} url.domain
 */
type URL_DOMAIN_TYPE = string;
/**
 * The fragments present in the URI. Note that this does not contain the leading # character, while the `http.fragment` attribute does. `url.fragment`
 *
 * Attribute Value Type: `string` {@link URL_FRAGMENT_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "details"
 */
declare const URL_FRAGMENT = "url.fragment";
/**
 * Type for {@link URL_FRAGMENT} url.fragment
 */
type URL_FRAGMENT_TYPE = string;
/**
 * The URL of the resource that was fetched. `url.full`
 *
 * Attribute Value Type: `string` {@link URL_FULL_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link HTTP_URL} `http.url`, {@link URL} `url`
 *
 * @example "https://example.com/test?foo=bar#buzz"
 */
declare const URL_FULL = "url.full";
/**
 * Type for {@link URL_FULL} url.full
 */
type URL_FULL_TYPE = string;
/**
 * The URI path component. `url.path`
 *
 * Attribute Value Type: `string` {@link URL_PATH_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "/foo"
 */
declare const URL_PATH = "url.path";
/**
 * Type for {@link URL_PATH} url.path
 */
type URL_PATH_TYPE = string;
/**
 * Decoded parameters extracted from a URL path. Usually added by client-side routing frameworks like vue-router. `url.path.parameter.<key>`
 *
 * Attribute Value Type: `string` {@link URL_PATH_PARAMETER_KEY_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Has Dynamic Suffix: true
 *
 * Aliases: {@link PARAMS_KEY} `params.<key>`
 *
 * @example "url.path.parameter.id='123'"
 */
declare const URL_PATH_PARAMETER_KEY = "url.path.parameter.<key>";
/**
 * Type for {@link URL_PATH_PARAMETER_KEY} url.path.parameter.<key>
 */
type URL_PATH_PARAMETER_KEY_TYPE = string;
/**
 * Server port number. `url.port`
 *
 * Attribute Value Type: `number` {@link URL_PORT_TYPE}
 *
 * Contains PII: false
 *
 * Attribute defined in OTEL: Yes
 *
 * @example 1337
 */
declare const URL_PORT = "url.port";
/**
 * Type for {@link URL_PORT} url.port
 */
type URL_PORT_TYPE = number;
/**
 * The query string present in the URL. Note that this does not contain the leading ? character, while the `http.query` attribute does. `url.query`
 *
 * Attribute Value Type: `string` {@link URL_QUERY_TYPE}
 *
 * Contains PII: maybe - Query string values can contain sensitive information. Clients should attempt to scrub parameters that might contain sensitive information.
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "foo=bar&bar=baz"
 */
declare const URL_QUERY = "url.query";
/**
 * Type for {@link URL_QUERY} url.query
 */
type URL_QUERY_TYPE = string;
/**
 * The URI scheme component identifying the used protocol. `url.scheme`
 *
 * Attribute Value Type: `string` {@link URL_SCHEME_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link HTTP_SCHEME} `http.scheme`
 *
 * @example "https"
 */
declare const URL_SCHEME = "url.scheme";
/**
 * Type for {@link URL_SCHEME} url.scheme
 */
type URL_SCHEME_TYPE = string;
/**
 * The low-cardinality template of an absolute path reference. `url.template`
 *
 * Attribute Value Type: `string` {@link URL_TEMPLATE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link HTTP_ROUTE} `http.route`
 *
 * @example "/users/:id"
 */
declare const URL_TEMPLATE = "url.template";
/**
 * Type for {@link URL_TEMPLATE} url.template
 */
type URL_TEMPLATE_TYPE = string;
/**
 * The URL of the resource that was fetched. `url`
 *
 * Attribute Value Type: `string` {@link URL_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * Aliases: {@link URL_FULL} `url.full`, {@link HTTP_URL} `http.url`
 *
 * @deprecated Use {@link URL_FULL} (url.full) instead
 * @example "https://example.com/test?foo=bar#buzz"
 */
declare const URL = "url";
/**
 * Type for {@link URL} url
 */
type URL_TYPE = string;
/**
 * User email address. `user.email`
 *
 * Attribute Value Type: `string` {@link USER_EMAIL_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "test@example.com"
 */
declare const USER_EMAIL = "user.email";
/**
 * Type for {@link USER_EMAIL} user.email
 */
type USER_EMAIL_TYPE = string;
/**
 * User's full name. `user.full_name`
 *
 * Attribute Value Type: `string` {@link USER_FULL_NAME_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "John Smith"
 */
declare const USER_FULL_NAME = "user.full_name";
/**
 * Type for {@link USER_FULL_NAME} user.full_name
 */
type USER_FULL_NAME_TYPE = string;
/**
 * Human readable city name. `user.geo.city`
 *
 * Attribute Value Type: `string` {@link USER_GEO_CITY_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "Toronto"
 */
declare const USER_GEO_CITY = "user.geo.city";
/**
 * Type for {@link USER_GEO_CITY} user.geo.city
 */
type USER_GEO_CITY_TYPE = string;
/**
 * Two-letter country code (ISO 3166-1 alpha-2). `user.geo.country_code`
 *
 * Attribute Value Type: `string` {@link USER_GEO_COUNTRY_CODE_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "CA"
 */
declare const USER_GEO_COUNTRY_CODE = "user.geo.country_code";
/**
 * Type for {@link USER_GEO_COUNTRY_CODE} user.geo.country_code
 */
type USER_GEO_COUNTRY_CODE_TYPE = string;
/**
 * Human readable region name or code. `user.geo.region`
 *
 * Attribute Value Type: `string` {@link USER_GEO_REGION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "Canada"
 */
declare const USER_GEO_REGION = "user.geo.region";
/**
 * Type for {@link USER_GEO_REGION} user.geo.region
 */
type USER_GEO_REGION_TYPE = string;
/**
 * Human readable subdivision name. `user.geo.subdivision`
 *
 * Attribute Value Type: `string` {@link USER_GEO_SUBDIVISION_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: No
 *
 * @example "Ontario"
 */
declare const USER_GEO_SUBDIVISION = "user.geo.subdivision";
/**
 * Type for {@link USER_GEO_SUBDIVISION} user.geo.subdivision
 */
type USER_GEO_SUBDIVISION_TYPE = string;
/**
 * Unique user hash to correlate information for a user in anonymized form. `user.hash`
 *
 * Attribute Value Type: `string` {@link USER_HASH_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "8ae4c2993e0f4f3b8b2d1b1f3b5e8f4d"
 */
declare const USER_HASH = "user.hash";
/**
 * Type for {@link USER_HASH} user.hash
 */
type USER_HASH_TYPE = string;
/**
 * Unique identifier of the user. `user.id`
 *
 * Attribute Value Type: `string` {@link USER_ID_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "S-1-5-21-202424912787-2692429404-2351956786-1000"
 */
declare const USER_ID = "user.id";
/**
 * Type for {@link USER_ID} user.id
 */
type USER_ID_TYPE = string;
/**
 * The IP address of the user. `user.ip_address`
 *
 * Attribute Value Type: `string` {@link USER_IP_ADDRESS_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: No
 *
 * @example "192.168.1.1"
 */
declare const USER_IP_ADDRESS = "user.ip_address";
/**
 * Type for {@link USER_IP_ADDRESS} user.ip_address
 */
type USER_IP_ADDRESS_TYPE = string;
/**
 * Short name or login/username of the user. `user.name`
 *
 * Attribute Value Type: `string` {@link USER_NAME_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: Yes
 *
 * @example "j.smith"
 */
declare const USER_NAME = "user.name";
/**
 * Type for {@link USER_NAME} user.name
 */
type USER_NAME_TYPE = string;
/**
 * Array of user roles at the time of the event. `user.roles`
 *
 * Attribute Value Type: `Array<string>` {@link USER_ROLES_TYPE}
 *
 * Contains PII: true
 *
 * Attribute defined in OTEL: Yes
 *
 * @example ["admin","editor"]
 */
declare const USER_ROLES = "user.roles";
/**
 * Type for {@link USER_ROLES} user.roles
 */
type USER_ROLES_TYPE = Array<string>;
/**
 * Value of the HTTP User-Agent header sent by the client. `user_agent.original`
 *
 * Attribute Value Type: `string` {@link USER_AGENT_ORIGINAL_TYPE}
 *
 * Contains PII: maybe
 *
 * Attribute defined in OTEL: Yes
 *
 * Aliases: {@link HTTP_USER_AGENT} `http.user_agent`
 *
 * @example "Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1"
 */
declare const USER_AGENT_ORIGINAL = "user_agent.original";
/**
 * Type for {@link USER_AGENT_ORIGINAL} user_agent.original
 */
type USER_AGENT_ORIGINAL_TYPE = string;
declare enum AttributeType {
    STRING = "string",
    BOOLEAN = "boolean",
    INTEGER = "integer",
    DOUBLE = "double",
    STRING_ARRAY = "string[]",
    BOOLEAN_ARRAY = "boolean[]",
    INTEGER_ARRAY = "integer[]",
    DOUBLE_ARRAY = "double[]"
}
declare enum IsPii {
    TRUE = "true",
    FALSE = "false",
    MAYBE = "maybe"
}
interface PiiInfo {
    /** Whether the attribute contains PII */
    isPii: IsPii;
    /** Reason why it has PII or not */
    reason?: string;
}
declare enum DeprecationStatus {
    BACKFILL = "backfill",
    NORMALIZE = "normalize"
}
interface DeprecationInfo {
    /** What this attribute was replaced with */
    replacement?: string;
    /** Reason for deprecation */
    reason?: string;
}
interface AttributeMetadata {
    /** A description of the attribute */
    brief: string;
    /** The type of the attribute value */
    type: AttributeType;
    /** If an attribute can have PII */
    pii: PiiInfo;
    /** Whether the attribute is defined in OpenTelemetry Semantic Conventions */
    isInOtel: boolean;
    /** If an attribute has a dynamic suffix */
    hasDynamicSuffix?: boolean;
    /** An example value of the attribute */
    example?: AttributeValue;
    /** If an attribute was deprecated, and what it was replaced with */
    deprecation?: DeprecationInfo;
    /** If there are attributes that alias to this attribute */
    aliases?: string[];
    /** If an attribute is SDK specific, list the SDKs that use this attribute */
    sdks?: string[];
}
declare enum AttributeName {
    AI_CITATIONS = "ai.citations",
    AI_COMPLETION_TOKENS_USED = "ai.completion_tokens.used",
    AI_DOCUMENTS = "ai.documents",
    AI_FINISH_REASON = "ai.finish_reason",
    AI_FREQUENCY_PENALTY = "ai.frequency_penalty",
    AI_FUNCTION_CALL = "ai.function_call",
    AI_GENERATION_ID = "ai.generation_id",
    AI_INPUT_MESSAGES = "ai.input_messages",
    AI_IS_SEARCH_REQUIRED = "ai.is_search_required",
    AI_METADATA = "ai.metadata",
    AI_MODEL_PROVIDER = "ai.model.provider",
    AI_MODEL_ID = "ai.model_id",
    AI_PIPELINE_NAME = "ai.pipeline.name",
    AI_PREAMBLE = "ai.preamble",
    AI_PRESENCE_PENALTY = "ai.presence_penalty",
    AI_PROMPT_TOKENS_USED = "ai.prompt_tokens.used",
    AI_RAW_PROMPTING = "ai.raw_prompting",
    AI_RESPONSE_FORMAT = "ai.response_format",
    AI_RESPONSES = "ai.responses",
    AI_SEARCH_QUERIES = "ai.search_queries",
    AI_SEARCH_RESULTS = "ai.search_results",
    AI_SEED = "ai.seed",
    AI_STREAMING = "ai.streaming",
    AI_TAGS = "ai.tags",
    AI_TEMPERATURE = "ai.temperature",
    AI_TEXTS = "ai.texts",
    AI_TOOL_CALLS = "ai.tool_calls",
    AI_TOOLS = "ai.tools",
    AI_TOP_K = "ai.top_k",
    AI_TOP_P = "ai.top_p",
    AI_TOTAL_COST = "ai.total_cost",
    AI_TOTAL_TOKENS_USED = "ai.total_tokens.used",
    AI_WARNINGS = "ai.warnings",
    APP_START_TYPE = "app_start_type",
    BLOCKED_MAIN_THREAD = "blocked_main_thread",
    BROWSER_NAME = "browser.name",
    BROWSER_REPORT_TYPE = "browser.report.type",
    BROWSER_SCRIPT_INVOKER = "browser.script.invoker",
    BROWSER_SCRIPT_INVOKER_TYPE = "browser.script.invoker_type",
    BROWSER_SCRIPT_SOURCE_CHAR_POSITION = "browser.script.source_char_position",
    BROWSER_VERSION = "browser.version",
    CACHE_HIT = "cache.hit",
    CACHE_ITEM_SIZE = "cache.item_size",
    CACHE_KEY = "cache.key",
    CACHE_OPERATION = "cache.operation",
    CACHE_TTL = "cache.ttl",
    CHANNEL = "channel",
    CLIENT_ADDRESS = "client.address",
    CLIENT_PORT = "client.port",
    CLOUDFLARE_D1_DURATION = "cloudflare.d1.duration",
    CLOUDFLARE_D1_ROWS_READ = "cloudflare.d1.rows_read",
    CLOUDFLARE_D1_ROWS_WRITTEN = "cloudflare.d1.rows_written",
    CODE_FILE_PATH = "code.file.path",
    CODE_FILEPATH = "code.filepath",
    CODE_FUNCTION = "code.function",
    CODE_FUNCTION_NAME = "code.function.name",
    CODE_LINE_NUMBER = "code.line.number",
    CODE_LINENO = "code.lineno",
    CODE_NAMESPACE = "code.namespace",
    DB_COLLECTION_NAME = "db.collection.name",
    DB_NAME = "db.name",
    DB_NAMESPACE = "db.namespace",
    DB_OPERATION = "db.operation",
    DB_OPERATION_NAME = "db.operation.name",
    DB_QUERY_PARAMETER_KEY = "db.query.parameter.<key>",
    DB_QUERY_SUMMARY = "db.query.summary",
    DB_QUERY_TEXT = "db.query.text",
    DB_REDIS_CONNECTION = "db.redis.connection",
    DB_REDIS_PARAMETERS = "db.redis.parameters",
    DB_SQL_BINDINGS = "db.sql.bindings",
    DB_STATEMENT = "db.statement",
    DB_SYSTEM = "db.system",
    DB_SYSTEM_NAME = "db.system.name",
    DB_USER = "db.user",
    DEVICE_BRAND = "device.brand",
    DEVICE_FAMILY = "device.family",
    DEVICE_MODEL = "device.model",
    ENVIRONMENT = "environment",
    ERROR_TYPE = "error.type",
    EVENT_ID = "event.id",
    EVENT_NAME = "event.name",
    EXCEPTION_ESCAPED = "exception.escaped",
    EXCEPTION_MESSAGE = "exception.message",
    EXCEPTION_STACKTRACE = "exception.stacktrace",
    EXCEPTION_TYPE = "exception.type",
    FAAS_COLDSTART = "faas.coldstart",
    FAAS_CRON = "faas.cron",
    FAAS_TIME = "faas.time",
    FAAS_TRIGGER = "faas.trigger",
    FLAG_EVALUATION_KEY = "flag.evaluation.<key>",
    FRAMES_DELAY = "frames.delay",
    FRAMES_FROZEN = "frames.frozen",
    FRAMES_SLOW = "frames.slow",
    FRAMES_TOTAL = "frames.total",
    FS_ERROR = "fs_error",
    GEN_AI_AGENT_NAME = "gen_ai.agent.name",
    GEN_AI_ASSISTANT_MESSAGE = "gen_ai.assistant.message",
    GEN_AI_CHOICE = "gen_ai.choice",
    GEN_AI_COST_INPUT_TOKENS = "gen_ai.cost.input_tokens",
    GEN_AI_COST_OUTPUT_TOKENS = "gen_ai.cost.output_tokens",
    GEN_AI_COST_TOTAL_TOKENS = "gen_ai.cost.total_tokens",
    GEN_AI_OPERATION_NAME = "gen_ai.operation.name",
    GEN_AI_OPERATION_TYPE = "gen_ai.operation.type",
    GEN_AI_PIPELINE_NAME = "gen_ai.pipeline.name",
    GEN_AI_PROMPT = "gen_ai.prompt",
    GEN_AI_REQUEST_AVAILABLE_TOOLS = "gen_ai.request.available_tools",
    GEN_AI_REQUEST_FREQUENCY_PENALTY = "gen_ai.request.frequency_penalty",
    GEN_AI_REQUEST_MAX_TOKENS = "gen_ai.request.max_tokens",
    GEN_AI_REQUEST_MESSAGES = "gen_ai.request.messages",
    GEN_AI_REQUEST_MODEL = "gen_ai.request.model",
    GEN_AI_REQUEST_PRESENCE_PENALTY = "gen_ai.request.presence_penalty",
    GEN_AI_REQUEST_SEED = "gen_ai.request.seed",
    GEN_AI_REQUEST_TEMPERATURE = "gen_ai.request.temperature",
    GEN_AI_REQUEST_TOP_K = "gen_ai.request.top_k",
    GEN_AI_REQUEST_TOP_P = "gen_ai.request.top_p",
    GEN_AI_RESPONSE_FINISH_REASONS = "gen_ai.response.finish_reasons",
    GEN_AI_RESPONSE_ID = "gen_ai.response.id",
    GEN_AI_RESPONSE_MODEL = "gen_ai.response.model",
    GEN_AI_RESPONSE_STREAMING = "gen_ai.response.streaming",
    GEN_AI_RESPONSE_TEXT = "gen_ai.response.text",
    GEN_AI_RESPONSE_TOKENS_PER_SECOND = "gen_ai.response.tokens_per_second",
    GEN_AI_RESPONSE_TOOL_CALLS = "gen_ai.response.tool_calls",
    GEN_AI_SYSTEM = "gen_ai.system",
    GEN_AI_SYSTEM_MESSAGE = "gen_ai.system.message",
    GEN_AI_TOOL_DESCRIPTION = "gen_ai.tool.description",
    GEN_AI_TOOL_INPUT = "gen_ai.tool.input",
    GEN_AI_TOOL_MESSAGE = "gen_ai.tool.message",
    GEN_AI_TOOL_NAME = "gen_ai.tool.name",
    GEN_AI_TOOL_OUTPUT = "gen_ai.tool.output",
    GEN_AI_TOOL_TYPE = "gen_ai.tool.type",
    GEN_AI_USAGE_COMPLETION_TOKENS = "gen_ai.usage.completion_tokens",
    GEN_AI_USAGE_INPUT_TOKENS = "gen_ai.usage.input_tokens",
    GEN_AI_USAGE_INPUT_TOKENS_CACHED = "gen_ai.usage.input_tokens.cached",
    GEN_AI_USAGE_OUTPUT_TOKENS = "gen_ai.usage.output_tokens",
    GEN_AI_USAGE_OUTPUT_TOKENS_REASONING = "gen_ai.usage.output_tokens.reasoning",
    GEN_AI_USAGE_PROMPT_TOKENS = "gen_ai.usage.prompt_tokens",
    GEN_AI_USAGE_TOTAL_COST = "gen_ai.usage.total_cost",
    GEN_AI_USAGE_TOTAL_TOKENS = "gen_ai.usage.total_tokens",
    GEN_AI_USER_MESSAGE = "gen_ai.user.message",
    GRAPHQL_OPERATION_NAME = "graphql.operation.name",
    GRAPHQL_OPERATION_TYPE = "graphql.operation.type",
    HTTP_CLIENT_IP = "http.client_ip",
    HTTP_DECODED_RESPONSE_CONTENT_LENGTH = "http.decoded_response_content_length",
    HTTP_FLAVOR = "http.flavor",
    HTTP_FRAGMENT = "http.fragment",
    HTTP_HOST = "http.host",
    HTTP_METHOD = "http.method",
    HTTP_QUERY = "http.query",
    HTTP_REQUEST_CONNECT_START = "http.request.connect_start",
    HTTP_REQUEST_CONNECTION_END = "http.request.connection_end",
    HTTP_REQUEST_DOMAIN_LOOKUP_END = "http.request.domain_lookup_end",
    HTTP_REQUEST_DOMAIN_LOOKUP_START = "http.request.domain_lookup_start",
    HTTP_REQUEST_FETCH_START = "http.request.fetch_start",
    HTTP_REQUEST_HEADER_KEY = "http.request.header.<key>",
    HTTP_REQUEST_METHOD = "http.request.method",
    HTTP_REQUEST_REDIRECT_END = "http.request.redirect_end",
    HTTP_REQUEST_REDIRECT_START = "http.request.redirect_start",
    HTTP_REQUEST_REQUEST_START = "http.request.request_start",
    HTTP_REQUEST_RESEND_COUNT = "http.request.resend_count",
    HTTP_REQUEST_RESPONSE_END = "http.request.response_end",
    HTTP_REQUEST_RESPONSE_START = "http.request.response_start",
    HTTP_REQUEST_SECURE_CONNECTION_START = "http.request.secure_connection_start",
    HTTP_REQUEST_TIME_TO_FIRST_BYTE = "http.request.time_to_first_byte",
    HTTP_REQUEST_WORKER_START = "http.request.worker_start",
    HTTP_RESPONSE_BODY_SIZE = "http.response.body.size",
    HTTP_RESPONSE_HEADER_KEY = "http.response.header.<key>",
    HTTP_RESPONSE_HEADER_CONTENT_LENGTH = "http.response.header.content-length",
    HTTP_RESPONSE_SIZE = "http.response.size",
    HTTP_RESPONSE_STATUS_CODE = "http.response.status_code",
    HTTP_RESPONSE_CONTENT_LENGTH = "http.response_content_length",
    HTTP_RESPONSE_TRANSFER_SIZE = "http.response_transfer_size",
    HTTP_ROUTE = "http.route",
    HTTP_SCHEME = "http.scheme",
    HTTP_SERVER_NAME = "http.server_name",
    HTTP_STATUS_CODE = "http.status_code",
    HTTP_TARGET = "http.target",
    HTTP_URL = "http.url",
    HTTP_USER_AGENT = "http.user_agent",
    ID = "id",
    JVM_GC_ACTION = "jvm.gc.action",
    JVM_GC_NAME = "jvm.gc.name",
    JVM_MEMORY_POOL_NAME = "jvm.memory.pool.name",
    JVM_MEMORY_TYPE = "jvm.memory.type",
    JVM_THREAD_DAEMON = "jvm.thread.daemon",
    JVM_THREAD_STATE = "jvm.thread.state",
    LCP_ELEMENT = "lcp.element",
    LCP_ID = "lcp.id",
    LCP_SIZE = "lcp.size",
    LCP_URL = "lcp.url",
    LOGGER_NAME = "logger.name",
    MESSAGING_DESTINATION_CONNECTION = "messaging.destination.connection",
    MESSAGING_DESTINATION_NAME = "messaging.destination.name",
    MESSAGING_MESSAGE_BODY_SIZE = "messaging.message.body.size",
    MESSAGING_MESSAGE_ENVELOPE_SIZE = "messaging.message.envelope.size",
    MESSAGING_MESSAGE_ID = "messaging.message.id",
    MESSAGING_MESSAGE_RECEIVE_LATENCY = "messaging.message.receive.latency",
    MESSAGING_MESSAGE_RETRY_COUNT = "messaging.message.retry.count",
    MESSAGING_OPERATION_TYPE = "messaging.operation.type",
    MESSAGING_SYSTEM = "messaging.system",
    METHOD = "method",
    NAVIGATION_TYPE = "navigation.type",
    NEL_ELAPSED_TIME = "nel.elapsed_time",
    NEL_PHASE = "nel.phase",
    NEL_REFERRER = "nel.referrer",
    NEL_SAMPLING_FUNCTION = "nel.sampling_function",
    NEL_TYPE = "nel.type",
    NET_HOST_IP = "net.host.ip",
    NET_HOST_NAME = "net.host.name",
    NET_HOST_PORT = "net.host.port",
    NET_PEER_IP = "net.peer.ip",
    NET_PEER_NAME = "net.peer.name",
    NET_PEER_PORT = "net.peer.port",
    NET_PROTOCOL_NAME = "net.protocol.name",
    NET_PROTOCOL_VERSION = "net.protocol.version",
    NET_SOCK_FAMILY = "net.sock.family",
    NET_SOCK_HOST_ADDR = "net.sock.host.addr",
    NET_SOCK_HOST_PORT = "net.sock.host.port",
    NET_SOCK_PEER_ADDR = "net.sock.peer.addr",
    NET_SOCK_PEER_NAME = "net.sock.peer.name",
    NET_SOCK_PEER_PORT = "net.sock.peer.port",
    NET_TRANSPORT = "net.transport",
    NETWORK_LOCAL_ADDRESS = "network.local.address",
    NETWORK_LOCAL_PORT = "network.local.port",
    NETWORK_PEER_ADDRESS = "network.peer.address",
    NETWORK_PEER_PORT = "network.peer.port",
    NETWORK_PROTOCOL_NAME = "network.protocol.name",
    NETWORK_PROTOCOL_VERSION = "network.protocol.version",
    NETWORK_TRANSPORT = "network.transport",
    NETWORK_TYPE = "network.type",
    OS_BUILD_ID = "os.build_id",
    OS_DESCRIPTION = "os.description",
    OS_NAME = "os.name",
    OS_TYPE = "os.type",
    OS_VERSION = "os.version",
    OTEL_SCOPE_NAME = "otel.scope.name",
    OTEL_SCOPE_VERSION = "otel.scope.version",
    OTEL_STATUS_CODE = "otel.status_code",
    OTEL_STATUS_DESCRIPTION = "otel.status_description",
    PARAMS_KEY = "params.<key>",
    PREVIOUS_ROUTE = "previous_route",
    PROCESS_EXECUTABLE_NAME = "process.executable.name",
    PROCESS_PID = "process.pid",
    PROCESS_RUNTIME_DESCRIPTION = "process.runtime.description",
    PROCESS_RUNTIME_NAME = "process.runtime.name",
    PROCESS_RUNTIME_VERSION = "process.runtime.version",
    PROFILE_ID = "profile_id",
    QUERY_KEY = "query.<key>",
    RELEASE = "release",
    REMIX_ACTION_FORM_DATA_KEY = "remix.action_form_data.<key>",
    REPLAY_ID = "replay_id",
    RESOURCE_RENDER_BLOCKING_STATUS = "resource.render_blocking_status",
    ROUTE = "route",
    RPC_GRPC_STATUS_CODE = "rpc.grpc.status_code",
    RPC_SERVICE = "rpc.service",
    SENTRY_INTERNAL_DSC_ENVIRONMENT = "sentry._internal.dsc.environment",
    SENTRY_INTERNAL_DSC_ORG_ID = "sentry._internal.dsc.org_id",
    SENTRY_INTERNAL_DSC_PUBLIC_KEY = "sentry._internal.dsc.public_key",
    SENTRY_INTERNAL_DSC_RELEASE = "sentry._internal.dsc.release",
    SENTRY_INTERNAL_DSC_SAMPLE_RAND = "sentry._internal.dsc.sample_rand",
    SENTRY_INTERNAL_DSC_SAMPLE_RATE = "sentry._internal.dsc.sample_rate",
    SENTRY_INTERNAL_DSC_SAMPLED = "sentry._internal.dsc.sampled",
    SENTRY_INTERNAL_DSC_TRACE_ID = "sentry._internal.dsc.trace_id",
    SENTRY_INTERNAL_DSC_TRANSACTION = "sentry._internal.dsc.transaction",
    SENTRY_INTERNAL_OBSERVED_TIMESTAMP_NANOS = "sentry._internal.observed_timestamp_nanos",
    SENTRY_INTERNAL_SEGMENT_CONTAINS_GEN_AI_SPANS = "sentry._internal.segment.contains_gen_ai_spans",
    SENTRY_BROWSER_NAME = "sentry.browser.name",
    SENTRY_BROWSER_VERSION = "sentry.browser.version",
    SENTRY_CANCELLATION_REASON = "sentry.cancellation_reason",
    SENTRY_CLIENT_SAMPLE_RATE = "sentry.client_sample_rate",
    SENTRY_DESCRIPTION = "sentry.description",
    SENTRY_DIST = "sentry.dist",
    SENTRY_ENVIRONMENT = "sentry.environment",
    SENTRY_EXCLUSIVE_TIME = "sentry.exclusive_time",
    SENTRY_HTTP_PREFETCH = "sentry.http.prefetch",
    SENTRY_IDLE_SPAN_FINISH_REASON = "sentry.idle_span_finish_reason",
    SENTRY_MESSAGE_PARAMETER_KEY = "sentry.message.parameter.<key>",
    SENTRY_MESSAGE_TEMPLATE = "sentry.message.template",
    SENTRY_MODULE_KEY = "sentry.module.<key>",
    SENTRY_NEXTJS_SSR_FUNCTION_ROUTE = "sentry.nextjs.ssr.function.route",
    SENTRY_NEXTJS_SSR_FUNCTION_TYPE = "sentry.nextjs.ssr.function.type",
    SENTRY_OBSERVED_TIMESTAMP_NANOS = "sentry.observed_timestamp_nanos",
    SENTRY_OP = "sentry.op",
    SENTRY_ORIGIN = "sentry.origin",
    SENTRY_PLATFORM = "sentry.platform",
    SENTRY_PROFILE_ID = "sentry.profile_id",
    SENTRY_RELEASE = "sentry.release",
    SENTRY_REPLAY_ID = "sentry.replay_id",
    SENTRY_SDK_INTEGRATIONS = "sentry.sdk.integrations",
    SENTRY_SDK_NAME = "sentry.sdk.name",
    SENTRY_SDK_VERSION = "sentry.sdk.version",
    SENTRY_SEGMENT_ID = "sentry.segment.id",
    SENTRY_SEGMENT_NAME = "sentry.segment.name",
    _SENTRY_SEGMENT_ID = "sentry.segment_id",
    SENTRY_SERVER_SAMPLE_RATE = "sentry.server_sample_rate",
    SENTRY_SPAN_SOURCE = "sentry.span.source",
    SENTRY_TRACE_PARENT_SPAN_ID = "sentry.trace.parent_span_id",
    SENTRY_TRANSACTION = "sentry.transaction",
    SERVER_ADDRESS = "server.address",
    SERVER_PORT = "server.port",
    SERVICE_NAME = "service.name",
    SERVICE_VERSION = "service.version",
    THREAD_ID = "thread.id",
    THREAD_NAME = "thread.name",
    TRANSACTION = "transaction",
    TYPE = "type",
    UI_COMPONENT_NAME = "ui.component_name",
    UI_CONTRIBUTES_TO_TTFD = "ui.contributes_to_ttfd",
    UI_CONTRIBUTES_TO_TTID = "ui.contributes_to_ttid",
    URL_DOMAIN = "url.domain",
    URL_FRAGMENT = "url.fragment",
    URL_FULL = "url.full",
    URL_PATH = "url.path",
    URL_PATH_PARAMETER_KEY = "url.path.parameter.<key>",
    URL_PORT = "url.port",
    URL_QUERY = "url.query",
    URL_SCHEME = "url.scheme",
    URL_TEMPLATE = "url.template",
    URL = "url",
    USER_EMAIL = "user.email",
    USER_FULL_NAME = "user.full_name",
    USER_GEO_CITY = "user.geo.city",
    USER_GEO_COUNTRY_CODE = "user.geo.country_code",
    USER_GEO_REGION = "user.geo.region",
    USER_GEO_SUBDIVISION = "user.geo.subdivision",
    USER_HASH = "user.hash",
    USER_ID = "user.id",
    USER_IP_ADDRESS = "user.ip_address",
    USER_NAME = "user.name",
    USER_ROLES = "user.roles",
    USER_AGENT_ORIGINAL = "user_agent.original"
}
/**
 * Creates a metadata map with translation function applied to all briefs.
 * @param t - Translation function that takes a string and returns a translated string
 * @returns A record mapping attribute keys to metadata with translated briefs
 */
declare function createAttributeMetadataMap(t: (text: string) => string): Record<string, AttributeMetadata>;
/**
 * A dictionary that maps each attribute's name to its metadata.
 * If a key is not present in this dictionary, it means that attribute is not defined in the Sentry Semantic Conventions.
 */
declare const ATTRIBUTE_METADATA: Record<AttributeName, AttributeMetadata>;
type AttributeValue = string | number | boolean | Array<string> | Array<number> | Array<boolean>;
type Attributes = {
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
    [AI_MODEL_PROVIDER]?: AI_MODEL_PROVIDER_TYPE;
    [AI_MODEL_ID]?: AI_MODEL_ID_TYPE;
    [AI_PIPELINE_NAME]?: AI_PIPELINE_NAME_TYPE;
    [AI_PREAMBLE]?: AI_PREAMBLE_TYPE;
    [AI_PRESENCE_PENALTY]?: AI_PRESENCE_PENALTY_TYPE;
    [AI_PROMPT_TOKENS_USED]?: AI_PROMPT_TOKENS_USED_TYPE;
    [AI_RAW_PROMPTING]?: AI_RAW_PROMPTING_TYPE;
    [AI_RESPONSE_FORMAT]?: AI_RESPONSE_FORMAT_TYPE;
    [AI_RESPONSES]?: AI_RESPONSES_TYPE;
    [AI_SEARCH_QUERIES]?: AI_SEARCH_QUERIES_TYPE;
    [AI_SEARCH_RESULTS]?: AI_SEARCH_RESULTS_TYPE;
    [AI_SEED]?: AI_SEED_TYPE;
    [AI_STREAMING]?: AI_STREAMING_TYPE;
    [AI_TAGS]?: AI_TAGS_TYPE;
    [AI_TEMPERATURE]?: AI_TEMPERATURE_TYPE;
    [AI_TEXTS]?: AI_TEXTS_TYPE;
    [AI_TOOL_CALLS]?: AI_TOOL_CALLS_TYPE;
    [AI_TOOLS]?: AI_TOOLS_TYPE;
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
    [CODE_FILE_PATH]?: CODE_FILE_PATH_TYPE;
    [CODE_FILEPATH]?: CODE_FILEPATH_TYPE;
    [CODE_FUNCTION]?: CODE_FUNCTION_TYPE;
    [CODE_FUNCTION_NAME]?: CODE_FUNCTION_NAME_TYPE;
    [CODE_LINE_NUMBER]?: CODE_LINE_NUMBER_TYPE;
    [CODE_LINENO]?: CODE_LINENO_TYPE;
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
    [HTTP_REQUEST_CONNECT_START]?: HTTP_REQUEST_CONNECT_START_TYPE;
    [HTTP_REQUEST_CONNECTION_END]?: HTTP_REQUEST_CONNECTION_END_TYPE;
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
    [HTTP_RESPONSE_HEADER_KEY]?: HTTP_RESPONSE_HEADER_KEY_TYPE;
    [HTTP_RESPONSE_HEADER_CONTENT_LENGTH]?: HTTP_RESPONSE_HEADER_CONTENT_LENGTH_TYPE;
    [HTTP_RESPONSE_SIZE]?: HTTP_RESPONSE_SIZE_TYPE;
    [HTTP_RESPONSE_STATUS_CODE]?: HTTP_RESPONSE_STATUS_CODE_TYPE;
    [HTTP_RESPONSE_CONTENT_LENGTH]?: HTTP_RESPONSE_CONTENT_LENGTH_TYPE;
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
    [NETWORK_LOCAL_ADDRESS]?: NETWORK_LOCAL_ADDRESS_TYPE;
    [NETWORK_LOCAL_PORT]?: NETWORK_LOCAL_PORT_TYPE;
    [NETWORK_PEER_ADDRESS]?: NETWORK_PEER_ADDRESS_TYPE;
    [NETWORK_PEER_PORT]?: NETWORK_PEER_PORT_TYPE;
    [NETWORK_PROTOCOL_NAME]?: NETWORK_PROTOCOL_NAME_TYPE;
    [NETWORK_PROTOCOL_VERSION]?: NETWORK_PROTOCOL_VERSION_TYPE;
    [NETWORK_TRANSPORT]?: NETWORK_TRANSPORT_TYPE;
    [NETWORK_TYPE]?: NETWORK_TYPE_TYPE;
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
    [SENTRY_INTERNAL_DSC_ENVIRONMENT]?: SENTRY_INTERNAL_DSC_ENVIRONMENT_TYPE;
    [SENTRY_INTERNAL_DSC_ORG_ID]?: SENTRY_INTERNAL_DSC_ORG_ID_TYPE;
    [SENTRY_INTERNAL_DSC_PUBLIC_KEY]?: SENTRY_INTERNAL_DSC_PUBLIC_KEY_TYPE;
    [SENTRY_INTERNAL_DSC_RELEASE]?: SENTRY_INTERNAL_DSC_RELEASE_TYPE;
    [SENTRY_INTERNAL_DSC_SAMPLE_RAND]?: SENTRY_INTERNAL_DSC_SAMPLE_RAND_TYPE;
    [SENTRY_INTERNAL_DSC_SAMPLE_RATE]?: SENTRY_INTERNAL_DSC_SAMPLE_RATE_TYPE;
    [SENTRY_INTERNAL_DSC_SAMPLED]?: SENTRY_INTERNAL_DSC_SAMPLED_TYPE;
    [SENTRY_INTERNAL_DSC_TRACE_ID]?: SENTRY_INTERNAL_DSC_TRACE_ID_TYPE;
    [SENTRY_INTERNAL_DSC_TRANSACTION]?: SENTRY_INTERNAL_DSC_TRANSACTION_TYPE;
    [SENTRY_INTERNAL_OBSERVED_TIMESTAMP_NANOS]?: SENTRY_INTERNAL_OBSERVED_TIMESTAMP_NANOS_TYPE;
    [SENTRY_INTERNAL_SEGMENT_CONTAINS_GEN_AI_SPANS]?: SENTRY_INTERNAL_SEGMENT_CONTAINS_GEN_AI_SPANS_TYPE;
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
    [_SENTRY_SEGMENT_ID]?: _SENTRY_SEGMENT_ID_TYPE;
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
    [URL_DOMAIN]?: URL_DOMAIN_TYPE;
    [URL_FRAGMENT]?: URL_FRAGMENT_TYPE;
    [URL_FULL]?: URL_FULL_TYPE;
    [URL_PATH]?: URL_PATH_TYPE;
    [URL_PATH_PARAMETER_KEY]?: URL_PATH_PARAMETER_KEY_TYPE;
    [URL_PORT]?: URL_PORT_TYPE;
    [URL_QUERY]?: URL_QUERY_TYPE;
    [URL_SCHEME]?: URL_SCHEME_TYPE;
    [URL_TEMPLATE]?: URL_TEMPLATE_TYPE;
    [URL]?: URL_TYPE;
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
    [USER_AGENT_ORIGINAL]?: USER_AGENT_ORIGINAL_TYPE;
} & Record<string, AttributeValue | undefined>;

export { AI_CITATIONS, AI_COMPLETION_TOKENS_USED, AI_DOCUMENTS, AI_FINISH_REASON, AI_FREQUENCY_PENALTY, AI_FUNCTION_CALL, AI_GENERATION_ID, AI_INPUT_MESSAGES, AI_IS_SEARCH_REQUIRED, AI_METADATA, AI_MODEL_ID, AI_MODEL_PROVIDER, AI_PIPELINE_NAME, AI_PREAMBLE, AI_PRESENCE_PENALTY, AI_PROMPT_TOKENS_USED, AI_RAW_PROMPTING, AI_RESPONSES, AI_RESPONSE_FORMAT, AI_SEARCH_QUERIES, AI_SEARCH_RESULTS, AI_SEED, AI_STREAMING, AI_TAGS, AI_TEMPERATURE, AI_TEXTS, AI_TOOLS, AI_TOOL_CALLS, AI_TOP_K, AI_TOP_P, AI_TOTAL_COST, AI_TOTAL_TOKENS_USED, AI_WARNINGS, APP_START_TYPE, ATTRIBUTE_METADATA, AttributeName, AttributeType, BLOCKED_MAIN_THREAD, BROWSER_NAME, BROWSER_REPORT_TYPE, BROWSER_SCRIPT_INVOKER, BROWSER_SCRIPT_INVOKER_TYPE, BROWSER_SCRIPT_SOURCE_CHAR_POSITION, BROWSER_VERSION, CACHE_HIT, CACHE_ITEM_SIZE, CACHE_KEY, CACHE_OPERATION, CACHE_TTL, CHANNEL, CLIENT_ADDRESS, CLIENT_PORT, CLOUDFLARE_D1_DURATION, CLOUDFLARE_D1_ROWS_READ, CLOUDFLARE_D1_ROWS_WRITTEN, CODE_FILEPATH, CODE_FILE_PATH, CODE_FUNCTION, CODE_FUNCTION_NAME, CODE_LINENO, CODE_LINE_NUMBER, CODE_NAMESPACE, DB_COLLECTION_NAME, DB_NAME, DB_NAMESPACE, DB_OPERATION, DB_OPERATION_NAME, DB_QUERY_PARAMETER_KEY, DB_QUERY_SUMMARY, DB_QUERY_TEXT, DB_REDIS_CONNECTION, DB_REDIS_PARAMETERS, DB_SQL_BINDINGS, DB_STATEMENT, DB_SYSTEM, DB_SYSTEM_NAME, DB_USER, DEVICE_BRAND, DEVICE_FAMILY, DEVICE_MODEL, DeprecationStatus, ENVIRONMENT, ERROR_TYPE, EVENT_ID, EVENT_NAME, EXCEPTION_ESCAPED, EXCEPTION_MESSAGE, EXCEPTION_STACKTRACE, EXCEPTION_TYPE, FAAS_COLDSTART, FAAS_CRON, FAAS_TIME, FAAS_TRIGGER, FLAG_EVALUATION_KEY, FRAMES_DELAY, FRAMES_FROZEN, FRAMES_SLOW, FRAMES_TOTAL, FS_ERROR, GEN_AI_AGENT_NAME, GEN_AI_ASSISTANT_MESSAGE, GEN_AI_CHOICE, GEN_AI_COST_INPUT_TOKENS, GEN_AI_COST_OUTPUT_TOKENS, GEN_AI_COST_TOTAL_TOKENS, GEN_AI_OPERATION_NAME, GEN_AI_OPERATION_TYPE, GEN_AI_PIPELINE_NAME, GEN_AI_PROMPT, GEN_AI_REQUEST_AVAILABLE_TOOLS, GEN_AI_REQUEST_FREQUENCY_PENALTY, GEN_AI_REQUEST_MAX_TOKENS, GEN_AI_REQUEST_MESSAGES, GEN_AI_REQUEST_MODEL, GEN_AI_REQUEST_PRESENCE_PENALTY, GEN_AI_REQUEST_SEED, GEN_AI_REQUEST_TEMPERATURE, GEN_AI_REQUEST_TOP_K, GEN_AI_REQUEST_TOP_P, GEN_AI_RESPONSE_FINISH_REASONS, GEN_AI_RESPONSE_ID, GEN_AI_RESPONSE_MODEL, GEN_AI_RESPONSE_STREAMING, GEN_AI_RESPONSE_TEXT, GEN_AI_RESPONSE_TOKENS_PER_SECOND, GEN_AI_RESPONSE_TOOL_CALLS, GEN_AI_SYSTEM, GEN_AI_SYSTEM_MESSAGE, GEN_AI_TOOL_DESCRIPTION, GEN_AI_TOOL_INPUT, GEN_AI_TOOL_MESSAGE, GEN_AI_TOOL_NAME, GEN_AI_TOOL_OUTPUT, GEN_AI_TOOL_TYPE, GEN_AI_USAGE_COMPLETION_TOKENS, GEN_AI_USAGE_INPUT_TOKENS, GEN_AI_USAGE_INPUT_TOKENS_CACHED, GEN_AI_USAGE_OUTPUT_TOKENS, GEN_AI_USAGE_OUTPUT_TOKENS_REASONING, GEN_AI_USAGE_PROMPT_TOKENS, GEN_AI_USAGE_TOTAL_COST, GEN_AI_USAGE_TOTAL_TOKENS, GEN_AI_USER_MESSAGE, GRAPHQL_OPERATION_NAME, GRAPHQL_OPERATION_TYPE, HTTP_CLIENT_IP, HTTP_DECODED_RESPONSE_CONTENT_LENGTH, HTTP_FLAVOR, HTTP_FRAGMENT, HTTP_HOST, HTTP_METHOD, HTTP_QUERY, HTTP_REQUEST_CONNECTION_END, HTTP_REQUEST_CONNECT_START, HTTP_REQUEST_DOMAIN_LOOKUP_END, HTTP_REQUEST_DOMAIN_LOOKUP_START, HTTP_REQUEST_FETCH_START, HTTP_REQUEST_HEADER_KEY, HTTP_REQUEST_METHOD, HTTP_REQUEST_REDIRECT_END, HTTP_REQUEST_REDIRECT_START, HTTP_REQUEST_REQUEST_START, HTTP_REQUEST_RESEND_COUNT, HTTP_REQUEST_RESPONSE_END, HTTP_REQUEST_RESPONSE_START, HTTP_REQUEST_SECURE_CONNECTION_START, HTTP_REQUEST_TIME_TO_FIRST_BYTE, HTTP_REQUEST_WORKER_START, HTTP_RESPONSE_BODY_SIZE, HTTP_RESPONSE_CONTENT_LENGTH, HTTP_RESPONSE_HEADER_CONTENT_LENGTH, HTTP_RESPONSE_HEADER_KEY, HTTP_RESPONSE_SIZE, HTTP_RESPONSE_STATUS_CODE, HTTP_RESPONSE_TRANSFER_SIZE, HTTP_ROUTE, HTTP_SCHEME, HTTP_SERVER_NAME, HTTP_STATUS_CODE, HTTP_TARGET, HTTP_URL, HTTP_USER_AGENT, ID, IsPii, JVM_GC_ACTION, JVM_GC_NAME, JVM_MEMORY_POOL_NAME, JVM_MEMORY_TYPE, JVM_THREAD_DAEMON, JVM_THREAD_STATE, LCP_ELEMENT, LCP_ID, LCP_SIZE, LCP_URL, LOGGER_NAME, MESSAGING_DESTINATION_CONNECTION, MESSAGING_DESTINATION_NAME, MESSAGING_MESSAGE_BODY_SIZE, MESSAGING_MESSAGE_ENVELOPE_SIZE, MESSAGING_MESSAGE_ID, MESSAGING_MESSAGE_RECEIVE_LATENCY, MESSAGING_MESSAGE_RETRY_COUNT, MESSAGING_OPERATION_TYPE, MESSAGING_SYSTEM, METHOD, NAVIGATION_TYPE, NEL_ELAPSED_TIME, NEL_PHASE, NEL_REFERRER, NEL_SAMPLING_FUNCTION, NEL_TYPE, NETWORK_LOCAL_ADDRESS, NETWORK_LOCAL_PORT, NETWORK_PEER_ADDRESS, NETWORK_PEER_PORT, NETWORK_PROTOCOL_NAME, NETWORK_PROTOCOL_VERSION, NETWORK_TRANSPORT, NETWORK_TYPE, NET_HOST_IP, NET_HOST_NAME, NET_HOST_PORT, NET_PEER_IP, NET_PEER_NAME, NET_PEER_PORT, NET_PROTOCOL_NAME, NET_PROTOCOL_VERSION, NET_SOCK_FAMILY, NET_SOCK_HOST_ADDR, NET_SOCK_HOST_PORT, NET_SOCK_PEER_ADDR, NET_SOCK_PEER_NAME, NET_SOCK_PEER_PORT, NET_TRANSPORT, OS_BUILD_ID, OS_DESCRIPTION, OS_NAME, OS_TYPE, OS_VERSION, OTEL_SCOPE_NAME, OTEL_SCOPE_VERSION, OTEL_STATUS_CODE, OTEL_STATUS_DESCRIPTION, PARAMS_KEY, PREVIOUS_ROUTE, PROCESS_EXECUTABLE_NAME, PROCESS_PID, PROCESS_RUNTIME_DESCRIPTION, PROCESS_RUNTIME_NAME, PROCESS_RUNTIME_VERSION, PROFILE_ID, QUERY_KEY, RELEASE, REMIX_ACTION_FORM_DATA_KEY, REPLAY_ID, RESOURCE_RENDER_BLOCKING_STATUS, ROUTE, RPC_GRPC_STATUS_CODE, RPC_SERVICE, SENTRY_BROWSER_NAME, SENTRY_BROWSER_VERSION, SENTRY_CANCELLATION_REASON, SENTRY_CLIENT_SAMPLE_RATE, SENTRY_DESCRIPTION, SENTRY_DIST, SENTRY_ENVIRONMENT, SENTRY_EXCLUSIVE_TIME, SENTRY_HTTP_PREFETCH, SENTRY_IDLE_SPAN_FINISH_REASON, SENTRY_INTERNAL_DSC_ENVIRONMENT, SENTRY_INTERNAL_DSC_ORG_ID, SENTRY_INTERNAL_DSC_PUBLIC_KEY, SENTRY_INTERNAL_DSC_RELEASE, SENTRY_INTERNAL_DSC_SAMPLED, SENTRY_INTERNAL_DSC_SAMPLE_RAND, SENTRY_INTERNAL_DSC_SAMPLE_RATE, SENTRY_INTERNAL_DSC_TRACE_ID, SENTRY_INTERNAL_DSC_TRANSACTION, SENTRY_INTERNAL_OBSERVED_TIMESTAMP_NANOS, SENTRY_INTERNAL_SEGMENT_CONTAINS_GEN_AI_SPANS, SENTRY_MESSAGE_PARAMETER_KEY, SENTRY_MESSAGE_TEMPLATE, SENTRY_MODULE_KEY, SENTRY_NEXTJS_SSR_FUNCTION_ROUTE, SENTRY_NEXTJS_SSR_FUNCTION_TYPE, SENTRY_OBSERVED_TIMESTAMP_NANOS, SENTRY_OP, SENTRY_ORIGIN, SENTRY_PLATFORM, SENTRY_PROFILE_ID, SENTRY_RELEASE, SENTRY_REPLAY_ID, SENTRY_SDK_INTEGRATIONS, SENTRY_SDK_NAME, SENTRY_SDK_VERSION, SENTRY_SEGMENT_ID, SENTRY_SEGMENT_NAME, SENTRY_SERVER_SAMPLE_RATE, SENTRY_SPAN_SOURCE, SENTRY_TRACE_PARENT_SPAN_ID, SENTRY_TRANSACTION, SERVER_ADDRESS, SERVER_PORT, SERVICE_NAME, SERVICE_VERSION, THREAD_ID, THREAD_NAME, TRANSACTION, TYPE, UI_COMPONENT_NAME, UI_CONTRIBUTES_TO_TTFD, UI_CONTRIBUTES_TO_TTID, URL, URL_DOMAIN, URL_FRAGMENT, URL_FULL, URL_PATH, URL_PATH_PARAMETER_KEY, URL_PORT, URL_QUERY, URL_SCHEME, URL_TEMPLATE, USER_AGENT_ORIGINAL, USER_EMAIL, USER_FULL_NAME, USER_GEO_CITY, USER_GEO_COUNTRY_CODE, USER_GEO_REGION, USER_GEO_SUBDIVISION, USER_HASH, USER_ID, USER_IP_ADDRESS, USER_NAME, USER_ROLES, _SENTRY_SEGMENT_ID, createAttributeMetadataMap };
export type { AI_CITATIONS_TYPE, AI_COMPLETION_TOKENS_USED_TYPE, AI_DOCUMENTS_TYPE, AI_FINISH_REASON_TYPE, AI_FREQUENCY_PENALTY_TYPE, AI_FUNCTION_CALL_TYPE, AI_GENERATION_ID_TYPE, AI_INPUT_MESSAGES_TYPE, AI_IS_SEARCH_REQUIRED_TYPE, AI_METADATA_TYPE, AI_MODEL_ID_TYPE, AI_MODEL_PROVIDER_TYPE, AI_PIPELINE_NAME_TYPE, AI_PREAMBLE_TYPE, AI_PRESENCE_PENALTY_TYPE, AI_PROMPT_TOKENS_USED_TYPE, AI_RAW_PROMPTING_TYPE, AI_RESPONSES_TYPE, AI_RESPONSE_FORMAT_TYPE, AI_SEARCH_QUERIES_TYPE, AI_SEARCH_RESULTS_TYPE, AI_SEED_TYPE, AI_STREAMING_TYPE, AI_TAGS_TYPE, AI_TEMPERATURE_TYPE, AI_TEXTS_TYPE, AI_TOOLS_TYPE, AI_TOOL_CALLS_TYPE, AI_TOP_K_TYPE, AI_TOP_P_TYPE, AI_TOTAL_COST_TYPE, AI_TOTAL_TOKENS_USED_TYPE, AI_WARNINGS_TYPE, APP_START_TYPE_TYPE, AttributeMetadata, AttributeValue, Attributes, BLOCKED_MAIN_THREAD_TYPE, BROWSER_NAME_TYPE, BROWSER_REPORT_TYPE_TYPE, BROWSER_SCRIPT_INVOKER_TYPE_TYPE, BROWSER_SCRIPT_SOURCE_CHAR_POSITION_TYPE, BROWSER_VERSION_TYPE, CACHE_HIT_TYPE, CACHE_ITEM_SIZE_TYPE, CACHE_KEY_TYPE, CACHE_OPERATION_TYPE, CACHE_TTL_TYPE, CHANNEL_TYPE, CLIENT_ADDRESS_TYPE, CLIENT_PORT_TYPE, CLOUDFLARE_D1_DURATION_TYPE, CLOUDFLARE_D1_ROWS_READ_TYPE, CLOUDFLARE_D1_ROWS_WRITTEN_TYPE, CODE_FILEPATH_TYPE, CODE_FILE_PATH_TYPE, CODE_FUNCTION_NAME_TYPE, CODE_FUNCTION_TYPE, CODE_LINENO_TYPE, CODE_LINE_NUMBER_TYPE, CODE_NAMESPACE_TYPE, DB_COLLECTION_NAME_TYPE, DB_NAMESPACE_TYPE, DB_NAME_TYPE, DB_OPERATION_NAME_TYPE, DB_OPERATION_TYPE, DB_QUERY_PARAMETER_KEY_TYPE, DB_QUERY_SUMMARY_TYPE, DB_QUERY_TEXT_TYPE, DB_REDIS_CONNECTION_TYPE, DB_REDIS_PARAMETERS_TYPE, DB_SQL_BINDINGS_TYPE, DB_STATEMENT_TYPE, DB_SYSTEM_NAME_TYPE, DB_SYSTEM_TYPE, DB_USER_TYPE, DEVICE_BRAND_TYPE, DEVICE_FAMILY_TYPE, DEVICE_MODEL_TYPE, DeprecationInfo, ENVIRONMENT_TYPE, ERROR_TYPE_TYPE, EVENT_ID_TYPE, EVENT_NAME_TYPE, EXCEPTION_ESCAPED_TYPE, EXCEPTION_MESSAGE_TYPE, EXCEPTION_STACKTRACE_TYPE, EXCEPTION_TYPE_TYPE, FAAS_COLDSTART_TYPE, FAAS_CRON_TYPE, FAAS_TIME_TYPE, FAAS_TRIGGER_TYPE, FLAG_EVALUATION_KEY_TYPE, FRAMES_DELAY_TYPE, FRAMES_FROZEN_TYPE, FRAMES_SLOW_TYPE, FRAMES_TOTAL_TYPE, FS_ERROR_TYPE, GEN_AI_AGENT_NAME_TYPE, GEN_AI_ASSISTANT_MESSAGE_TYPE, GEN_AI_CHOICE_TYPE, GEN_AI_COST_INPUT_TOKENS_TYPE, GEN_AI_COST_OUTPUT_TOKENS_TYPE, GEN_AI_COST_TOTAL_TOKENS_TYPE, GEN_AI_OPERATION_NAME_TYPE, GEN_AI_OPERATION_TYPE_TYPE, GEN_AI_PIPELINE_NAME_TYPE, GEN_AI_PROMPT_TYPE, GEN_AI_REQUEST_AVAILABLE_TOOLS_TYPE, GEN_AI_REQUEST_FREQUENCY_PENALTY_TYPE, GEN_AI_REQUEST_MAX_TOKENS_TYPE, GEN_AI_REQUEST_MESSAGES_TYPE, GEN_AI_REQUEST_MODEL_TYPE, GEN_AI_REQUEST_PRESENCE_PENALTY_TYPE, GEN_AI_REQUEST_SEED_TYPE, GEN_AI_REQUEST_TEMPERATURE_TYPE, GEN_AI_REQUEST_TOP_K_TYPE, GEN_AI_REQUEST_TOP_P_TYPE, GEN_AI_RESPONSE_FINISH_REASONS_TYPE, GEN_AI_RESPONSE_ID_TYPE, GEN_AI_RESPONSE_MODEL_TYPE, GEN_AI_RESPONSE_STREAMING_TYPE, GEN_AI_RESPONSE_TEXT_TYPE, GEN_AI_RESPONSE_TOKENS_PER_SECOND_TYPE, GEN_AI_RESPONSE_TOOL_CALLS_TYPE, GEN_AI_SYSTEM_MESSAGE_TYPE, GEN_AI_SYSTEM_TYPE, GEN_AI_TOOL_DESCRIPTION_TYPE, GEN_AI_TOOL_INPUT_TYPE, GEN_AI_TOOL_MESSAGE_TYPE, GEN_AI_TOOL_NAME_TYPE, GEN_AI_TOOL_OUTPUT_TYPE, GEN_AI_TOOL_TYPE_TYPE, GEN_AI_USAGE_COMPLETION_TOKENS_TYPE, GEN_AI_USAGE_INPUT_TOKENS_CACHED_TYPE, GEN_AI_USAGE_INPUT_TOKENS_TYPE, GEN_AI_USAGE_OUTPUT_TOKENS_REASONING_TYPE, GEN_AI_USAGE_OUTPUT_TOKENS_TYPE, GEN_AI_USAGE_PROMPT_TOKENS_TYPE, GEN_AI_USAGE_TOTAL_COST_TYPE, GEN_AI_USAGE_TOTAL_TOKENS_TYPE, GEN_AI_USER_MESSAGE_TYPE, GRAPHQL_OPERATION_NAME_TYPE, GRAPHQL_OPERATION_TYPE_TYPE, HTTP_CLIENT_IP_TYPE, HTTP_DECODED_RESPONSE_CONTENT_LENGTH_TYPE, HTTP_FLAVOR_TYPE, HTTP_FRAGMENT_TYPE, HTTP_HOST_TYPE, HTTP_METHOD_TYPE, HTTP_QUERY_TYPE, HTTP_REQUEST_CONNECTION_END_TYPE, HTTP_REQUEST_CONNECT_START_TYPE, HTTP_REQUEST_DOMAIN_LOOKUP_END_TYPE, HTTP_REQUEST_DOMAIN_LOOKUP_START_TYPE, HTTP_REQUEST_FETCH_START_TYPE, HTTP_REQUEST_HEADER_KEY_TYPE, HTTP_REQUEST_METHOD_TYPE, HTTP_REQUEST_REDIRECT_END_TYPE, HTTP_REQUEST_REDIRECT_START_TYPE, HTTP_REQUEST_REQUEST_START_TYPE, HTTP_REQUEST_RESEND_COUNT_TYPE, HTTP_REQUEST_RESPONSE_END_TYPE, HTTP_REQUEST_RESPONSE_START_TYPE, HTTP_REQUEST_SECURE_CONNECTION_START_TYPE, HTTP_REQUEST_TIME_TO_FIRST_BYTE_TYPE, HTTP_REQUEST_WORKER_START_TYPE, HTTP_RESPONSE_BODY_SIZE_TYPE, HTTP_RESPONSE_CONTENT_LENGTH_TYPE, HTTP_RESPONSE_HEADER_CONTENT_LENGTH_TYPE, HTTP_RESPONSE_HEADER_KEY_TYPE, HTTP_RESPONSE_SIZE_TYPE, HTTP_RESPONSE_STATUS_CODE_TYPE, HTTP_RESPONSE_TRANSFER_SIZE_TYPE, HTTP_ROUTE_TYPE, HTTP_SCHEME_TYPE, HTTP_SERVER_NAME_TYPE, HTTP_STATUS_CODE_TYPE, HTTP_TARGET_TYPE, HTTP_URL_TYPE, HTTP_USER_AGENT_TYPE, ID_TYPE, JVM_GC_ACTION_TYPE, JVM_GC_NAME_TYPE, JVM_MEMORY_POOL_NAME_TYPE, JVM_MEMORY_TYPE_TYPE, JVM_THREAD_DAEMON_TYPE, JVM_THREAD_STATE_TYPE, LCP_ELEMENT_TYPE, LCP_ID_TYPE, LCP_SIZE_TYPE, LCP_URL_TYPE, LOGGER_NAME_TYPE, MESSAGING_DESTINATION_CONNECTION_TYPE, MESSAGING_DESTINATION_NAME_TYPE, MESSAGING_MESSAGE_BODY_SIZE_TYPE, MESSAGING_MESSAGE_ENVELOPE_SIZE_TYPE, MESSAGING_MESSAGE_ID_TYPE, MESSAGING_MESSAGE_RECEIVE_LATENCY_TYPE, MESSAGING_MESSAGE_RETRY_COUNT_TYPE, MESSAGING_OPERATION_TYPE_TYPE, MESSAGING_SYSTEM_TYPE, METHOD_TYPE, NAVIGATION_TYPE_TYPE, NEL_ELAPSED_TIME_TYPE, NEL_PHASE_TYPE, NEL_REFERRER_TYPE, NEL_SAMPLING_FUNCTION_TYPE, NEL_TYPE_TYPE, NETWORK_LOCAL_ADDRESS_TYPE, NETWORK_LOCAL_PORT_TYPE, NETWORK_PEER_ADDRESS_TYPE, NETWORK_PEER_PORT_TYPE, NETWORK_PROTOCOL_NAME_TYPE, NETWORK_PROTOCOL_VERSION_TYPE, NETWORK_TRANSPORT_TYPE, NETWORK_TYPE_TYPE, NET_HOST_IP_TYPE, NET_HOST_NAME_TYPE, NET_HOST_PORT_TYPE, NET_PEER_IP_TYPE, NET_PEER_NAME_TYPE, NET_PEER_PORT_TYPE, NET_PROTOCOL_NAME_TYPE, NET_PROTOCOL_VERSION_TYPE, NET_SOCK_FAMILY_TYPE, NET_SOCK_HOST_ADDR_TYPE, NET_SOCK_HOST_PORT_TYPE, NET_SOCK_PEER_ADDR_TYPE, NET_SOCK_PEER_NAME_TYPE, NET_SOCK_PEER_PORT_TYPE, NET_TRANSPORT_TYPE, OS_BUILD_ID_TYPE, OS_DESCRIPTION_TYPE, OS_NAME_TYPE, OS_TYPE_TYPE, OS_VERSION_TYPE, OTEL_SCOPE_NAME_TYPE, OTEL_SCOPE_VERSION_TYPE, OTEL_STATUS_CODE_TYPE, OTEL_STATUS_DESCRIPTION_TYPE, PARAMS_KEY_TYPE, PREVIOUS_ROUTE_TYPE, PROCESS_EXECUTABLE_NAME_TYPE, PROCESS_PID_TYPE, PROCESS_RUNTIME_DESCRIPTION_TYPE, PROCESS_RUNTIME_NAME_TYPE, PROCESS_RUNTIME_VERSION_TYPE, PROFILE_ID_TYPE, PiiInfo, QUERY_KEY_TYPE, RELEASE_TYPE, REMIX_ACTION_FORM_DATA_KEY_TYPE, REPLAY_ID_TYPE, RESOURCE_RENDER_BLOCKING_STATUS_TYPE, ROUTE_TYPE, RPC_GRPC_STATUS_CODE_TYPE, RPC_SERVICE_TYPE, SENTRY_BROWSER_NAME_TYPE, SENTRY_BROWSER_VERSION_TYPE, SENTRY_CANCELLATION_REASON_TYPE, SENTRY_CLIENT_SAMPLE_RATE_TYPE, SENTRY_DESCRIPTION_TYPE, SENTRY_DIST_TYPE, SENTRY_ENVIRONMENT_TYPE, SENTRY_EXCLUSIVE_TIME_TYPE, SENTRY_HTTP_PREFETCH_TYPE, SENTRY_IDLE_SPAN_FINISH_REASON_TYPE, SENTRY_INTERNAL_DSC_ENVIRONMENT_TYPE, SENTRY_INTERNAL_DSC_ORG_ID_TYPE, SENTRY_INTERNAL_DSC_PUBLIC_KEY_TYPE, SENTRY_INTERNAL_DSC_RELEASE_TYPE, SENTRY_INTERNAL_DSC_SAMPLED_TYPE, SENTRY_INTERNAL_DSC_SAMPLE_RAND_TYPE, SENTRY_INTERNAL_DSC_SAMPLE_RATE_TYPE, SENTRY_INTERNAL_DSC_TRACE_ID_TYPE, SENTRY_INTERNAL_DSC_TRANSACTION_TYPE, SENTRY_INTERNAL_OBSERVED_TIMESTAMP_NANOS_TYPE, SENTRY_INTERNAL_SEGMENT_CONTAINS_GEN_AI_SPANS_TYPE, SENTRY_MESSAGE_PARAMETER_KEY_TYPE, SENTRY_MESSAGE_TEMPLATE_TYPE, SENTRY_MODULE_KEY_TYPE, SENTRY_NEXTJS_SSR_FUNCTION_ROUTE_TYPE, SENTRY_NEXTJS_SSR_FUNCTION_TYPE_TYPE, SENTRY_OBSERVED_TIMESTAMP_NANOS_TYPE, SENTRY_OP_TYPE, SENTRY_ORIGIN_TYPE, SENTRY_PLATFORM_TYPE, SENTRY_PROFILE_ID_TYPE, SENTRY_RELEASE_TYPE, SENTRY_REPLAY_ID_TYPE, SENTRY_SDK_INTEGRATIONS_TYPE, SENTRY_SDK_NAME_TYPE, SENTRY_SDK_VERSION_TYPE, SENTRY_SEGMENT_ID_TYPE, SENTRY_SEGMENT_NAME_TYPE, SENTRY_SERVER_SAMPLE_RATE_TYPE, SENTRY_SPAN_SOURCE_TYPE, SENTRY_TRACE_PARENT_SPAN_ID_TYPE, SENTRY_TRANSACTION_TYPE, SERVER_ADDRESS_TYPE, SERVER_PORT_TYPE, SERVICE_NAME_TYPE, SERVICE_VERSION_TYPE, THREAD_ID_TYPE, THREAD_NAME_TYPE, TRANSACTION_TYPE, TYPE_TYPE, UI_COMPONENT_NAME_TYPE, UI_CONTRIBUTES_TO_TTFD_TYPE, UI_CONTRIBUTES_TO_TTID_TYPE, URL_DOMAIN_TYPE, URL_FRAGMENT_TYPE, URL_FULL_TYPE, URL_PATH_PARAMETER_KEY_TYPE, URL_PATH_TYPE, URL_PORT_TYPE, URL_QUERY_TYPE, URL_SCHEME_TYPE, URL_TEMPLATE_TYPE, URL_TYPE, USER_AGENT_ORIGINAL_TYPE, USER_EMAIL_TYPE, USER_FULL_NAME_TYPE, USER_GEO_CITY_TYPE, USER_GEO_COUNTRY_CODE_TYPE, USER_GEO_REGION_TYPE, USER_GEO_SUBDIVISION_TYPE, USER_HASH_TYPE, USER_ID_TYPE, USER_IP_ADDRESS_TYPE, USER_NAME_TYPE, USER_ROLES_TYPE, _SENTRY_SEGMENT_ID_TYPE };
