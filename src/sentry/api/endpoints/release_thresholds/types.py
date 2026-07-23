from datetime import datetime
from typing import Any, TypedDict

from sentry.models.release_threshold.constants import ThresholdTypeName, TriggerTypeName


class SerializedThreshold(TypedDict, total=False):
    id: str
    date_added: datetime
    environment: dict[str, Any] | None
    project: dict[str, Any]
    release: str
    threshold_type: ThresholdTypeName
    trigger_type: TriggerTypeName
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
