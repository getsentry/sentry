"""
This module introduces a single unique identifier (similar to a Uniform Resource Identifier, URI),
called the Metric Resource Identifier (MRI) for each metric name extracted from sessions and
transactions.

MRIs have the format <type>:<ns>/<name>@<unit>, comprising the following components:
  - Type: counter (c), set (s), distribution (d), gauge (g), and evaluated (e) for derived numeric
metrics.
  - Namespace: Identifying the product entity and use case affiliation of the metric.
  - Name: The display name of the metric in the allowed character set.
  - Unit: The verbatim unit name.
Any Enum defined here but does not have a corresponding Enum name in `public.py` is considered
and treated as an internal implementation detail which is not queryable by the API.
As an example, `SessionMRI.ERRORED_PREAGGREGATED` has no corresponding enum in `SessionMetricKey`
and so it is a private metric, whereas `SessionMRI.CRASH_FREE_RATE` has a corresponding enum in
`SessionMetricKey` with the same name i.e. `SessionMetricKey.CRASH_FREE_RATE` and hence is a public
metric that is queryable by the API.
"""

__all__ = (
    "SessionMRI",
    "TransactionMRI",
    "SpanMRI",
    "MRI_SCHEMA_REGEX",
    "MRI_EXPRESSION_REGEX",
    "ErrorsMRI",
    "parse_mri",
    "get_available_operations",
    "is_mri_field",
    "parse_mri_field",
    "format_mri_field",
    "format_mri_field_value",
)

import re
from dataclasses import dataclass
from enum import Enum
from typing import cast

from sentry_kafka_schemas.codecs import ValidationError

from sentry.exceptions import InvalidParams
from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.snuba.metrics.units import format_value_using_unit_and_op
from sentry.snuba.metrics.utils import (
    AVAILABLE_GENERIC_OPERATIONS,
    AVAILABLE_OPERATIONS,
    OP_REGEX,
    MetricEntity,
    MetricOperationType,
)

MRI_SCHEMA_REGEX_STRING = r"(?P<entity>[^:]+):(?P<namespace>[^/]+)/(?P<name>[^@]+)@(?P<unit>.+)"
MRI_SCHEMA_REGEX = re.compile(rf"^{MRI_SCHEMA_REGEX_STRING}$")
MRI_EXPRESSION_REGEX = re.compile(rf"^{OP_REGEX}\(({MRI_SCHEMA_REGEX_STRING})\)$")


class SessionMRI(Enum):
    # Ingested
    # Do *not* use these metrics in product queries. Use the derived metrics below instead.
    # The raw metrics do not necessarily add up in intuitive ways. For example, `RAW_SESSION`
    # double-counts crashed sessions.
    RAW_SESSION = "c:sessions/session@none"
    RAW_ERROR = "s:sessions/error@none"
    RAW_USER = "s:sessions/user@none"
    RAW_DURATION = "d:sessions/duration@second"

    # Derived
    ALL = "e:sessions/all@none"
    HEALTHY = "e:sessions/healthy@none"
    ERRORED = "e:sessions/errored@none"
    ERRORED_PREAGGREGATED = "e:sessions/error.preaggr@none"
    ERRORED_SET = "e:sessions/error.unique@none"
    ERRORED_ALL = "e:sessions/all_errored@none"
    CRASHED_AND_ABNORMAL = "e:sessions/crashed_abnormal@none"
    CRASHED = "e:sessions/crashed@none"
    CRASH_FREE = "e:sessions/crash_free@none"
    ABNORMAL = "e:sessions/abnormal@none"
    CRASH_RATE = "e:sessions/crash_rate@ratio"
    CRASH_FREE_RATE = "e:sessions/crash_free_rate@ratio"
    ALL_USER = "e:sessions/user.all@none"
    HEALTHY_USER = "e:sessions/user.healthy@none"
    ERRORED_USER = "e:sessions/user.errored@none"
    ERRORED_USER_ALL = "e:sessions/user.all_errored@none"
    CRASHED_AND_ABNORMAL_USER = "e:sessions/user.crashed_abnormal@none"
    CRASHED_USER = "e:sessions/user.crashed@none"
    CRASH_FREE_USER = "e:sessions/user.crash_free@none"
    ABNORMAL_USER = "e:sessions/user.abnormal@none"
    CRASH_USER_RATE = "e:sessions/user.crash_rate@ratio"
    CRASH_FREE_USER_RATE = "e:sessions/user.crash_free_rate@ratio"
    ANR_USER = "e:sessions/user.anr@none"
    ANR_RATE = "e:sessions/user.anr_rate@ratio"
    FOREGROUND_ANR_USER = "e:sessions/user.foreground_anr@none"
    FOREGROUND_ANR_RATE = "e:sessions/user.foreground_anr_rate@ratio"
    DURATION = "d:sessions/duration.exited@second"


