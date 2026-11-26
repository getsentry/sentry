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

    Counts are cached in Redis. Fail open with empty counts so GET list never 500s.
    """
    window_days = effective_rarity_window_days(organization)
    try:
        return _counts_for_window(organization.id, window_days), window_days
    except Exception:
        logger.exception("timeseries_annotations.rarity_count_failed")
        return {}, window_days


def _counts_for_window(organization_id: int, window_days: int) -> dict[int, int]:
    cache_key = _CACHE_KEY.format(organization_id=organization_id)
    cached = _read_cached_counts(cache_key)
    if cached is not None:
        return cached

    counts = _query_type_counts(organization_id, window_days)
    _write_cached_counts(cache_key, counts)
    return counts


def _read_cached_counts(cache_key: str) -> dict[int, int] | None:
    cached = cache.get(cache_key)
    if not isinstance(cached, dict):
        return None
    return {int(key): int(value) for key, value in cached.items()}


def _write_cached_counts(cache_key: str, counts: dict[int, int]) -> None:
    cache.set(
        cache_key,
        {str(key): value for key, value in counts.items()},
        _CACHE_TTL_SECONDS,
    )


def _query_type_counts(organization_id: int, window_days: int) -> dict[int, int]:
    cutoff = timezone.now() - timedelta(days=window_days)
    rows = (
        TimeseriesAnnotation.objects.filter(
            organization_id=organization_id,
            start_timestamp__gte=cutoff,
        )
        .values("annotation_type")
        .annotate(c=Count("id"))
    )
    return {int(row["annotation_type"]): int(row["c"]) for row in rows}
