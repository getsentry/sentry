from typing import NamedTuple

from sentry.utils import metrics
from sentry.workflow_engine.caches import CacheMapping
from sentry.workflow_engine.models.data_source import DataSource
from sentry.workflow_engine.types import DetectorId

CACHE_TTL = 60 * 20  # 20 minutes


class _DataSourceCacheKey(NamedTuple):
    detector_id: DetectorId
    source_id: str


_data_sources_by_detector_and_source_id = CacheMapping[_DataSourceCacheKey, list[DataSource]](
    lambda key: f"{key.detector_id}:{key.source_id}",
    namespace="data_source:data_sources_by_detector_and_source_id",
    ttl_seconds=CACHE_TTL,
)


def get_data_sources_by_detector_and_source_id(
    detector_id: DetectorId, source_id: str
) -> list[DataSource]:
    """
    Get data sources from cache, querying the database and populating the cache if necessary.
    """

    with metrics.timer("workflow_engine.bulk_data_source_fetch") as metrics_tags:
        data_source_cache_key = _DataSourceCacheKey(detector_id, source_id)

        data_sources = _data_sources_by_detector_and_source_id.get(data_source_cache_key)

        if data_sources is None:
            metrics_tags["cache_hit"] = "false"

            data_sources = _query_data_sources(detector_id, source_id)

            _data_sources_by_detector_and_source_id.set(data_source_cache_key, data_sources)
        else:
            metrics_tags["cache_hit"] = "true"

        metrics_tags["detector_id"] = detector_id
        metrics_tags["source_id"] = source_id

    return data_sources


def _query_data_sources(detector_id: DetectorId, source_id: str) -> list[DataSource]:
    return list(
        DataSource.objects.filter(
            detectors__id=detector_id,
            source_id=source_id,
        )
    )


def invalidate_data_sources_by_detector_and_source_id_cache(
    detector_id: DetectorId, source_id: str
) -> None:
    data_source_cache_key = _DataSourceCacheKey(detector_id, source_id)

    _data_sources_by_detector_and_source_id.delete(data_source_cache_key)

    metrics.incr("workflow_engine.invalidate_data_sources_by_detector_and_source_id_cache")