class TransactionMRI(Enum):
    # Ingested
    USER = "s:transactions/user@none"
    DURATION = "d:transactions/duration@millisecond"
    COUNT_PER_ROOT_PROJECT = "c:transactions/count_per_root_project@none"
    MEASUREMENTS_FCP = "d:transactions/measurements.fcp@millisecond"
    MEASUREMENTS_LCP = "d:transactions/measurements.lcp@millisecond"
    MEASUREMENTS_APP_START_COLD = "d:transactions/measurements.app_start_cold@millisecond"
    MEASUREMENTS_APP_START_WARM = "d:transactions/measurements.app_start_warm@millisecond"
    MEASUREMENTS_CLS = "d:transactions/measurements.cls@none"
    MEASUREMENTS_FID = "d:transactions/measurements.fid@millisecond"
    MEASUREMENTS_FP = "d:transactions/measurements.fp@millisecond"
    MEASUREMENTS_FRAMES_FROZEN = "d:transactions/measurements.frames_frozen@none"
    MEASUREMENTS_FRAMES_FROZEN_RATE = "d:transactions/measurements.frames_frozen_rate@ratio"
    MEASUREMENTS_FRAMES_SLOW = "d:transactions/measurements.frames_slow@none"
    MEASUREMENTS_FRAMES_SLOW_RATE = "d:transactions/measurements.frames_slow_rate@ratio"
    MEASUREMENTS_FRAMES_TOTAL = "d:transactions/measurements.frames_total@none"
    MEASUREMENTS_TIME_TO_INITIAL_DISPLAY = (
        "d:transactions/measurements.time_to_initial_display@millisecond"
    )
    MEASUREMENTS_TIME_TO_FULL_DISPLAY = (
        "d:transactions/measurements.time_to_full_display@millisecond"
    )
    MEASUREMENTS_STALL_COUNT = "d:transactions/measurements.stall_count@none"
    MEASUREMENTS_STALL_LONGEST_TIME = "d:transactions/measurements.stall_longest_time@millisecond"
    MEASUREMENTS_STALL_PERCENTAGE = "d:transactions/measurements.stall_percentage@ratio"
    MEASUREMENTS_STALL_TOTAL_TIME = "d:transactions/measurements.stall_total_time@millisecond"
    MEASUREMENTS_TTFB = "d:transactions/measurements.ttfb@millisecond"
    MEASUREMENTS_TTFB_REQUEST_TIME = "d:transactions/measurements.ttfb.requesttime@millisecond"
    BREAKDOWNS_HTTP = "d:transactions/breakdowns.span_ops.ops.http@millisecond"
    BREAKDOWNS_DB = "d:transactions/breakdowns.span_ops.ops.db@millisecond"
    BREAKDOWNS_BROWSER = "d:transactions/breakdowns.span_ops.ops.browser@millisecond"
    BREAKDOWNS_RESOURCE = "d:transactions/breakdowns.span_ops.ops.resource@millisecond"

    # Derived
    ALL = "e:transactions/all@none"
    ALL_DURATION = "e:transactions/all_duration@none"
    FAILURE_COUNT = "e:transactions/failure_count@none"
    FAILURE_RATE = "e:transactions/failure_rate@ratio"
    SATISFIED = "e:transactions/satisfied@none"
    TOLERATED = "e:transactions/tolerated@none"
    APDEX = "e:transactions/apdex@ratio"
    MISERABLE_USER = "e:transactions/user.miserable@none"
    ALL_USER = "e:transactions/user.all@none"
    USER_MISERY = "e:transactions/user_misery@ratio"
    TEAM_KEY_TRANSACTION = "e:transactions/team_key_transaction@none"
    HTTP_ERROR_COUNT = "e:transactions/http_error_count@none"
    HTTP_ERROR_RATE = "e:transactions/http_error_rate@ratio"

    # Spans (might be moved to their own namespace soon)
    SPAN_USER = "s:spans/user@none"
    SPAN_DURATION = "d:spans/duration@millisecond"
    SPAN_SELF_TIME = "d:spans/exclusive_time@millisecond"
    SPAN_SELF_TIME_LIGHT = "d:spans/exclusive_time_light@millisecond"

    COUNT_ON_DEMAND = "c:transactions/on_demand@none"
    DIST_ON_DEMAND = "d:transactions/on_demand@none"
    SET_ON_DEMAND = "s:transactions/on_demand@none"

    # Less granular coarse metrics
    DURATION_LIGHT = "d:transactions/duration_light@millisecond"


