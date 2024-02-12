from datetime import datetime
from typing import Any, TypedDict


class SerializedThreshold(TypedDict, total=False):
    id: str
    date: datetime
    environment: dict[str, Any] | None
    project: dict[str, Any]
    release: str
    threshold_type: int
    trigger_type: str
    value: int
    window_in_seconds: int


class EnrichedThreshold(SerializedThreshold):
    end: datetime
    is_healthy: bool
    key: str
    project_slug: str
    project_id: int
    start: datetime
    metric_value: int | float | None
