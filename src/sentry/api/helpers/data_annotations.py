from __future__ import annotations

from sentry.api.endpoints.timeseries import Annotation
from sentry.constants import DataCategory
from sentry.search.events.types import SnubaParams
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.outcomes import QueryDefinition, run_outcomes_query_timeseries
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.trace_metrics import TraceMetrics
from sentry.utils.outcomes import Outcome
from sentry.utils.snuba import parse_snuba_datetime

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


def get_dropped_data_annotations(
    dataset: object,
    snuba_params: SnubaParams,
    rollup: int,
    *,
    threshold: int = DEFAULT_DROP_THRESHOLD,
) -> list[Annotation]:
    """Build dropped-data annotations for a timeseries query.

    Buckets align to the chart because ``rollup`` is the interval the endpoint
    already resolved for the series.
    """
    category = DATASET_TO_CATEGORY.get(dataset)
    if category is None or snuba_params.organization_id is None:
        return []

    query = QueryDefinition(
        fields=["sum(quantity)"],
        start=snuba_params.start_date.isoformat(),
        end=snuba_params.end_date.isoformat(),
        organization_id=snuba_params.organization_id,
        project_ids=list(snuba_params.project_ids),
        interval=f"{rollup}s",
        outcome=[o.api_name() for o in DROPPED_OUTCOMES],
        group_by=["outcome", "reason"],
        category=[category.api_name()],
    )

    rows = run_outcomes_query_timeseries(
        query, tenant_ids={"organization_id": snuba_params.organization_id}
    )

    annotations: list[Annotation] = []
    for row in rows:
        dropped = int(row.get("quantity", 0) or 0)
        if dropped < threshold:
            continue
        raw_time = row.get("time")
        if not raw_time:
            continue
        start_ms = parse_snuba_datetime(raw_time).timestamp() * 1000
        outcome = str(row.get("outcome", ""))
        reason = row.get("reason")
        annotations.append(
            Annotation(
                type="system",
                category=category.api_name(),
                reason=str(reason) if reason is not None else outcome,
                start=start_ms,
                end=start_ms + rollup * 1000,
                droppedCount=dropped,
                label=_label_for(outcome, reason if isinstance(reason, str) else None),
            )
        )
    return annotations