class SpanMRI(Enum):
    USER = "s:spans/user@none"
    DURATION = "d:spans/duration@millisecond"
    COUNT_PER_ROOT_PROJECT = "c:spans/count_per_root_project@none"
    SELF_TIME = "d:spans/exclusive_time@millisecond"
    SELF_TIME_LIGHT = "d:spans/exclusive_time_light@millisecond"

    # Measurement-based metrics
    AI_TOTAL_TOKENS = "c:spans/ai.total_tokens.used@none"
    AI_TOTAL_COST = "c:spans/ai.total_cost@usd"
    CACHE_ITEM_SIZE = "d:spans/cache.item_size@byte"
    DECODED_RESPONSE_CONTENT_LENGTH = "d:spans/http.decoded_response_content_length@byte"
    MESSAGE_RECEIVE_LATENCY = "g:spans/messaging.message.receive.latency@millisecond"
    MOBILE_FRAMES_DELAY = "g:spans/mobile.frames_delay@second"
    MOBILE_FROZEN_FRAMES = "g:spans/mobile.frozen_frames@none"
    MOBILE_SLOW_FRAMES = "g:spans/mobile.slow_frames@none"
    MOBILE_TOTAL_FRAMES = "g:spans/mobile.total_frames@none"
    RESPONSE_CONTENT_LENGTH = "d:spans/http.response_content_length@byte"
    RESPONSE_TRANSFER_SIZE = "d:spans/http.response_transfer_size@byte"
    WEB_VITALS_INP = "d:spans/webvital.inp@millisecond"
    WEB_VITALS_SCORE_INP = "d:spans/webvital.score.inp@ratio"
    WEB_VITALS_SCORE_TOTAL = "d:spans/webvital.score.total@ratio"
    WEB_VITALS_SCORE_WEIGHT = "d:spans/webvital.score.weight.inp@ratio"

    # Derived
    ALL = "e:spans/all@none"
    ALL_LIGHT = "e:spans_light/all@none"
    HTTP_ERROR_COUNT = "e:spans/http_error_count@none"
    HTTP_ERROR_RATE = "e:spans/http_error_rate@ratio"
    HTTP_ERROR_COUNT_LIGHT = "e:spans/http_error_count_light@none"
    HTTP_ERROR_RATE_LIGHT = "e:spans/http_error_rate_light@ratio"


class ErrorsMRI(Enum):
    EVENT_INGESTED = "c:escalating_issues/event_ingested@none"


@dataclass
class ParsedMRI:
    entity: str
    namespace: str
    name: str
    unit: str

    @property
    def mri_string(self) -> str:
        return f"{self.entity}:{self.namespace}/{self.name}@{self.unit}"


@dataclass
class ParsedMRIField:
    op: MetricOperationType
    mri: ParsedMRI

    def __str__(self) -> str:
        return f"{self.op}({self.mri.name})"


def parse_mri_field(field: str | None) -> ParsedMRIField | None:
    if field is None:
        return None

    matches = MRI_EXPRESSION_REGEX.match(field)

    if matches is None:
        return None

    try:
        op = cast(MetricOperationType, matches[1])
        mri = ParsedMRI(**matches.groupdict())
    except (IndexError, TypeError):
        return None

    return ParsedMRIField(op=op, mri=mri)


