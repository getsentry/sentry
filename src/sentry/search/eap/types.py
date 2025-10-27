from dataclasses import dataclass, field
from enum import Enum
from typing import Literal, NotRequired, TypedDict

from sentry_protos.snuba.v1.request_common_pb2 import PageToken
from sentry_protos.snuba.v1.trace_item_attribute_pb2 import Reliability

from sentry.search.events.types import EventsResponse


@dataclass(frozen=True)
class FieldsACL:
    functions: set[str] = field(default_factory=set)
    attributes: set[str] = field(default_factory=set)


@dataclass(frozen=True)
class SearchResolverConfig:
    # Automatically add id, etc. if there are no aggregates
    auto_fields: bool = False
    # Ignore aggregate conditions, if false the query will run but not use any aggregate conditions
    use_aggregate_conditions: bool = True
    # TODO: do we need parser_config_overrides? it looks like its just for alerts
    # Whether to process the results from snuba
    process_results: bool = True
    # If a field is private, it will only be available if it is in the `fields_acl`
    fields_acl: FieldsACL = field(default_factory=lambda: FieldsACL())
    # If set to True, do not extrapolate any values regardless of individual aggregate settings
    disable_aggregate_extrapolation: bool = False
    # Whether to set the timestamp granularities to stable buckets
    stable_timestamp_quantization: bool = True


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
    UPTIME_RESULTS = "uptime_results"
    TRACEMETRICS = "tracemetrics"


class AttributeSourceType(str, Enum):
    SENTRY = "sentry"
    USER = "user"


class AttributeSource(TypedDict):
    source_type: AttributeSourceType
    is_transformed_alias: NotRequired[bool]


class TraceItemAttribute(TypedDict):
    name: str
    type: Literal["string", "number"]
    value: str | int | float


class EAPResponse(EventsResponse):
    confidence: ConfidenceData
    page_token: NotRequired[PageToken]


@dataclass()
class AdditionalQueries:
    span: list[str] | None
    log: list[str] | None
    metric: list[str] | None
