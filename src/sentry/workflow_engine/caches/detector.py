from typing import NamedTuple

from sentry.utils import metrics
from sentry.workflow_engine.caches import CacheMapping
from sentry.workflow_engine.models.detector import Detector

CACHE_TTL = 60 * 20  # 20 minutes


class _DetectorCacheKey(NamedTuple):
    source_id: str
    source_type: str


_detectors_by_data_source = CacheMapping[_DetectorCacheKey, list[Detector]](
    lambda key: f"{key.source_type}:{key.source_id}",
    namespace="detector:detectors_by_data_source",
    ttl_seconds=CACHE_TTL,
)


def get_detectors_by_data_source(source_id: str, query_type: str) -> list[Detector]:
    """
    Get detectors from cache, querying the database and populating the cache if necessary.
    """
    with metrics.timer("workflow_engine.bulk_detector_fetch") as metrics_tags:
        cache_key = _DetectorCacheKey(source_id, query_type)
        detectors = _detectors_by_data_source.get(cache_key)

        if detectors is None:
            metrics_tags["cache_hit"] = "false"
            detectors = _query_detectors(source_id, query_type)
            _detectors_by_data_source.set(cache_key, detectors)
        else:
            metrics_tags["cache_hit"] = "true"

        metrics_tags["source_type"] = query_type
        metrics_tags["detector_type"] = detectors[0].type if detectors else None
    return detectors


def _query_detectors(source_id: str, query_type: str) -> list[Detector]:
    return list(
        Detector.objects.filter(
            data_sources__source_id=source_id,
            data_sources__type=query_type,
            enabled=True,
        )
        .select_related("workflow_condition_group")
        .prefetch_related("workflow_condition_group__conditions")
        .distinct()
        .order_by("id")
    )


def invalidate_detectors_by_data_source_cache(source_id: str, source_type: str) -> None:
    _detectors_by_data_source.delete(_DetectorCacheKey(source_id, source_type))
    metrics.incr(
        "workflow_engine.invalidate_detectors_by_data_source_cache",
        tags={"source_type": source_type},
    )
