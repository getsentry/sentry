"""Read-time rarity scoring for timeseries annotations.
Rarity is org-scoped by ``annotation_type`` over a fixed 90-day lookback (clamped to
org retention when shorter).
"""

from __future__ import annotations

import logging
import math
from datetime import timedelta
from typing import TYPE_CHECKING

from django.db.models import Count
from django.utils import timezone

from sentry import quotas
from sentry.timeseries_annotations.models import TimeseriesAnnotation
from sentry.utils.cache import cache

if TYPE_CHECKING:
    from sentry.models.organization import Organization

logger = logging.getLogger(__name__)

RARITY_LOOKBACK_DAYS = 90
_CACHE_TTL_SECONDS = 10 * 60
_CACHE_KEY = "ta:rarity-counts:v1:{organization_id}"


def rarity_score(count: int) -> float:
    """Log-rarity in (0, 1]. Higher means rarer over the baseline window."""
    return 1.0 / (1.0 + math.log1p(count))


def effective_rarity_window_days(organization: Organization) -> int:
    """Hard-coded 90d lookback, clamped to org retention when retention is shorter."""
    retention_days = quotas.backend.get_event_retention(organization=organization)
    if not retention_days:
        return RARITY_LOOKBACK_DAYS
    return min(RARITY_LOOKBACK_DAYS, retention_days)


def annotation_type_counts(organization: Organization) -> tuple[dict[int, int], int]:
    """
    Return (counts_by_annotation_type, window_days) for the org rarity baseline.

    Counts are cached in Redis. Fail silently.
    """
    window_days = effective_rarity_window_days(organization)
    cache_key = _CACHE_KEY.format(organization_id=organization.id)

    try:
        cached = cache.get(cache_key)
    except Exception:
        cached = None

    if isinstance(cached, dict):
        return {int(key): int(value) for key, value in cached.items()}, window_days

    try:
        cutoff = timezone.now() - timedelta(days=window_days)
        rows = (
            TimeseriesAnnotation.objects.filter(
                organization_id=organization.id,
                start_timestamp__gte=cutoff,
            )
            .values("annotation_type")
            .annotate(c=Count("id"))
        )
        counts = {int(row["annotation_type"]): int(row["c"]) for row in rows}
    except Exception:
        logger.exception("timeseries_annotations.rarity_count_failed")
        return {}, window_days

    try:
        cache.set(
            cache_key,
            {str(key): value for key, value in counts.items()},
            _CACHE_TTL_SECONDS,
        )
    except Exception:
        logger.exception("timeseries_annotations.rarity_cache_set_failed")

    return counts, window_days