def is_mri_field(field: str) -> bool:
    """
    Returns True if the passed value is an MRI field.
    """
    return parse_mri_field(field) is not None


def format_mri_field(field: str) -> str:
    """
    Format a metric field to be used in a metric expression.

    For example, if the field is `avg(c:transactions/foo@none)`, it will be returned as `avg(foo)`.
    """
    try:
        parsed = parse_mri_field(field)

        if parsed:
            return str(parsed)

        else:
            return field

    except InvalidParams:
        return field


def format_mri_field_value(field: str, value: str) -> str:
    """
    Formats MRI field value to a human-readable format using unit.

    For example, if the value of avg(c:transactions/duration@second) is 60,
    it will be returned as 1 minute.

    """
    try:
        parsed_mri_field = parse_mri_field(field)
        if parsed_mri_field is None:
            return value

        return format_value_using_unit_and_op(
            float(value), parsed_mri_field.mri.unit, parsed_mri_field.op
        )

    except InvalidParams:
        return value


def parse_mri(mri_string: str | None) -> ParsedMRI | None:
    """
    Parse a mri string to determine its entity, namespace, name and unit.
    """
    if mri_string is None:
        return None

    match = MRI_SCHEMA_REGEX.match(mri_string)
    if match is None:
        return None

    return ParsedMRI(**match.groupdict())


def is_mri(mri_string: str | None) -> bool:
    """
    Returns true if the passed value is a mri.
    """
    return parse_mri(mri_string) is not None


def is_custom_metric(parsed_mri: ParsedMRI) -> bool:
    """
    A custom mri is a mri which uses the custom namespace, and it's different from a custom measurement.
    """
    return parsed_mri.namespace == "custom"


def is_measurement(parsed_mri: ParsedMRI) -> bool:
    """
    A measurement won't use the custom namespace, but will be under the transaction namespace.

    This checks the namespace, and name to match what we consider to be a standard + custom measurement.
    """
    return parsed_mri.namespace == "transactions" and parsed_mri.name.startswith("measurements.")


def is_custom_measurement(parsed_mri: ParsedMRI) -> bool:
    """
    A custom measurement won't use the custom namespace, but will be under the transaction namespace.

    This checks the namespace, and name to match what we expect first before iterating through the
    members of the transaction MRI enum to make sure it isn't a standard measurement.
    """
    return (
        parsed_mri.namespace == "transactions"
        and parsed_mri.name.startswith("measurements.")
        and
        # Iterate through the transaction MRI and check that this parsed_mri isn't in there
        all(parsed_mri.mri_string != mri.value for mri in TransactionMRI.__members__.values())
    )


_ENTITY_KEY_MAPPING_GENERIC: dict[str, MetricEntity] = {
    "c": "generic_metrics_counters",
    "s": "generic_metrics_sets",
    "d": "generic_metrics_distributions",
    "g": "generic_metrics_gauges",
}
_ENTITY_KEY_MAPPING_NON_GENERIC: dict[str, MetricEntity] = {
    "c": "metrics_counters",
    "s": "metrics_sets",
    "d": "metrics_distributions",
}


def get_available_operations(parsed_mri: ParsedMRI) -> list[MetricOperationType]:
    if parsed_mri.entity == "e":
        return []
    elif parsed_mri.namespace == "sessions":
        entity_key = _ENTITY_KEY_MAPPING_NON_GENERIC[parsed_mri.entity]
        return AVAILABLE_OPERATIONS[entity_key]
    else:
        entity_key = _ENTITY_KEY_MAPPING_GENERIC[parsed_mri.entity]
        return AVAILABLE_GENERIC_OPERATIONS[entity_key]


def extract_use_case_id(mri: str) -> UseCaseID:
    """
    Returns the use case ID given the MRI, throws an error if MRI is invalid or the use case doesn't exist.
    """
    parsed_mri = parse_mri(mri)
    if parsed_mri is not None:
        if parsed_mri.namespace in {id.value for id in UseCaseID}:
            return UseCaseID(parsed_mri.namespace)

        raise ValidationError(f"The use case of the MRI {parsed_mri.namespace} does not exist")

    raise ValidationError(f"The MRI {mri} is not valid")
