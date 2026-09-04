import logging
import re
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


def normalize_model_id(model_id: str) -> str:
    """
    Normalize a model id by removing dates and versions.
    Example:
    - "gpt-4" -> "gpt-4"
    - "gpt-4-20241022" -> "gpt-4"
    - "gpt-4-v1.0" -> "gpt-4"
    - "gpt-4-20241022-v1.0" -> "gpt-4"
    - "gpt-4-20241022-v1.0-beta" -> "gpt-4"
    - "gpt-4-20241022-v1.0-beta-1" -> "gpt-4"

    Args:
        model_id: The model id to normalize

    Returns:
        The normalized model id
    """
    return re.sub(
        r"(([-_@])(\d{4}[-/.]\d{2}[-/.]\d{2}|\d{8}))?([-_]v\d+[:.]?\d*([-:].*)?)?$", "", model_id
    )


def prefix_glob_model_name(model_id: str) -> str:
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


def model_costs(model_id: str, config: AIModelMetadataConfig | None) -> AIModelCost | None:
    """Look up per-token prices for a model reported on a span.

    Spans carry provider-specific model names, so the lookup narrows the
    reported id towards how the metadata is keyed: as reported, with dates and
    versions stripped, then again without the namespace a gateway prefixes
    (``anthropic/claude-sonnet-4``), which the pricebook keys without.

    The pricebook also holds a ``*``-prefixed key per model, which is there for
    relay to glob-match against and is not useful here: it is only ever added
    alongside the bare key, so a dict lookup on it can never find a model the
    bare key missed.

    Returns None when there is no metadata at all (air-gapped installs, a cold
    cache) or the model is unknown.
    """
    if config is None:
        return None

    models = config.get("models") or {}
    bare_model_id = model_id.rsplit("/", 1)[-1]
    for key in (
        model_id,
        normalize_model_id(model_id),
        bare_model_id,
        normalize_model_id(bare_model_id),
    ):
        metadata = models.get(key)
        if metadata is not None:
            return metadata.get("costs")
    return None
