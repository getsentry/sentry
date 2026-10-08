from __future__ import annotations

from enum import StrEnum

# Denotes how data was accessed for the operation. Used for the `save_event.resolve_model` metric.
DATA_ACCESS_TAG = "data_access"


class DataAccessTagValues(StrEnum):
    """Tag values for `DATA_ACCESS`.

    Denote how data was accessed for the operation.
    """

    CACHE_HIT = "cache_hit"
    DB_READ = "db_read"
    DB_CREATE = "db_create"
    DB_UPDATE = "db_update"
    UNKNOWN = "unknown"
