from sentry.workflow_engine.caches.cache_access import CacheAccess
from sentry.workflow_engine.models.detector import Detector


def get_detectors_by_data_source_cache_key(source_id: str, source_type: str) -> str:
    """Generate cache key for detector objects lookup by data source."""
    return f"detector:detectors_by_data_source:{source_type}:{source_id}"


class DetectorByDataSourceCacheAccess(CacheAccess[list[Detector]]):
    def __init__(self, source_id: str, source_type: str):
        self.source_id = source_id
        self.source_type = source_type

    def key(self) -> str:
        return get_detectors_by_data_source_cache_key(self.source_id, self.source_type)


def invalidate_detectors_by_data_source_cache(source_id: str, source_type: str) -> None:
    DetectorByDataSourceCacheAccess(source_id, source_type).delete()
