import logging
from typing import Any

import sentry_sdk

from sentry.http import safe_urlopen
from sentry.relay.config.ai_model_costs import (
    AI_MODEL_COSTS_CACHE_KEY,
    AI_MODEL_COSTS_CACHE_TTL,
    AIModelCosts,
    AIModelCostV2,
    ModelId,
)
from sentry.tasks.base import instrumented_task
from sentry.taskworker.config import TaskworkerConfig
from sentry.taskworker.namespaces import ai_agent_monitoring_tasks
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


# OpenRouter API endpoint
OPENROUTER_MODELS_API_URL = "https://openrouter.ai/api/v1/models"


@instrumented_task(
    name="sentry.tasks.ai_agent_monitoring.fetch_ai_model_costs",
    queue="ai_agent_monitoring",
    default_retry_delay=5,
    max_retries=3,
    soft_time_limit=30,  # 30 seconds
    time_limit=35,  # 35 seconds
    taskworker_config=TaskworkerConfig(
        namespace=ai_agent_monitoring_tasks,
        processing_deadline_duration=35,
        expires=30,
    ),
)
def fetch_ai_model_costs() -> None:
    """
    Fetch AI model costs from OpenRouter API and store them in cache.

    This task fetches model pricing data from OpenRouter and converts it to
    the AIModelCostV2 format for use by Sentry's LLM cost tracking.
    """

    # Fetch data from OpenRouter API
    response = safe_urlopen(
        OPENROUTER_MODELS_API_URL,
    )
    response.raise_for_status()

    # Parse the response
    data = response.json()

    if not isinstance(data, dict) or "data" not in data:
        logger.error(
            "fetch_ai_model_costs.invalid_response_format",
            extra={"response_keys": list(data.keys()) if isinstance(data, dict) else "not_dict"},
        )
        return

    models_data = data["data"]
    if not isinstance(models_data, list):
        logger.error(
            "fetch_ai_model_costs.invalid_models_data_format",
            extra={"type": type(models_data).__name__},
        )
        return

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
            sentry_sdk.capture_exception(e)
            continue

    ai_model_costs: AIModelCosts = {"version": 2, "models": models_dict}
    cache.set(AI_MODEL_COSTS_CACHE_KEY, ai_model_costs, AI_MODEL_COSTS_CACHE_TTL)


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
