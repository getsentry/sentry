from typing import Dict, List, Literal, TypedDict, Union

from typing_extensions import Required


class ParsedMessage(TypedDict, total=False):
    """Internal representation of a parsed ingest metric message for indexer to support generic metrics"""

    use_case_id: Required[str]
    org_id: Required[int]
    project_id: Required[int]
    name: Required[str]
    type: Required["_IngestMetricType"]
    timestamp: Required[int]
    tags: Required[Dict[str, str]]
    value: Required[Union["CounterMetricValue", "SetMetricValue", "DistributionMetricValue"]]
    retention_days: Required[int]


_IngestMetricType = Union[Literal["c"], Literal["d"], Literal["s"]]
CounterMetricValue = Union[int, float]
DistributionMetricValue = List[Union[int, float]]
SetMetricValue = List["_SetMetricValueItem"]
_SetMetricValueItem = int
