from dataclasses import dataclass, field
from enum import Enum
from typing import Literal, TypedDict

from sentry_protos.snuba.v1.trace_item_attribute_pb2 import Reliability

from sentry.search.events.types import EventsResponse


@dataclass(frozen=True)
class SearchResolverConfig:
    # Automatically add id, etc. if there are no aggregates
    auto_fields: bool = False
    # Ignore aggregate conditions, if false the query will run but not use any aggregate conditions
    use_aggregate_conditions: bool = True
    # TODO: do we need parser_config_overrides? it looks like its just for alerts
    # Whether to process the results from snuba
    process_results: bool = True
    # If a `FunctionDefinition` is private, it will only be available if it is in the `functions_acl`
    functions_acl: set[str] = field(default_factory=set)


CONFIDENCES: dict[Reliability.ValueType, Literal["low", "high"]] = {
    Reliability.RELIABILITY_LOW: "low",
    Reliability.RELIABILITY_HIGH: "high",
}
Confidence = Literal["low", "high"] | None
ConfidenceData = list[dict[str, Confidence]]


# These are the strings that are used in the API for convienence
class SupportedTraceItemType(str, Enum):
    LOGS = "logs"
    SPANS = "spans"


class TraceItemAttribute(TypedDict):
    name: str
    type: Literal["string", "number"]
    value: str | int | float


class EAPResponse(EventsResponse):
    confidence: ConfidenceData
