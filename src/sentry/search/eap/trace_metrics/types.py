from dataclasses import dataclass
from typing import Literal

TraceMetricType = Literal["counter", "gauge", "distribution"]


@dataclass(frozen=True, kw_only=True)
class TraceMetric:
    metric_name: str
    metric_type: TraceMetricType
    metric_unit: str | None
