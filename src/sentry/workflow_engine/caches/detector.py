from sentry.workflow_engine.caches.cache_access import CacheAccess
from sentry.workflow_engine.models.detector import Detector

CACHE_TTL = 60 * 3  # 3 minutes
CACHE_PREFIX = "detector:detectors_by_data_source:"


class DetectorByDataSourceCacheAccess(CacheAccess[list[Detector]]):
    def __init__(self, source_id: str, source_type: str):
        self.source_id = source_id
        self.source_type = source_type
        self.cache_key = f"{CACHE_PREFIX}{self.source_type}:{self.source_id}"
        self.cache_ttl = CACHE_TTL

    def key(self) -> str:
        return self.cache_key


def invalidate_detectors_by_data_source_cache(source_id: str, source_type: str) -> None:
    DetectorByDataSourceCacheAccess(source_id, source_type).delete()
