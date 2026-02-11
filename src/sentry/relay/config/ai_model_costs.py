import logging
from typing import Required, TypedDict

from django.conf import settings

from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


type ModelId = str


# Cache key for storing AI model costs
AI_MODEL_COSTS_CACHE_KEY = "ai-model-costs:v2"
# Cache timeout: 30 days (we re-fetch every 30 minutes, so this provides more than enough overlap)
AI_MODEL_COSTS_CACHE_TTL = 30 * 24 * 60 * 60


class AIModelCostV2(TypedDict):
    inputPerToken: float
    outputPerToken: float
    outputReasoningPerToken: float
    inputCachedPerToken: float
    inputCacheWritePerToken: float


class AIModelCosts(TypedDict):
    version: Required[int]
    models: Required[dict[ModelId, AIModelCostV2]]


def ai_model_costs_config() -> AIModelCosts | None:
    """
    Get AI model costs configuration.
    AI model costs are set in cache by a cron job,
    if there are no costs, it should be investigated why.

    Returns:
        AIModelCosts object containing cost information for AI models
    """
    if settings.SENTRY_AIR_GAP:
        return None

    cached_costs = cache.get(AI_MODEL_COSTS_CACHE_KEY)
    if cached_costs is not None:
        return cached_costs

    if not settings.IS_DEV:
        # in dev environment, we don't want to log this
        logger.warning("Empty model costs")

    return None
