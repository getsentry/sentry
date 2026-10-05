import logging
from typing import Required, TypedDict

from django.conf import settings

from sentry.utils.cache import cache

logger = logging.getLogger(__name__)


type ModelId = str


# Cache key for storing AI model metadata
AI_MODEL_METADATA_CACHE_KEY = "ai-model-metadata:v1"
# Cache timeout: 30 days (we re-fetch every 30 minutes, so this provides more than enough overlap)
AI_MODEL_METADATA_CACHE_TTL = 30 * 24 * 60 * 60


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


def ai_model_metadata_config() -> AIModelMetadataConfig | None:
    """
    Get AI model metadata configuration.
    AI model metadata is set in cache by a cron job,
    if there is no metadata, it should be investigated why.

    Returns:
        AIModelMetadataConfig containing cost and context size information for AI models
    """
    if settings.SENTRY_AIR_GAP:
        return None

    cached_metadata = cache.get(AI_MODEL_METADATA_CACHE_KEY)
    if cached_metadata is not None:
        return cached_metadata

    if not settings.IS_DEV:
        # in dev environment, we don't want to log this
        logger.warning("Empty AI model metadata")

    return None
