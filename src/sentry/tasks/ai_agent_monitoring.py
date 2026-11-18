import logging
from typing import Any

from django.conf import settings

from sentry.ai_monitoring.utils import normalize_model_id, prefix_glob_model_name
from sentry.http import safe_urlopen
from sentry.relay.config.ai_model_costs import (
    AI_MODEL_METADATA_CACHE_KEY,
    AI_MODEL_METADATA_CACHE_TTL,
    AIModelCost,
    AIModelMetadata,
    AIModelMetadataConfig,
    ModelId,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import ai_agent_monitoring_tasks
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


# API endpoints
OPENROUTER_MODELS_API_URL = "https://openrouter.ai/api/v1/models"
# `type=all` includes specialized model types that models.dev omits by default.
MODELS_DEV_API_URL = "https://models.dev/api.json?type=all"
# Specialized models.dev types priced per token. Models without a type are general models.
MODELS_DEV_TOKEN_PRICED_TYPES = frozenset({"decision"})
# llm-prices (https://github.com/Mattbusel/llm-prices) is read from each provider's own
# pricing page, so its rows override the aggregators for the providers listed below.
# DeepSeek is left out because its price depends on the time of day, and Perplexity
# because its row is the Agent API price rather than the Sonar API price.
LLM_PRICES_URL = "https://github.com/Mattbusel/llm-prices/releases/latest/download/prices.json"
LLM_PRICES_FIRST_PARTY_PROVIDERS = frozenset(
    {"anthropic", "openai", "google", "mistral", "xai", "cohere"}
)


def _add_glob_model_names(models_dict: dict[ModelId, AIModelMetadata]) -> None:
    """
    Add glob versions of model names to the models dictionary.

    For each model, it creates a normalized model name, and a prefix glob version of
    the model name.



    Args:
        models_dict: The dictionary of models to add glob versions to
    """

    # needed to avoid modifying the dictionary during iteration
    model_ids = list(models_dict.keys())

    for model_id in model_ids:
        normalized_model_id = normalize_model_id(model_id)
        if normalized_model_id != model_id and normalized_model_id not in models_dict:
            models_dict[normalized_model_id] = models_dict[model_id]

        prefix_glob_name = prefix_glob_model_name(normalized_model_id)
        if prefix_glob_name not in models_dict:
            models_dict[prefix_glob_name] = models_dict[normalized_model_id]


@instrumented_task(
    name="sentry.tasks.ai_agent_monitoring.fetch_ai_model_metadata",
    namespace=ai_agent_monitoring_tasks,
    processing_deadline_duration=35,
    expires=30,
    silo_mode=SiloMode.CELL,
)
def fetch_ai_model_metadata() -> None:
    """
    Fetch AI model metadata (costs, context size) from OpenRouter and models.dev APIs
    and store them in cache.

    This task fetches model pricing and context size data from both sources and
    converts it to the AIModelMetadata format.
    OpenRouter data takes precedence over models.dev data. Costs for first-party model
    ids are then taken from llm-prices when it has them.
    """
    if settings.SENTRY_AIR_GAP:
        return

    models_dict: dict[ModelId, AIModelMetadata] = {}

    # Fetch from OpenRouter API (takes precedence)
    try:
        openrouter_models = _fetch_openrouter_models()
        models_dict.update(openrouter_models)
    except Exception as e:
        logger.warning(
            "Failed to fetch AI model metadata from OpenRouter API", extra={"error": str(e)}
        )
        raise

    # Fetch from models.dev API (only add models not already present)
    try:
        models_dev_models = _fetch_models_dev_models()
        for model_id, model_metadata in models_dev_models.items():
            models_dict.setdefault(model_id, model_metadata)
    except Exception as e:
        logger.warning(
            "Failed to fetch AI model metadata from models.dev API", extra={"error": str(e)}
        )
        raise

    # Costs from the providers' own pricing pages replace aggregator costs for the
    # same model id. This source is optional, so a failure keeps the costs above.
    try:
        _apply_llm_prices_costs(models_dict, _fetch_llm_prices_costs())
    except Exception as e:
        logger.warning("Failed to fetch AI model costs from llm-prices", extra={"error": str(e)})

    # Add glob versions of model names for flexible matching
    _add_glob_model_names(models_dict)

    metadata_config: AIModelMetadataConfig = {"version": 1, "models": models_dict}
    cache.set(AI_MODEL_METADATA_CACHE_KEY, metadata_config, AI_MODEL_METADATA_CACHE_TTL)


def _fetch_openrouter_models() -> dict[ModelId, AIModelMetadata]:
    """Fetch model metadata from OpenRouter API.

    Example response:
    {
        "data": [
            {
                "id": "openai/gpt-4o-mini",
                "name": "OpenAI: GPT-4o Mini",
                "context_length": 1000000,
                "pricing": {
                    "prompt": "0.0000003",
                    "completion": "0.00000165",
                    "internal_reasoning": "0.0000003",
                    "input_cache_read": "0.0000003",
                    "input_cache_write": "0.00000125",
                },
            },
        ]
    }
    """
    response = safe_urlopen(OPENROUTER_MODELS_API_URL)
    response.raise_for_status()

    data = response.json()

    if not isinstance(data, dict) or "data" not in data:
        raise ValueError("Invalid OpenRouter response format: missing 'data' field")

    models_data = data["data"]
    if not isinstance(models_data, list):
        raise ValueError("Invalid OpenRouter response format: 'data' field is not a list")

    models_dict: dict[ModelId, AIModelMetadata] = {}

    for model_data in models_data:
        if not isinstance(model_data, dict):
            continue

        model_id = model_data.get("id")
        if not model_id:
            continue

        # OpenRouter includes provider name in the model ID, e.g. openai/gpt-4o-mini
        # We need to extract the model name, since our SDKs only send the model name
        # (e.g. gpt-4o-mini)
        if "/" in model_id:
            model_id = model_id.split("/", maxsplit=1)[1]

        pricing = model_data.get("pricing", {})

        # OpenRouter provides costs as strings, we need to convert to float
        try:
            model_cost = AIModelCost(
                inputPerToken=safe_float_conversion(pricing.get("prompt")),
                outputPerToken=safe_float_conversion(pricing.get("completion")),
                outputReasoningPerToken=safe_float_conversion(pricing.get("internal_reasoning")),
                inputCachedPerToken=safe_float_conversion(pricing.get("input_cache_read")),
                inputCacheWritePerToken=safe_float_conversion(pricing.get("input_cache_write")),
            )

            metadata = AIModelMetadata(costs=model_cost)

            context_length = model_data.get("context_length")
            if isinstance(context_length, int) and context_length > 0:
                metadata["contextSize"] = context_length

            models_dict[model_id] = metadata

        except (ValueError, TypeError) as e:
            logger.warning(
                "fetch_ai_model_metadata.openrouter_model_parse_error",
                extra={"model_id": model_id, "error": str(e)},
            )
            continue

    return models_dict


def _fetch_models_dev_models() -> dict[ModelId, AIModelMetadata]:
    """Fetch model metadata from models.dev API.

    Example response:
    {
        "openai": {
            "models": {
                "gpt-4": {
                    "cost": {
                        "input": 0.0000003,
                        "output": 0.00000165,
                        "cache_read": 0.0000003,
                        "cache_write": 0.00000125,
                    },
                    "limit": {
                        "context": 128000,
                        "output": 16384,
                    }
                }
            }
        }
    }
    """
    response = safe_urlopen(MODELS_DEV_API_URL)
    response.raise_for_status()

    data = response.json()

    if not isinstance(data, dict):
        raise ValueError("Invalid models.dev response format: expected dict")

    models_dict: dict[ModelId, AIModelMetadata] = {}

    for provider_name, provider_data in data.items():
        if not isinstance(provider_data, dict):
            continue

        models = provider_data.get("models", {})
        if not isinstance(models, dict):
            continue

        for model_id, model_data in models.items():
            if not isinstance(model_data, dict):
                continue

            model_type = model_data.get("type")
            if model_type is not None and model_type not in MODELS_DEV_TOKEN_PRICED_TYPES:
                continue

            cost_data = model_data.get("cost", {})
            if not isinstance(cost_data, dict) or not cost_data:
                # Skip models with no cost data or empty cost data
                continue

            # models.dev may include provider name in the model ID, e.g. google/gemini-2.0-flash-001
            # We need to extract the model name, since our SDKs only send the model name
            # (e.g. gemini-2.0-flash-001)
            if "/" in model_id:
                model_id = model_id.split("/", maxsplit=1)[1]

            # models.dev provides costs as numbers, but for extra safety convert to our format
            try:
                model_cost = AIModelCost(
                    inputPerToken=safe_float_conversion(cost_data.get("input"))
                    / 1000000,  # models.dev have prices per 1M tokens
                    outputPerToken=safe_float_conversion(cost_data.get("output"))
                    / 1000000,  # models.dev have price per 1M tokens
                    outputReasoningPerToken=0.0,  # models.dev doesn't provide reasoning costs
                    inputCachedPerToken=safe_float_conversion(cost_data.get("cache_read"))
                    / 1000000,  # models.dev have price per 1M tokens
                    inputCacheWritePerToken=safe_float_conversion(cost_data.get("cache_write"))
                    / 1000000,  # models.dev have price per 1M tokens
                )

                metadata = AIModelMetadata(costs=model_cost)

                limit_data = model_data.get("limit", {})
                if isinstance(limit_data, dict):
                    context_size = limit_data.get("context")
                    if isinstance(context_size, int) and context_size > 0:
                        metadata["contextSize"] = context_size

                models_dict[model_id] = metadata

            except (ValueError, TypeError) as e:
                logger.warning(
                    "fetch_ai_model_metadata.models_dev_model_parse_error",
                    extra={"model_id": model_id, "provider": provider_name, "error": str(e)},
                )
                continue

    return models_dict


def _llm_prices_per_token(value: Any) -> float | None:
    """Convert an llm-prices price (USD per 1M tokens) to USD per token."""
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0:
        return None
    return value / 1000000


def _fetch_llm_prices_costs() -> dict[ModelId, dict[str, float]]:
    """Fetch first-party model costs from the latest llm-prices release.

    Only the cost fields the provider's page lists are returned, so fields it leaves
    empty keep the value from OpenRouter or models.dev.

    Example response:
    {
        "models": [
            {
                "provider": "anthropic",
                "model": "claude-sonnet-4-5",
                "aliases": ["claude-sonnet-4-5-20250929"],
                "status": "listed",
                "input": 3,
                "output": 15,
                "cache_read": 0.3,
                "cache_write": {"5m": 3.75, "1h": 6},
            }
        ]
    }
    """
    response = safe_urlopen(LLM_PRICES_URL, allow_redirects=True)
    response.raise_for_status()

    data = response.json()

    if not isinstance(data, dict) or not isinstance(data.get("models"), list):
        raise ValueError("Invalid llm-prices response format: missing 'models' list")

    costs: dict[ModelId, dict[str, float]] = {}

    for row in data["models"]:
        if not isinstance(row, dict):
            continue
        if row.get("provider") not in LLM_PRICES_FIRST_PARTY_PROVIDERS:
            continue
        if row.get("status") != "listed":
            continue

        input_per_token = _llm_prices_per_token(row.get("input"))
        output_per_token = _llm_prices_per_token(row.get("output"))
        if input_per_token is None or output_per_token is None:
            continue

        model_cost = {
            "inputPerToken": input_per_token,
            "outputPerToken": output_per_token,
            # Providers bill reasoning tokens as output tokens, and Relay uses the
            # output price when this is 0.
            "outputReasoningPerToken": 0.0,
        }
        cache_read = _llm_prices_per_token(row.get("cache_read"))
        if cache_read is not None:
            model_cost["inputCachedPerToken"] = cache_read
        cache_write = row.get("cache_write")
        if isinstance(cache_write, dict):
            # Anthropic lists 5 minute and 1 hour cache writes; 5 minutes is the default.
            cache_write = cache_write.get("5m")
        cache_write = _llm_prices_per_token(cache_write)
        if cache_write is not None:
            model_cost["inputCacheWritePerToken"] = cache_write

        aliases = row.get("aliases")
        model_ids = [row.get("model"), *(aliases if isinstance(aliases, list) else [])]
        for model_id in model_ids:
            if not isinstance(model_id, str) or not model_id:
                continue
            if "/" in model_id:
                model_id = model_id.split("/", maxsplit=1)[1]
            costs.setdefault(model_id, model_cost)

    return costs


def _apply_llm_prices_costs(
    models_dict: dict[ModelId, AIModelMetadata], costs: dict[ModelId, dict[str, float]]
) -> None:
    """Replace aggregator costs with llm-prices costs, keeping the context size."""
    for model_id, model_cost in costs.items():
        existing = models_dict.get(model_id)
        existing_costs = existing["costs"] if existing is not None else None
        merged = AIModelCost(
            inputPerToken=model_cost["inputPerToken"],
            outputPerToken=model_cost["outputPerToken"],
            outputReasoningPerToken=model_cost["outputReasoningPerToken"],
            inputCachedPerToken=model_cost.get(
                "inputCachedPerToken",
                existing_costs["inputCachedPerToken"] if existing_costs else 0.0,
            ),
            inputCacheWritePerToken=model_cost.get(
                "inputCacheWritePerToken",
                existing_costs["inputCacheWritePerToken"] if existing_costs else 0.0,
            ),
        )
        metadata = AIModelMetadata(costs=merged)
        if existing is not None and "contextSize" in existing:
            metadata["contextSize"] = existing["contextSize"]
        models_dict[model_id] = metadata


def safe_float_conversion(value: Any) -> float:
    """
    Safely convert a value to float, handling string inputs and None values.

    Args:
        value: The value to convert (could be string, float, int, or None)

    Returns:
        The float value, or 0.0 if the value is None or cannot be converted
    """
    if value is None:
        return 0.0

    if isinstance(value, (int, float)):
        return float(value)

    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return 0.0

    return 0.0
