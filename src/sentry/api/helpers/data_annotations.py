from __future__ import annotations

import dataclasses
import logging
from typing import Any, Literal, NamedTuple, TypedDict

import sentry_sdk
from packaging import version
from sentry_sdk import traces

from sentry.constants import DataCategory
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.snuba import errors
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.outcomes import QueryDefinition, run_outcomes_query_timeseries
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.trace_metrics import TraceMetrics
from sentry.utils import metrics
from sentry.utils.outcomes import Outcome
from sentry.utils.snuba import parse_snuba_datetime

logger = logging.getLogger(__name__)


class Annotation(TypedDict):
    """One time bucket's volume for a system data-fidelity annotation."""

    type: Literal["system"]
    category: str
    outcome: str
    reason: str
    start: float
    end: float
    eventCount: float


class SuppressedDrop(TypedDict):
    """Drop volume withheld from the dropped annotations as a known misreport."""

    cause: str
    category: str
    outcome: str
    reason: str
    count: int


@dataclasses.dataclass(frozen=True)
class DroppedDataAnnotations:
    dropped: list[Annotation] = dataclasses.field(default_factory=list)
    accepted: list[Annotation] = dataclasses.field(default_factory=list)
    suppressed: list[SuppressedDrop] = dataclasses.field(default_factory=list)


class DropKey(NamedTuple):
    bucket: float
    outcome: str
    reason: str


def record_dropped_events_telemetry(
    *,
    endpoint: str,
    client_kind: str,
    dataset_label: str,
    dropped_count: int,
    accepted_count: int,
) -> None:
    """Record who asked for dropped-events data and what they got."""
    had_drops = dropped_count > 0
    metrics.incr(
        "dropped_events.served",
        tags={
            "endpoint": endpoint,
            "client_kind": client_kind,
            "dataset": dataset_label,
            "had_drops": had_drops,
        },
    )
    sentry_sdk.set_attribute("dropped_events.endpoint", endpoint)
    sentry_sdk.set_attribute("dropped_events.client_kind", client_kind)
    sentry_sdk.set_attribute("dropped_events.dataset", dataset_label)
    sentry_sdk.set_attribute("dropped_events.dropped_count", dropped_count)
    sentry_sdk.set_attribute("dropped_events.accepted_count", accepted_count)
    sentry_sdk.set_attribute("dropped_events.had_drops", had_drops)


DROPPED_OUTCOMES: tuple[Outcome, ...] = tuple(o for o in Outcome if o is not Outcome.ACCEPTED)


INTENTIONAL = "intentional"
UNINTENTIONAL = "unintentional"

_INTENTIONAL_REASONS_BY_OUTCOME: dict[str, frozenset[str]] = {
    Outcome.CLIENT_DISCARD.api_name(): frozenset(
        {"before_send", "event_processor", "ignored", "no_parent_span", "sample_rate"}
    ),
    Outcome.INVALID.api_name(): frozenset({"cors", "missing_signature", "transaction_sampled"}),
    Outcome.RATE_LIMITED.api_name(): frozenset({"key_quota"}),
}


def classify_drop(outcome: str, reason: str) -> str:
    """Tag a drop as intentional (user-configured) or unintentional.

    Every ``filtered`` drop is intentional because inbound filters are project
    settings. Unrecognized drops default to unintentional so they stay visible.
    """
    if outcome == Outcome.FILTERED.api_name() or reason in _INTENTIONAL_REASONS_BY_OUTCOME.get(
        outcome, frozenset()
    ):
        return INTENTIONAL
    return UNINTENTIONAL


DEFAULT_DROP_THRESHOLD = 1

DATASET_TO_CATEGORY: dict[object, DataCategory] = {
    Spans: DataCategory.SPAN,
    OurLogs: DataCategory.LOG_ITEM,
    TraceMetrics: DataCategory.TRACE_METRIC,
    errors: DataCategory.ERROR,
}

_ACCEPTED_NAME = Outcome.ACCEPTED.api_name()


def _bucket_start_ms(raw_time: object) -> float | None:
    if not raw_time:
        return None
    return parse_snuba_datetime(str(raw_time)).timestamp() * 1000


