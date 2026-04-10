import logging
import re
from typing import Any

from django.conf import settings

from sentry.http import safe_urlopen
from sentry.relay.config.ai_model_costs import (
    AI_MODEL_COSTS_CACHE_KEY,
    AI_MODEL_COSTS_CACHE_TTL,
    LLM_MODEL_METADATA_CACHE_KEY,
    LLM_MODEL_METADATA_CACHE_TTL,
    AIModelCosts,
    AIModelCostV2,
    LLMModelCost,
    LLMModelMetadata,
    LLMModelMetadataConfig,
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


def _add_glob_model_names[T](models_dict: dict[ModelId, T]) -> None:
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


# ---------------------------------------------------------------------------
# Shared raw data fetching
# ---------------------------------------------------------------------------

# Raw parsed model data from APIs (provider-stripped model_id + raw dict)
type RawModelEntry = tuple[str, dict[str, Any]]


def _fetch_openrouter_raw() -> list[RawModelEntry]:
    """Fetch raw model entries from OpenRouter API."""
    response = safe_urlopen(OPENROUTER_MODELS_API_URL)
    response.raise_for_status()

    data = response.json()

    if not isinstance(data, dict) or "data" not in data:
        raise ValueError("Invalid OpenRouter response format: missing 'data' field")

    models_data = data["data"]
    if not isinstance(models_data, list):
        raise ValueError("Invalid OpenRouter response format: 'data' field is not a list")

    entries: list[RawModelEntry] = []
    for model_data in models_data:
        if not isinstance(model_data, dict):
            continue

        model_id = model_data.get("id")
        if not model_id:
            continue

        # Strip provider prefix (e.g. openai/gpt-4o-mini -> gpt-4o-mini)
        if "/" in model_id:
            model_id = model_id.split("/", maxsplit=1)[1]

        entries.append((model_id, model_data))

    return entries


def _fetch_models_dev_raw() -> list[RawModelEntry]:
    """Fetch raw model entries from models.dev API."""
    response = safe_urlopen(MODELS_DEV_API_URL)
    response.raise_for_status()

    data = response.json()

    if not isinstance(data, dict):
        raise ValueError("Invalid models.dev response format: expected dict")

    entries: list[RawModelEntry] = []
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
                continue

            # Strip provider prefix
            if "/" in model_id:
                model_id = model_id.split("/", maxsplit=1)[1]

            # Attach provider_name for logging
            model_data_with_provider = {**model_data, "_provider": provider_name}
            entries.append((model_id, model_data_with_provider))

    return entries


# ---------------------------------------------------------------------------
# Legacy task: fetch_ai_model_costs (flat AIModelCostV2 format)
# TODO: Remove once all consumers have migrated to fetch_llm_model_metadata
# ---------------------------------------------------------------------------


def _openrouter_entry_to_cost(model_id: str, model_data: dict) -> AIModelCostV2 | None:
    """Convert an OpenRouter raw entry to the legacy flat AIModelCostV2 format."""
    pricing = model_data.get("pricing", {})
    try:
        return AIModelCostV2(
            inputPerToken=safe_float_conversion(pricing.get("prompt")),
            outputPerToken=safe_float_conversion(pricing.get("completion")),
            outputReasoningPerToken=safe_float_conversion(pricing.get("internal_reasoning")),
            inputCachedPerToken=safe_float_conversion(pricing.get("input_cache_read")),
            inputCacheWritePerToken=safe_float_conversion(pricing.get("input_cache_write")),
        )
    except (ValueError, TypeError) as e:
        logger.warning(
            "fetch_ai_model_costs.openrouter_model_parse_error",
            extra={"model_id": model_id, "error": str(e)},
        )
        return None


def _models_dev_entry_to_cost(model_id: str, model_data: dict) -> AIModelCostV2 | None:
    """Convert a models.dev raw entry to the legacy flat AIModelCostV2 format."""
    cost_data = model_data.get("cost", {})
    provider_name = model_data.get("_provider", "unknown")
    try:
        return AIModelCostV2(
            inputPerToken=safe_float_conversion(cost_data.get("input")) / 1000000,
            outputPerToken=safe_float_conversion(cost_data.get("output")) / 1000000,
            outputReasoningPerToken=0.0,
            inputCachedPerToken=safe_float_conversion(cost_data.get("cache_read")) / 1000000,
            inputCacheWritePerToken=safe_float_conversion(cost_data.get("cache_write")) / 1000000,
        )
    except (ValueError, TypeError) as e:
        logger.warning(
            "fetch_ai_model_costs.models_dev_model_parse_error",
            extra={"model_id": model_id, "provider": provider_name, "error": str(e)},
        )
        return None


@instrumented_task(
    name="sentry.tasks.ai_agent_monitoring.fetch_ai_model_costs",
    namespace=ai_agent_monitoring_tasks,
    processing_deadline_duration=35,
    expires=30,
    silo_mode=SiloMode.CELL,
)
def fetch_ai_model_costs() -> None:
    """
    Legacy task: fetch AI model costs and store them in the flat AIModelCostV2 format.
    TODO: Remove once all consumers have migrated to fetch_llm_model_metadata.
    """
    if settings.SENTRY_AIR_GAP:
        return

    models_dict: dict[ModelId, AIModelCostV2] = {}

    try:
        for model_id, model_data in _fetch_openrouter_raw():
            cost = _openrouter_entry_to_cost(model_id, model_data)
            if cost is not None:
                models_dict[model_id] = cost
    except Exception as e:
        logger.warning(
            "Failed to fetch AI model costs from OpenRouter API", extra={"error": str(e)}
        )
        raise

    try:
        for model_id, model_data in _fetch_models_dev_raw():
            if model_id not in models_dict:
                cost = _models_dev_entry_to_cost(model_id, model_data)
                if cost is not None:
                    models_dict[model_id] = cost
    except Exception as e:
        logger.warning(
            "Failed to fetch AI model costs from models.dev API", extra={"error": str(e)}
        )
        raise

    _add_glob_model_names(models_dict)

    ai_model_costs: AIModelCosts = {"version": 2, "models": models_dict}
    cache.set(AI_MODEL_COSTS_CACHE_KEY, ai_model_costs, AI_MODEL_COSTS_CACHE_TTL)


# ---------------------------------------------------------------------------
# New task: fetch_llm_model_metadata (nested LLMModelMetadata format)
# ---------------------------------------------------------------------------


def _openrouter_entry_to_metadata(model_id: str, model_data: dict) -> LLMModelMetadata | None:
    """Convert an OpenRouter raw entry to LLMModelMetadata."""
    pricing = model_data.get("pricing", {})
    try:
        model_cost = LLMModelCost(
            inputPerToken=safe_float_conversion(pricing.get("prompt")),
            outputPerToken=safe_float_conversion(pricing.get("completion")),
            outputReasoningPerToken=safe_float_conversion(pricing.get("internal_reasoning")),
            inputCachedPerToken=safe_float_conversion(pricing.get("input_cache_read")),
            inputCacheWritePerToken=safe_float_conversion(pricing.get("input_cache_write")),
        )

        metadata = LLMModelMetadata(costs=model_cost)

        context_length = model_data.get("context_length")
        if isinstance(context_length, int) and context_length > 0:
            metadata["contextSize"] = context_length

        return metadata
    except (ValueError, TypeError) as e:
        logger.warning(
            "fetch_llm_model_metadata.openrouter_model_parse_error",
            extra={"model_id": model_id, "error": str(e)},
        )
        return None


def _models_dev_entry_to_metadata(model_id: str, model_data: dict) -> LLMModelMetadata | None:
    """Convert a models.dev raw entry to LLMModelMetadata."""
    cost_data = model_data.get("cost", {})
    provider_name = model_data.get("_provider", "unknown")
    try:
        model_cost = LLMModelCost(
            inputPerToken=safe_float_conversion(cost_data.get("input")) / 1000000,
            outputPerToken=safe_float_conversion(cost_data.get("output")) / 1000000,
            outputReasoningPerToken=0.0,
            inputCachedPerToken=safe_float_conversion(cost_data.get("cache_read")) / 1000000,
            inputCacheWritePerToken=safe_float_conversion(cost_data.get("cache_write")) / 1000000,
        )

        metadata = LLMModelMetadata(costs=model_cost)

        limit_data = model_data.get("limit", {})
        if isinstance(limit_data, dict):
            context_size = limit_data.get("context")
            if isinstance(context_size, int) and context_size > 0:
                metadata["contextSize"] = context_size

        return metadata
    except (ValueError, TypeError) as e:
        logger.warning(
            "fetch_llm_model_metadata.models_dev_model_parse_error",
            extra={"model_id": model_id, "provider": provider_name, "error": str(e)},
        )
        return None


@instrumented_task(
    name="sentry.tasks.ai_agent_monitoring.fetch_llm_model_metadata",
    namespace=ai_agent_monitoring_tasks,
    processing_deadline_duration=35,
    expires=30,
    silo_mode=SiloMode.CELL,
)
def fetch_llm_model_metadata() -> None:
    """
    Fetch LLM model metadata (costs, context size) from OpenRouter and models.dev APIs
    and store them in cache.

    This task fetches model pricing and context size data from both sources and
    converts it to the LLMModelMetadata format for use by Sentry's LLM cost tracking.
    OpenRouter data takes precedence over models.dev data.
    """
    if settings.SENTRY_AIR_GAP:
        return

    models_dict: dict[ModelId, LLMModelMetadata] = {}

    try:
        for model_id, model_data in _fetch_openrouter_raw():
            metadata = _openrouter_entry_to_metadata(model_id, model_data)
            if metadata is not None:
                models_dict[model_id] = metadata
    except Exception as e:
        logger.warning(
            "Failed to fetch LLM model metadata from OpenRouter API", extra={"error": str(e)}
        )
        raise

    try:
        for model_id, model_data in _fetch_models_dev_raw():
            if model_id not in models_dict:
                metadata = _models_dev_entry_to_metadata(model_id, model_data)
                if metadata is not None:
                    models_dict[model_id] = metadata
    except Exception as e:
        logger.warning(
            "Failed to fetch LLM model metadata from models.dev API", extra={"error": str(e)}
        )
        raise

    _add_glob_model_names(models_dict)

    metadata_config: LLMModelMetadataConfig = {"version": 1, "models": models_dict}
    cache.set(LLM_MODEL_METADATA_CACHE_KEY, metadata_config, LLM_MODEL_METADATA_CACHE_TTL)


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------


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
