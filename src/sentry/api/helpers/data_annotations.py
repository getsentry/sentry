from __future__ import annotations

import logging
from typing import Any

import sentry_sdk

from sentry.api.endpoints.timeseries import Annotation, BucketAccepted
from sentry.constants import DataCategory
from sentry.search.events.types import SnubaParams
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.outcomes import QueryDefinition, run_outcomes_query_timeseries
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.trace_metrics import TraceMetrics
from sentry.utils.outcomes import Outcome
from sentry.utils.snuba import parse_snuba_datetime

logger = logging.getLogger(__name__)

DROPPED_OUTCOMES: tuple[Outcome, ...] = (
    Outcome.FILTERED,
    Outcome.RATE_LIMITED,
    Outcome.INVALID,
    Outcome.ABUSE,
    Outcome.CLIENT_DISCARD,
    Outcome.CARDINALITY_LIMITED,
)


DEFAULT_DROP_THRESHOLD = 1

DATASET_TO_CATEGORY: dict[object, DataCategory] = {
    Spans: DataCategory.SPAN,
    OurLogs: DataCategory.LOG_ITEM,
    TraceMetrics: DataCategory.TRACE_METRIC,
}

# Only for logs dropped/accepted bytes outcome is emitted.
DATASET_TO_BYTE_CATEGORY: dict[object, DataCategory] = {
    OurLogs: DataCategory.LOG_BYTE,
}

_REASON_LABELS: dict[str, str] = {
    "over_quota": "Quota exceeded",
    "grace_period": "Quota grace period",
    "smart_rate_limit": "Spike protection",
    "spike_protection": "Spike protection",
}
_OUTCOME_LABELS: dict[str, str] = {
    Outcome.FILTERED.api_name(): "Inbound filter",
    Outcome.RATE_LIMITED.api_name(): "Rate limited",
    Outcome.INVALID.api_name(): "Invalid or malformed",
    Outcome.ABUSE.api_name(): "Abuse limit",
    Outcome.CLIENT_DISCARD.api_name(): "Client discard",
    Outcome.CARDINALITY_LIMITED.api_name(): "Cardinality limited",
}


def _label_for(outcome: str, reason: str | None) -> str:
    if reason and reason in _REASON_LABELS:
        return _REASON_LABELS[reason]
    return _OUTCOME_LABELS.get(outcome, outcome)


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

    Includes both accepted and dropped outcomes, grouped by ``outcome`` and
    ``reason`` so a caller can split accepted (the share denominator) from each
    per-reason drop.
    """
    query = QueryDefinition(
        fields=["sum(quantity)"],
        start=snuba_params.start_date.isoformat(),
        end=snuba_params.end_date.isoformat(),
        organization_id=organization_id,
        project_ids=snuba_params.project_ids,
        interval=f"{rollup}s",
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


def _dropped_by_bucket_reason(rows: list[dict[str, Any]]) -> dict[tuple[float, str, str], int]:
    """Sum dropped quantity keyed by (bucket, outcome, reason)."""
    dropped: dict[tuple[float, str, str], int] = {}
    accepted_name = Outcome.ACCEPTED.api_name()
    for row in rows:
        outcome = str(row.get("outcome", ""))
        if outcome == accepted_name:
            continue
        bucket = _bucket_start_ms(row.get("time"))
        if bucket is None:
            continue
        reason = row.get("reason")
        reason_key = str(reason) if reason is not None else outcome
        key = (bucket, outcome, reason_key)
        dropped[key] = dropped.get(key, 0) + int(row.get("quantity", 0) or 0)
    return dropped


def get_dropped_data_annotations(
    dataset: object,
    snuba_params: SnubaParams,
    rollup: int,
    *,
    threshold: int = DEFAULT_DROP_THRESHOLD,
) -> tuple[list[Annotation], list[BucketAccepted]]:
    """Build dropped-data annotations and per-bucket accepted volume.

    Returns ``(annotations, accepted_by_bucket)``:
    - ``annotations``: one per (bucket, outcome, reason) drop, carrying the item
      count dropped and — for datasets with a paired byte category (logs only
      today) — the bytes dropped.
    - ``accepted_by_bucket``: accepted volume per bucket. Accepted is a property
      of the bucket (baseline traffic), not of an individual drop, so it is
      returned once per bucket rather than repeated on every annotation. A
      consumer joins the two on ``start`` to compute a drop's share.

    Only buckets that carry at least one over-threshold drop get an accepted
    entry — there is no point sending baseline traffic for buckets with nothing
    dropped.

    Buckets align to the chart because ``rollup`` is the interval the endpoint
    already resolved for the series.
    """
    # Unsupported dataset is the normal v0 (EAP-only) path; a missing org is not.
    category = DATASET_TO_CATEGORY.get(dataset)
    if category is None:
        return [], []
    if snuba_params.organization_id is None:
        logger.warning("data_annotations.missing_organization", extra={"dataset": str(dataset)})
        return [], []
    organization_id = snuba_params.organization_id

    with sentry_sdk.start_span(op="data_annotations.get_dropped_data") as span:
        span.set_data("category", category.api_name())

        item_rows = _run_category_query(category, snuba_params, rollup, organization_id)
        accepted_by_bucket = _accepted_by_bucket(item_rows)
        dropped_by_key = _dropped_by_bucket_reason(item_rows)

        # Bytes are a logs-only dimension: query the paired byte category only
        # when the dataset has one. Spans/metrics never emit byte outcomes.
        byte_category = DATASET_TO_BYTE_CATEGORY.get(dataset)
        accepted_bytes_by_bucket: dict[float, int] = {}
        dropped_bytes_by_key: dict[tuple[float, str, str], int] = {}
        if byte_category is not None:
            byte_rows = _run_category_query(byte_category, snuba_params, rollup, organization_id)
            accepted_bytes_by_bucket = _accepted_by_bucket(byte_rows)
            dropped_bytes_by_key = _dropped_by_bucket_reason(byte_rows)

        annotations: list[Annotation] = []
        buckets_with_drops: set[float] = set()
        for (bucket_start_ms, outcome, reason_key), dropped in dropped_by_key.items():
            if dropped < threshold:
                continue
            annotation = Annotation(
                type="system",
                category=category.api_name(),
                reason=reason_key,
                start=bucket_start_ms,
                end=bucket_start_ms + rollup * 1000,
                droppedCount=dropped,
                label=_label_for(outcome, reason_key),
            )
            if byte_category is not None:
                annotation["droppedBytes"] = dropped_bytes_by_key.get(
                    (bucket_start_ms, outcome, reason_key), 0
                )
            annotations.append(annotation)
            buckets_with_drops.add(bucket_start_ms)

        accepted: list[BucketAccepted] = []
        for bucket_start_ms in sorted(buckets_with_drops):
            entry = BucketAccepted(
                start=bucket_start_ms,
                end=bucket_start_ms + rollup * 1000,
                acceptedCount=accepted_by_bucket.get(bucket_start_ms, 0),
            )
            if byte_category is not None:
                entry["acceptedBytes"] = accepted_bytes_by_bucket.get(bucket_start_ms, 0)
            accepted.append(entry)

        span.set_data("annotation_count", len(annotations))
        return annotations, accepted
