import logging
from typing import Required, TypedDict

from django.conf import settings

from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


type ModelId = str


# Legacy cache key for AI model costs (v2 flat format)
# TODO(constantinius): Remove once all consumers have migrated to AI_MODEL_METADATA_CACHE_KEY
AI_MODEL_COSTS_CACHE_KEY = "ai-model-costs:v2"
AI_MODEL_COSTS_CACHE_TTL = 30 * 24 * 60 * 60

# Cache key for storing LLM model metadata (v1 nested format)
AI_MODEL_METADATA_CACHE_KEY = "ai-model-metadata:v1"
# Cache timeout: 30 days (we re-fetch every 30 minutes, so this provides more than enough overlap)
AI_MODEL_METADATA_CACHE_TTL = 30 * 24 * 60 * 60


class AIModelCostV2(TypedDict):
    """Legacy flat format. TODO(constantinius): Remove once all consumers have migrated."""

    inputPerToken: float
    outputPerToken: float
    outputReasoningPerToken: float
    inputCachedPerToken: float
    inputCacheWritePerToken: float


class AIModelCosts(TypedDict):
    """Legacy config type. TODO(constantinius): Remove once all consumers have migrated."""

    version: Required[int]
    models: Required[dict[ModelId, AIModelCostV2]]


class AIModelCost(TypedDict):
    inputPerToken: float
    outputPerToken: float
    outputReasoningPerToken: float
    inputCachedPerToken: float
    inputCacheWritePerToken: float


class AIModelMetadata(TypedDict, total=False):
    costs: Required[AIModelCost]
    contextSize: int


class AIModelMetadataConfig(TypedDict):
    version: Required[int]
    models: Required[dict[ModelId, AIModelMetadata]]


def ai_model_costs_config() -> AIModelCosts | None:
    """
    Legacy: Get AI model costs configuration.
    TODO(constantinius): Remove once all consumers have migrated to ai_model_metadata_config.
    """
    if settings.SENTRY_AIR_GAP:
        return None

    cached_costs = cache.get(AI_MODEL_COSTS_CACHE_KEY)
    if cached_costs is not None:
        return cached_costs

    if not settings.IS_DEV:
        logger.warning("Empty model costs")

    return None


def ai_model_metadata_config() -> AIModelMetadataConfig | None:
    """
    Get LLM model metadata configuration.
    LLM model metadata is set in cache by a cron job,
    if there is no metadata, it should be investigated why.

    Returns:
        AIModelMetadataConfig containing cost and context size information for LLM models
    """
    if settings.SENTRY_AIR_GAP:
        return None

    cached_metadata = cache.get(AI_MODEL_METADATA_CACHE_KEY)
    if cached_metadata is not None:
        return cached_metadata

    if not settings.IS_DEV:
        # in dev environment, we don't want to log this
        logger.warning("Empty LLM model metadata")

    return None
