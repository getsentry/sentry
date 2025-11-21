import logging
import re
from typing import Any

from django.conf import settings

from sentry import options
from sentry.http import safe_urlopen
from sentry.relay.config.ai_model_costs import (
    AI_MODEL_COSTS_CACHE_KEY,
    AI_MODEL_COSTS_CACHE_TTL,
    AIModelCosts,
    AIModelCostV2,
    ModelId,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import ai_agent_monitoring_tasks
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


# API endpoints
OPENROUTER_MODELS_API_URL = "https://openrouter.ai/api/v1/models"
MODELS_DEV_API_URL = "https://models.dev/api.json"


def _normalize_model_id(model_id: str) -> str:
    """
    Normalize a model id by removing dates and versions.
    Example:
    - "gpt-4" -> "gpt-4"
    - "gpt-4-20241022" -> "gpt-4"
    - "gpt-4-v1.0" -> "gpt-4"
    - "gpt-4-20241022-v1.0" -> "gpt-4"
    - "gpt-4-20241022-v1.0-beta" -> "gpt-4"
    - "gpt-4-20241022-v1.0-beta-1" -> "gpt-4"
    - "gpt-4-20241022-v1.0-beta-1" -> "gpt-4"

    Args:
        model_id: The model id to normalize

    Returns:
        The normalized model id
    """
    return re.sub(
        r"(([-_@])(\d{4}[-/.]\d{2}[-/.]\d{2}|\d{8}))?([-_]v\d+[:.]?\d*([-:].*)?)?$", "", model_id
    )


def _create_prefix_glob_model_name(model_id: str) -> str:
    """
    Create a glob version of a model name by adding a wildcard prefix.

    This handles cases where models have random prefixes before the actual model name.
    Can be used on both regular model IDs and suffix-globbed model names.

    Examples:
    - "gpt-4" -> "*gpt-4"
    - "claude-3-5-sonnet" -> "*claude-3-5-sonnet"
    - "o3-pro" -> "*o3-pro"

    Args:
        model_id: The original model ID or a suffix-globbed model name

    Returns:
        The glob version with a wildcard prefix
    """
    # Simply prepend * to the model name
    return f"*{model_id}"


def _add_glob_model_names(models_dict: dict[ModelId, AIModelCostV2]) -> None:
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
        normalized_model_id = _normalize_model_id(model_id)
        if normalized_model_id != model_id and normalized_model_id not in models_dict:
            models_dict[normalized_model_id] = models_dict[model_id]

        prefix_glob_name = _create_prefix_glob_model_name(normalized_model_id)
        if prefix_glob_name not in models_dict:
            models_dict[prefix_glob_name] = models_dict[normalized_model_id]


@instrumented_task(
    name="sentry.tasks.ai_agent_monitoring.fetch_ai_model_costs",
    namespace=ai_agent_monitoring_tasks,
    processing_deadline_duration=35,
    expires=30,
    silo_mode=SiloMode.REGION,
)
def fetch_ai_model_costs() -> None:
    """
    Fetch AI model costs from OpenRouter and models.dev APIs and store them in cache.

    This task fetches model pricing data from both sources and converts it to
    the AIModelCostV2 format for use by Sentry's LLM cost tracking.
    OpenRouter prices take precedence over models.dev prices.
    """

    # this task shouldn't be run in an air gap environment
    if settings.SENTRY_AIR_GAP:
        return

    models_dict: dict[ModelId, AIModelCostV2] = {}

    # Fetch from OpenRouter API (takes precedence)
    try:
        openrouter_models = _fetch_openrouter_models()
        models_dict.update(openrouter_models)
    except Exception as e:
        logger.warning(
            "Failed to fetch AI model costs from OpenRouter API", extra={"error": str(e)}
        )
        # re-raise to fail the task
        raise

    # Fetch from models.dev API (only add models not already present)
    try:
        models_dev_models = _fetch_models_dev_models()
        # Only add models that don't already exist (OpenRouter takes precedence)
        for model_id, model_cost in models_dev_models.items():
            if model_id not in models_dict:
                models_dict[model_id] = model_cost

    except Exception as e:
        logger.warning(
            "Failed to fetch AI model costs from models.dev API", extra={"error": str(e)}
        )
        # re-raise to fail the task
        raise

    # Custom model mapping for models pricing - often times the same models are named differently
    # in different hosting providers. This allows us to map the alternative model id to the existing model id.
    for model_mapping in options.get("ai-agent-monitoring.custom-model-mapping"):
        alternative_model_id = model_mapping.get("alternative_model_id")
        existing_model_id = model_mapping.get("existing_model_id")

        if existing_model_id not in models_dict or alternative_model_id in models_dict:
            continue

        models_dict[alternative_model_id] = models_dict[existing_model_id]

    # Add glob versions of model names for flexible matching
    _add_glob_model_names(models_dict)

    ai_model_costs: AIModelCosts = {"version": 2, "models": models_dict}
    cache.set(AI_MODEL_COSTS_CACHE_KEY, ai_model_costs, AI_MODEL_COSTS_CACHE_TTL)


def _fetch_openrouter_models() -> dict[ModelId, AIModelCostV2]:
    """Fetch model costs from OpenRouter API
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
                },
            },
        ]
    }
    """
    response = safe_urlopen(OPENROUTER_MODELS_API_URL)
    response.raise_for_status()

    # Parse the response
    data = response.json()

    if not isinstance(data, dict) or "data" not in data:
        raise ValueError("Invalid OpenRouter response format: missing 'data' field")

    models_data = data["data"]
    if not isinstance(models_data, list):
        raise ValueError("Invalid OpenRouter response format: 'data' field is not a list")

    # Convert to AIModelCostV2 format
    models_dict: dict[ModelId, AIModelCostV2] = {}

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

        # Convert pricing data to AIModelCostV2 format
        # OpenRouter provides costs as strings, we need to convert to float
        try:
            ai_model_cost = AIModelCostV2(
                inputPerToken=safe_float_conversion(pricing.get("prompt")),
                outputPerToken=safe_float_conversion(pricing.get("completion")),
                outputReasoningPerToken=safe_float_conversion(pricing.get("internal_reasoning")),
                inputCachedPerToken=safe_float_conversion(pricing.get("input_cache_read")),
            )

            models_dict[model_id] = ai_model_cost

        except (ValueError, TypeError) as e:
            logger.warning(
                "fetch_ai_model_costs.openrouter_model_parse_error",
                extra={"model_id": model_id, "error": str(e)},
            )
            continue

    return models_dict


def _fetch_models_dev_models() -> dict[ModelId, AIModelCostV2]:
    """Fetch model costs from models.dev API
    Example response:
    {
        "openai": {
            "models": {
                "gpt-4": {
                    "cost": {
                        "input": 0.0000003,
                        "output": 0.00000165,
                        "cache_read": 0.0000003,
                    }
                }
            }
        }
    }

    """
    response = safe_urlopen(MODELS_DEV_API_URL)
    response.raise_for_status()

    # Parse the response
    data = response.json()

    if not isinstance(data, dict):
        raise ValueError("Invalid models.dev response format: expected dict")

    models_dict: dict[ModelId, AIModelCostV2] = {}

    for provider_name, provider_data in data.items():
        if not isinstance(provider_data, dict):
            continue

        models = provider_data.get("models", {})
        if not isinstance(models, dict):
            continue

        for model_id, model_data in models.items():
            if not isinstance(model_data, dict):
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

            # Convert pricing data to AIModelCostV2 format
            # models.dev provides costs as numbers, but for extra safety convert to our format
            try:
                ai_model_cost = AIModelCostV2(
                    inputPerToken=safe_float_conversion(cost_data.get("input"))
                    / 1000000,  # models.dev have prices per 1M tokens
                    outputPerToken=safe_float_conversion(cost_data.get("output"))
                    / 1000000,  # models.dev have price per 1M tokens
                    outputReasoningPerToken=0.0,  # models.dev doesn't provide reasoning costs
                    inputCachedPerToken=safe_float_conversion(cost_data.get("cache_read"))
                    / 1000000,  # models.dev have price per 1M tokens
                )

                models_dict[model_id] = ai_model_cost

            except (ValueError, TypeError) as e:
                logger.warning(
                    "fetch_ai_model_costs.models_dev_model_parse_error",
                    extra={"model_id": model_id, "provider": provider_name, "error": str(e)},
                )
                continue

    return models_dict


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