def _run_category_query(
    category: DataCategory,
    snuba_params: SnubaParams,
    rollup: int,
    organization_id: int,
) -> list[dict[str, Any]]:
    """Run one bucketed Outcomes query over a single category.

    The query always fetches accepted plus every drop outcome, grouped by
    ``outcome`` and ``reason``. It is deliberately not narrowed by the endpoint's
    ``outcome``/``reason`` filters: accepted (the share denominator) must come
    back in full regardless, so the caller fetches everything here and narrows
    only the dropped rows afterward. ``group_by`` keeps each (outcome, reason)
    drop separate while accepted collapses to one total per bucket.
    """
    query = QueryDefinition(
        fields=["sum(quantity)"],
        start=snuba_params.start_date.isoformat(),
        end=snuba_params.end_date.isoformat(),
        organization_id=organization_id,
        project_ids=snuba_params.project_ids,
        interval=f"{rollup}s",
        # ACCEPTED is the share denominator; the rest are the drop classifications.
        outcome=[Outcome.ACCEPTED.api_name(), *(o.api_name() for o in DROPPED_OUTCOMES)],
        group_by=["outcome", "reason"],
        category=[category.api_name()],
    )
    return run_outcomes_query_timeseries(query, tenant_ids={"organization_id": organization_id})


def _accepted_by_bucket(rows: list[dict[str, Any]]) -> dict[float, int]:
    """Sum accepted quantity per bucket. Accepted is chart-wide within a bucket,
    so it collapses across outcome/reason into one total per bucket."""
    accepted: dict[float, int] = {}
    accepted_name = Outcome.ACCEPTED.api_name()
    for row in rows:
        if str(row.get("outcome", "")) != accepted_name:
            continue
        bucket = _bucket_start_ms(row.get("time"))
        if bucket is None:
            continue
        accepted[bucket] = accepted.get(bucket, 0) + int(row.get("quantity", 0) or 0)
    return accepted


def _dropped_by_bucket_reason(
    rows: list[dict[str, Any]],
    *,
    outcome_filter: str | None = None,
    reason_filter: str | None = None,
) -> dict[DropKey, int]:
    """Sum dropped quantity keyed by (bucket, outcome, reason), keeping only the
    drops that match ``outcome_filter`` and ``reason_filter`` when given."""
    dropped: dict[DropKey, int] = {}
    accepted_name = Outcome.ACCEPTED.api_name()
    for row in rows:
        outcome = str(row.get("outcome", ""))
        if outcome == accepted_name:
            continue
        if outcome_filter is not None and outcome != outcome_filter:
            continue
        bucket = _bucket_start_ms(row.get("time"))
        if bucket is None:
            continue
        reason = row.get("reason")
        reason_key = str(reason) if reason is not None else outcome
        if reason_filter is not None and reason_key != reason_filter:
            continue
        key = DropKey(bucket, outcome, reason_key)
        dropped[key] = dropped.get(key, 0) + int(row.get("quantity", 0) or 0)
    return dropped


# JavaScript SDKs before 11.0.0 misreport log `buffer_overflow` client discards.
# Remove this suppression once those SDK versions are fixed.
_JS_SDK_BUFFER_OVERFLOW_CAUSE = "js_sdk_below_11"
_BUFFER_OVERFLOW_REASON = "buffer_overflow"
_JS_SDK_BUFFER_OVERFLOW_FIXED_MAJOR = 11
_JS_SDK_VERSIONS_LIMIT = 1000


def _is_js_sdk_buffer_overflow(outcome: str, reason: str) -> bool:
    return outcome == Outcome.CLIENT_DISCARD.api_name() and reason == _BUFFER_OVERFLOW_REASON


def _has_affected_js_sdk(snuba_params: SnubaParams) -> bool:
    """Whether any selected project sent logs from a JavaScript SDK older than the fix."""
    result = OurLogs.run_table_query(
        params=dataclasses.replace(snuba_params, environments=[]),
        query_string="sdk.name:sentry.javascript.*",
        selected_columns=["sdk.version", "count()"],
        orderby=None,
        offset=0,
        limit=_JS_SDK_VERSIONS_LIMIT,
        referrer=Referrer.API_EXPLORE_DROPPED_DATA_SDK_VERSIONS.value,
        config=SearchResolverConfig(),
        sampling_mode=None,
    )
    for row in result.get("data", []):
        try:
            sdk_version = version.parse(str(row.get("sdk.version")))
        except version.InvalidVersion:
            continue
        if sdk_version.major < _JS_SDK_BUFFER_OVERFLOW_FIXED_MAJOR:
            return True
    return False


