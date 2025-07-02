from typing import NotRequired, Required, TypedDict

from sentry.utils.cache import cache

type ModelId = str


class AIModelCost(TypedDict):
    modelId: str
    forCompletion: bool
    costPer1kTokens: float


# Cache key for storing AI model costs
AI_MODEL_COSTS_CACHE_KEY = "ai-model-costs:v2"
# Cache timeout: 30 days (we re-fetch every 30 minutes, so this provides more than enough overlap)
AI_MODEL_COSTS_CACHE_TTL = 30 * 24 * 60 * 60


class AIModelCostV2(TypedDict):
    inputPerToken: float
    outputPerToken: float
    outputReasoningPerToken: float
    inputCachedPerToken: float


class AIModelCosts(TypedDict, total=False):
    version: Required[int]
    costs: NotRequired[list[AIModelCost]]
    models: NotRequired[dict[ModelId, AIModelCostV2]]


_AI_MODEL_COST_DATA = [
    # GPT-4.1 input
    ("gpt-4.1", False, 0.002),
    ("gpt-4.1-2025-04-14", False, 0.002),
    ("gpt-4.1-cached", False, 0.0005),
    ("gpt-4.1-2025-04-14-cached", False, 0.0005),
    # GPT-4.1 output
    ("gpt-4.1", True, 0.008),
    ("gpt-4.1-2025-04-14", True, 0.008),
    # GPT-4.1-mini input
    # GPT-4.1-mini input
    ("gpt-4.1-mini", False, 0.0004),
    ("gpt-4.1-mini-2025-04-14", False, 0.0004),
    ("gpt-4.1-mini-cached", False, 0.0001),
    ("gpt-4.1-mini-2025-04-14-cached", False, 0.0001),
    # GPT-4.1-mini output
    ("gpt-4.1-mini", True, 0.0016),
    ("gpt-4.1-mini-2025-04-14", True, 0.0016),
    # GPT-4.1-nano input
    ("gpt-4.1-nano", False, 0.0001),
    ("gpt-4.1-nano-2025-04-14", False, 0.0001),
    ("gpt-4.1-nano-cached", False, 0.000025),
    ("gpt-4.1-nano-2025-04-14-cached", False, 0.000025),
    # GPT-4.1-nano output
    ("gpt-4.1-nano", True, 0.0004),
    ("gpt-4.1-nano-2025-04-14", True, 0.0004),
    # GPT-4.5-preview input
    ("gpt-4.5-preview", False, 0.075),
    ("gpt-4.5-preview-2025-02-27", False, 0.075),
    ("gpt-4.5-preview-cached", False, 0.0375),
    ("gpt-4.5-preview-2025-02-27-cached", False, 0.0375),
    # GPT-4.5-preview output
    ("gpt-4.5-preview", True, 0.15),
    ("gpt-4.5-preview-2025-02-27", True, 0.15),
    # OpenAI o1 input
    ("o1", False, 0.015),
    ("o1-2024-12-17", False, 0.015),
    ("o1-cached", False, 0.0075),
    ("o1-2024-12-17-cached", False, 0.0075),
    # OpenAI o1 output
    ("o1", True, 0.06),
    ("o1-2024-12-17", True, 0.06),
    # OpenAI o1-pro input
    ("o1-pro", False, 0.15),
    ("o1-pro-2025-03-19", False, 0.15),
    # OpenAI o1-pro output
    ("o1-pro", True, 0.6),
    ("o1-pro-2025-03-19", True, 0.6),
    # OpenAI o3 input
    ("o3", False, 0.01),
    ("o3-2025-04-16", False, 0.01),
    ("o3-cached", False, 0.0025),
    ("o3-2025-04-16-cached", False, 0.0025),
    # OpenAI o3 output
    ("o3", True, 0.04),
    ("o3-2025-04-16", True, 0.04),
    # OpenAI o4-mini input
    ("o4-mini", False, 0.0011),
    ("o4-mini-2025-04-16", False, 0.0011),
    ("o4-mini-cached", False, 0.000275),
    ("o4-mini-2025-04-16-cached", False, 0.000275),
    # OpenAI o4-mini output
    ("o4-mini", True, 0.0044),
    ("o4-mini-2025-04-16", True, 0.0044),
    # OpenAI o3-mini input
    ("o3-mini", False, 0.0011),
    ("o3-mini-2025-01-31", False, 0.0011),
    ("o3-mini-cached", False, 0.00055),
    ("o3-mini-2025-01-31-cached", False, 0.00055),
    # OpenAI o3-mini output
    ("o3-mini", True, 0.0044),
    ("o3-mini-2025-01-31", True, 0.0044),
    # OpenAI o1-mini input (updated pricing)
    ("o1-mini", False, 0.0011),
    ("o1-mini-cached", False, 0.00055),
    ("o1-mini-2024-09-12", False, 0.0011),
    ("o1-mini-2024-09-12-cached", False, 0.00055),
    # OpenAI o1-mini output (updated pricing)
    ("o1-mini", True, 0.0044),
    ("o1-mini-2024-09-12", True, 0.0044),
    # OpenAI o1-preview input
    ("o1-preview", False, 0.015),
    ("o1-preview-cached", False, 0.0075),
    ("o1-preview-2024-09-12", False, 0.015),
    ("o1-preview-2024-09-12-cached", False, 0.0075),
    # OpenAI o1-preview output
    ("o1-preview", True, 0.06),
    ("o1-preview-2024-09-12", True, 0.06),
    # GPT-4o input
    ("gpt-4o", False, 0.0025),
    ("gpt-4o-cached", False, 0.00125),
    ("gpt-4o-2024-05-13", False, 0.005),
    ("gpt-4o-2024-08-06", False, 0.0025),
    ("gpt-4o-2024-08-06-cached", False, 0.00125),
    ("gpt-4o-2024-11-20", False, 0.0025),
    ("gpt-4o-2024-11-20-cached", False, 0.00125),
    # GPT-4o output
    ("gpt-4o", True, 0.01),
    ("gpt-4o-2024-05-13", True, 0.015),
    ("gpt-4o-2024-08-06", True, 0.01),
    ("gpt-4o-2024-11-20", True, 0.01),
    # GPT-4o-audio-preview input
    ("gpt-4o-audio-preview", False, 0.0025),
    ("gpt-4o-audio-preview-2024-12-17", False, 0.0025),
    ("gpt-4o-audio-preview-2024-10-01", False, 0.0025),
    # GPT-4o-audio-preview output
    ("gpt-4o-audio-preview", True, 0.01),
    ("gpt-4o-audio-preview-2024-12-17", True, 0.01),
    ("gpt-4o-audio-preview-2024-10-01", True, 0.01),
    # GPT-4o-realtime-preview input
    ("gpt-4o-realtime-preview", False, 0.005),
    ("gpt-4o-realtime-preview-2024-12-17", False, 0.005),
    ("gpt-4o-realtime-preview-2024-10-01", False, 0.005),
    ("gpt-4o-realtime-preview-cached", False, 0.0025),
    ("gpt-4o-realtime-preview-2024-12-17-cached", False, 0.0025),
    ("gpt-4o-realtime-preview-2024-10-01-cached", False, 0.0025),
    # GPT-4o-realtime-preview output
    ("gpt-4o-realtime-preview", True, 0.02),
    ("gpt-4o-realtime-preview-2024-12-17", True, 0.02),
    ("gpt-4o-realtime-preview-2024-10-01", True, 0.02),
    # GPT-4o-mini input
    ("gpt-4o-mini", False, 0.00015),
    ("gpt-4o-mini-cached", False, 0.000075),
    ("gpt-4o-mini-2024-07-18", False, 0.00015),
    ("gpt-4o-mini-2024-07-18-cached", False, 0.000075),
    # GPT-4o-mini output
    ("gpt-4o-mini", True, 0.0006),
    ("gpt-4o-mini-2024-07-18", True, 0.0006),
    # GPT-4o-mini-audio-preview input
    ("gpt-4o-mini-audio-preview", False, 0.00015),
    ("gpt-4o-mini-audio-preview-2024-12-17", False, 0.00015),
    # GPT-4o-mini-audio-preview output
    ("gpt-4o-mini-audio-preview", True, 0.0006),
    ("gpt-4o-mini-audio-preview-2024-12-17", True, 0.0006),
    # GPT-4o-mini-realtime-preview input
    ("gpt-4o-mini-realtime-preview", False, 0.0006),
    ("gpt-4o-mini-realtime-preview-2024-12-17", False, 0.0006),
    ("gpt-4o-mini-realtime-preview-cached", False, 0.0003),
    ("gpt-4o-mini-realtime-preview-2024-12-17-cached", False, 0.0003),
    # GPT-4o-mini-realtime-preview output
    ("gpt-4o-mini-realtime-preview", True, 0.0024),
    ("gpt-4o-mini-realtime-preview-2024-12-17", True, 0.0024),
    # GPT-4o-mini-search-preview input
    ("gpt-4o-mini-search-preview", False, 0.00015),
    ("gpt-4o-mini-search-preview-2025-03-11", False, 0.00015),
    # GPT-4o-mini-search-preview output
    ("gpt-4o-mini-search-preview", True, 0.0006),
    ("gpt-4o-mini-search-preview-2025-03-11", True, 0.0006),
    # GPT-4o-search-preview input
    ("gpt-4o-search-preview", False, 0.0025),
    ("gpt-4o-search-preview-2025-03-11", False, 0.0025),
    # GPT-4o-search-preview output
    ("gpt-4o-search-preview", True, 0.01),
    ("gpt-4o-search-preview-2025-03-11", True, 0.01),
    # Computer-use-preview input
    ("computer-use-preview", False, 0.003),
    ("computer-use-preview-2025-03-11", False, 0.003),
    # Computer-use-preview output
    ("computer-use-preview", True, 0.012),
    ("computer-use-preview-2025-03-11", True, 0.012),
    # GPT-4 input
    ("gpt-4", False, 0.03),
    ("gpt-4-0314", False, 0.03),
    ("gpt-4-0613", False, 0.03),
    ("gpt-4-32k", False, 0.06),
    ("gpt-4-32k-0314", False, 0.06),
    ("gpt-4-32k-0613", False, 0.06),
    ("gpt-4-vision-preview", False, 0.01),
    ("gpt-4-1106-preview", False, 0.01),
    ("gpt-4-0125-preview", False, 0.01),
    ("gpt-4-turbo-preview", False, 0.01),
    ("gpt-4-turbo", False, 0.01),
    ("gpt-4-turbo-2024-04-09", False, 0.01),
    # GPT-4 output
    ("gpt-4", True, 0.06),
    ("gpt-4-0314", True, 0.06),
    ("gpt-4-0613", True, 0.06),
    ("gpt-4-32k", True, 0.12),
    ("gpt-4-32k-0314", True, 0.12),
    ("gpt-4-32k-0613", True, 0.12),
    ("gpt-4-vision-preview", True, 0.03),
    ("gpt-4-1106-preview", True, 0.03),
    ("gpt-4-0125-preview", True, 0.03),
    ("gpt-4-turbo-preview", True, 0.03),
    ("gpt-4-turbo", True, 0.03),
    ("gpt-4-turbo-2024-04-09", True, 0.03),
    # GPT-3.5 input
    ("gpt-3.5-turbo", False, 0.0015),
    ("gpt-3.5-turbo-0125", False, 0.0005),
    ("gpt-3.5-turbo-0301", False, 0.0015),
    ("gpt-3.5-turbo-0613", False, 0.0015),
    ("gpt-3.5-turbo-1106", False, 0.001),
    ("gpt-3.5-turbo-instruct", False, 0.0015),
    ("gpt-3.5-turbo-16k", False, 0.003),
    ("gpt-3.5-turbo-16k-0613", False, 0.003),
    # GPT-3.5 output
    ("gpt-3.5-turbo", True, 0.002),
    ("gpt-3.5-turbo-0125", True, 0.0015),
    ("gpt-3.5-turbo-0301", True, 0.002),
    ("gpt-3.5-turbo-0613", True, 0.002),
    ("gpt-3.5-turbo-1106", True, 0.002),
    ("gpt-3.5-turbo-instruct", True, 0.002),
    ("gpt-3.5-turbo-16k", True, 0.004),
    ("gpt-3.5-turbo-16k-0613", True, 0.004),
    # Azure GPT-35 input
    ("gpt-35-turbo", False, 0.0015),  # Azure OpenAI version of ChatGPT
    ("gpt-35-turbo-0125", False, 0.0005),
    ("gpt-35-turbo-0301", False, 0.002),  # Azure OpenAI version of ChatGPT
    ("gpt-35-turbo-0613", False, 0.0015),
    ("gpt-35-turbo-instruct", False, 0.0015),
    ("gpt-35-turbo-16k", False, 0.003),
    ("gpt-35-turbo-16k-0613", False, 0.003),
    # Azure GPT-35 output
    ("gpt-35-turbo", True, 0.002),  # Azure OpenAI version of ChatGPT
    ("gpt-35-turbo-0125", True, 0.0015),
    ("gpt-35-turbo-0301", True, 0.002),  # Azure OpenAI version of ChatGPT
    ("gpt-35-turbo-0613", True, 0.002),
    ("gpt-35-turbo-instruct", True, 0.002),
    ("gpt-35-turbo-16k", True, 0.004),
    ("gpt-35-turbo-16k-0613", True, 0.004),
    # Other OpenAI models
    ("text-ada-001", False, 0.0004),
    ("text-ada-001", True, 0.0004),
    ("ada", False, 0.0004),
    ("ada", True, 0.0004),
    ("text-babbage-001", False, 0.0005),
    ("text-babbage-001", True, 0.0005),
    ("babbage", False, 0.0005),
    ("babbage", True, 0.0005),
    ("text-curie-001", False, 0.002),
    ("text-curie-001", True, 0.002),
    ("curie", False, 0.002),
    ("curie", True, 0.002),
    ("text-davinci-003", False, 0.02),
    ("text-davinci-003", True, 0.02),
    ("text-davinci-002", False, 0.02),
    ("text-davinci-002", True, 0.02),
    ("code-davinci-002", False, 0.02),
    ("code-davinci-002", True, 0.02),
    # Fine-tuned OpenAI input
    ("ft:babbage-002", False, 0.0016),
    ("ft:davinci-002", False, 0.012),
    ("ft:gpt-3.5-turbo-0613", False, 0.003),
    ("ft:gpt-3.5-turbo-1106", False, 0.003),
    ("ft:gpt-3.5-turbo-0125", False, 0.003),
    ("ft:gpt-4o-mini-2024-07-18", False, 0.0003),
    ("ft:gpt-4o-mini-2024-07-18-cached", False, 0.00015),
    # Fine-tuned OpenAI output
    ("ft:babbage-002", True, 0.0016),
    ("ft:davinci-002", True, 0.012),
    ("ft:gpt-3.5-turbo-0613", True, 0.006),
    ("ft:gpt-3.5-turbo-1106", True, 0.006),
    ("ft:gpt-3.5-turbo-0125", True, 0.006),
    ("ft:gpt-4o-mini-2024-07-18", True, 0.0012),
    # Azure OpenAI Fine-tuned input
    ("babbage-002.ft-*", False, 0.0004),
    ("davinci-002.ft-*", False, 0.002),
    ("gpt-35-turbo-0613.ft-*", False, 0.0015),
    # Azure OpenAI Fine-tuned output
    ("babbage-002.ft-*", True, 0.0004),
    ("davinci-002.ft-*", True, 0.002),
    ("gpt-35-turbo-0613.ft-*", True, 0.002),
    # Legacy OpenAI Fine-tuned models
    ("ada:ft-*", True, 0.0016),
    ("babbage:ft-*", True, 0.0024),
    ("curie:ft-*", True, 0.012),
    ("davinci:ft-*", True, 0.12),
    # Anthropic Claude 3 input
    ("claude-3-haiku", False, 0.00025),
    ("claude-3-haiku-cached", False, 0.00003),
    ("claude-3-sonnet", False, 0.003),
    ("claude-3-sonnet-cached", False, 0.00003),
    ("claude-3-opus", False, 0.015),
    ("claude-3-opus-cached", False, 0.0015),
    # Anthropic Claude 3 output
    ("claude-3-haiku", True, 0.00125),
    ("claude-3-sonnet", True, 0.015),
    ("claude-3-opus", True, 0.075),
    # Anthropic Claude 3.5 Haiku input
    ("claude-3.5-haiku", False, 0.0008),
    ("claude-3.5-haiku-cached", False, 0.00008),
    # Anthropic Claude 3.5 Haiku output
    ("claude-3.5-haiku", True, 0.004),
    # Anthropic Claude 4 Sonnet input
    ("claude-4-sonnet", False, 0.003),
    ("claude-4-sonnet-cached", False, 0.0003),
    # Anthropic Claude 4 Sonnet output
    ("claude-4-sonnet", True, 0.015),
    # Anthropic Claude 4 Opus input
    ("claude-4-opus", False, 0.015),
    ("claude-4-opus-cached", False, 0.0015),
    # Anthropic Claude 4 Opus output
    ("claude-4-opus", True, 0.075),
    # Anthropic Claude 2 input
    ("claude-2.*", False, 0.008),
    ("claude-instant*", False, 0.0008),
    # Anthropic Claude 2 output
    ("claude-2.*", True, 0.024),
    ("claude-instant*", True, 0.0024),
    # Cohere command input
    ("command", False, 0.001),
    ("command-a", False, 0.0025),
    ("command-light", False, 0.0003),
    ("command-r", False, 0.00015),
    ("command-r-ft", False, 0.0003),
    ("command-r-plus", False, 0.0025),
    ("command-r7b", False, 0.0000375),
    # Cohere command output
    ("command", True, 0.002),
    ("command-a", True, 0.01),
    ("command-light", True, 0.0006),
    ("command-r", True, 0.0006),
    ("command-r-ft", True, 0.0012),
    ("command-r-plus", True, 0.01),
    ("command-r7b", True, 0.00015),
    # xAI Grok-3 input
    ("grok-3-latest", False, 0.003),
    ("grok-3-fast-latest", False, 0.005),
    ("grok-3-mini-latest", False, 0.0003),
    ("grok-3-mini-fast-latest", False, 0.0006),
    # xAI Grok-3 output
    ("grok-3-latest", True, 0.015),
    ("grok-3-fast-latest", True, 0.025),
    ("grok-3-mini-latest", True, 0.0005),
    ("grok-3-mini-fast-latest", True, 0.004),
    # xAI Grok-2 input
    ("grok-2-vision", False, 0.002),
    ("grok-2-vision-latest", False, 0.002),
    ("grok-2", False, 0.002),
    ("grok-2-latest", False, 0.002),
    # xAI Grok-2 output
    ("grok-2-vision", True, 0.01),
    ("grok-2-vision-latest", True, 0.01),
    ("grok-2", True, 0.01),
    ("grok-2-latest", True, 0.01),
]

_PRECOMPUTED_AI_MODEL_COSTS: AIModelCosts = {
    "version": 1,
    "costs": [
        {
            "modelId": row[0],
            "forCompletion": row[1],
            "costPer1kTokens": row[2],
        }
        for row in _AI_MODEL_COST_DATA
    ],
}


def ai_model_costs_config() -> AIModelCosts:
    """
    Get AI model costs configuration.

    This function first tries to get updated costs from cache (fetched from OpenRouter),
    and falls back to the precomputed costs if cache is empty.

    Returns:
        AIModelCosts object containing cost information for AI models
    """
    # NOTE (vgrozdanic): in the transition period from v1 to v2, we need to
    # support both versions of the AI model costs config.
    # Once we've fully migrated to v2, we can remove the v1 config.
    cached_costs = cache.get(AI_MODEL_COSTS_CACHE_KEY)
    if cached_costs is not None:
        return cached_costs

    # Fall back to precomputed costs (v1)
    return _PRECOMPUTED_AI_MODEL_COSTS
