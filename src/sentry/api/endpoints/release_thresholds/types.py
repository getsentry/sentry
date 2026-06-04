from datetime import datetime
from typing import Any, NotRequired, TypedDict


class SerializedThreshold(TypedDict):
    id: NotRequired[str]
    date: NotRequired[datetime]
    environment: NotRequired[dict[str, Any] | None]
    project: NotRequired[dict[str, Any]]
    release: NotRequired[str]
    threshold_type: NotRequired[int]
    trigger_type: NotRequired[str]
    value: NotRequired[int]
    window_in_seconds: NotRequired[int]


class EnrichedThreshold(SerializedThreshold):
    end: datetime
    is_healthy: bool
    key: str
    project_slug: str
    project_id: int
    start: datetime
    metric_value: int | float | None