def _suppress_js_sdk_buffer_overflow(
    dropped_by_key: dict[DropKey, int],
    category: DataCategory,
    snuba_params: SnubaParams,
) -> tuple[dict[DropKey, int], list[SuppressedDrop]]:
    """Withhold log `buffer_overflow` drops when an affected JavaScript SDK is
    seen in the selected projects. Drops are left untouched when no affected SDK
    is seen or the lookup fails, so only confirmed misreports are hidden."""
    if category != DataCategory.LOG_ITEM or not any(
        _is_js_sdk_buffer_overflow(key.outcome, key.reason) for key in dropped_by_key
    ):
        return dropped_by_key, []

    try:
        has_affected_sdk = _has_affected_js_sdk(snuba_params)
    except Exception:
        sentry_sdk.capture_exception()
        return dropped_by_key, []
    if not has_affected_sdk:
        return dropped_by_key, []

    remaining: dict[DropKey, int] = {}
    suppressed_count = 0
    for key, count in dropped_by_key.items():
        if _is_js_sdk_buffer_overflow(key.outcome, key.reason):
            suppressed_count += count
        else:
            remaining[key] = count
    return remaining, [
        SuppressedDrop(
            cause=_JS_SDK_BUFFER_OVERFLOW_CAUSE,
            category=category.api_name(),
            outcome=Outcome.CLIENT_DISCARD.api_name(),
            reason=_BUFFER_OVERFLOW_REASON,
            count=suppressed_count,
        )
    ]


def get_dropped_data_annotations(
    dataset: object,
    snuba_params: SnubaParams,
    rollup: int,
    *,
    threshold: int = DEFAULT_DROP_THRESHOLD,
    outcome: str | None = None,
    reason: str | None = None,
) -> DroppedDataAnnotations:
    """Build dropped and accepted data-fidelity annotations for a timeseries query.
    - ``dropped``: one per (bucket, outcome, reason) drop.
    - ``accepted``: one per bucket, carrying that bucket's accepted volume.
    - ``suppressed``: drop volume withheld from ``dropped`` because it is a
      known SDK misreport.

    ``outcome`` and ``reason`` optionally narrow the *dropped* side to a single
    classification: ``outcome`` is the top-level drop class (e.g. ``rate_limited``)
    and ``reason`` the sub-classification within it (e.g. ``spike_protection``).
    The accepted side is never filtered — it is the share denominator and carries
    no outcome or reason — so a scoped request still returns the complete accepted
    volume alongside the one dropped series.

    Buckets align to the chart because ``rollup`` is the interval the endpoint
    already resolved for the series.
    """
    category = DATASET_TO_CATEGORY.get(dataset)
    if category is None:
        return DroppedDataAnnotations()
    if snuba_params.organization_id is None:
        logger.warning("data_annotations.missing_organization", extra={"dataset": str(dataset)})
        return DroppedDataAnnotations()
    organization_id = snuba_params.organization_id

    with traces.start_span(
        name="data_annotations.get_dropped_data",
        attributes={
            "sentry.op": "data_annotations.get_dropped_data",
            "category": category.api_name(),
        },
    ) as span:
        item_rows = _run_category_query(category, snuba_params, rollup, organization_id)
        accepted_by_bucket = _accepted_by_bucket(item_rows)
        dropped_by_key = _dropped_by_bucket_reason(
            item_rows, outcome_filter=outcome, reason_filter=reason
        )
        dropped_by_key, suppressed_drops = _suppress_js_sdk_buffer_overflow(
            dropped_by_key, category, snuba_params
        )

        dropped_annotations: list[Annotation] = []
        for key, dropped in dropped_by_key.items():
            if dropped < threshold:
                continue
            annotation = Annotation(
                type="system",
                category=category.api_name(),
                outcome=key.outcome,
                reason=key.reason,
                start=key.bucket,
                end=key.bucket + rollup * 1000,
                eventCount=dropped,
            )
            dropped_annotations.append(annotation)

        accepted_annotations: list[Annotation] = []
        for bucket_start_ms in sorted(accepted_by_bucket):
            annotation = Annotation(
                type="system",
                category=category.api_name(),
                outcome=_ACCEPTED_NAME,
                reason=_ACCEPTED_NAME,
                start=bucket_start_ms,
                end=bucket_start_ms + rollup * 1000,
                eventCount=accepted_by_bucket.get(bucket_start_ms, 0),
            )
            accepted_annotations.append(annotation)

        span.set_attribute("dropped_annotation_count", len(dropped_annotations))
        span.set_attribute("accepted_annotation_count", len(accepted_annotations))
        span.set_attribute("suppressed_drop_count", sum(drop["count"] for drop in suppressed_drops))
        return DroppedDataAnnotations(
            dropped=dropped_annotations,
            accepted=accepted_annotations,
            suppressed=suppressed_drops,
        )
