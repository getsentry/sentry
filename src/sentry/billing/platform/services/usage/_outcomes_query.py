from __future__ import annotations

import datetime

from sentry_protos.billing.v1.date_pb2 import Date
from sentry_protos.billing.v1.services.usage.v1.endpoint_usage_pb2 import (
    CategoryUsage,
    DailyUsage,
    GetUsageRequest,
    GetUsageResponse,
)
from sentry_protos.billing.v1.usage_data_pb2 import UsageData
from snuba_sdk import (
    Column,
    Condition,
    Entity,
    Function,
    Granularity,
    Limit,
    Op,
    OrderBy,
    Query,
    Request,
)
from snuba_sdk.orderby import Direction

from sentry.utils.outcomes import Outcome
from sentry.utils.snuba import raw_snql_query

OVER_QUOTA_REASONS = frozenset(
    {
        "usage_exceeded",
        "error_usage_exceeded",
        "transaction_usage_exceeded",
        "attachment_usage_exceeded",
        "replay_usage_exceeded",
        "span_usage_exceeded",
        "profile_duration_usage_exceeded",
        "profile_duration_ui_usage_exceeded",
        "log_byte_usage_exceeded",
        "size_analysis_usage_exceeded",
        "installable_build_usage_exceeded",
        "custom_usage_exceeded",
        "grace_period",
    }
)

_REFERRER = "billing.usage_service.clickhouse"
_APP_ID = "billing"
_DATASET = "outcomes"
_DAILY_GRANULARITY = 86400
_QUERY_LIMIT = 10000


def query_outcomes_usage(request: GetUsageRequest) -> GetUsageResponse:
    """Query ClickHouse outcomes and return usage data as a proto response."""
    org_id = request.organization_id
    start = _timestamp_to_datetime(request.start)
    end = _timestamp_to_datetime(request.end)
    categories = list(request.categories)

    snuba_request = _build_query(org_id, start, end, categories)
    result = raw_snql_query(snuba_request, referrer=_REFERRER)
    return _build_response(result["data"])


def _build_query(
    org_id: int,
    start: datetime.datetime,
    end: datetime.datetime,
    categories: list[int],
) -> Request:
    """Build a SnQL query for daily outcomes aggregation."""
    where = [
        Condition(Column("org_id"), Op.EQ, org_id),
        Condition(Column("timestamp"), Op.GTE, start),
        Condition(Column("timestamp"), Op.LT, end),
    ]
    if categories:
        where.append(Condition(Column("category"), Op.IN, categories))

    query = Query(
        match=Entity("outcomes"),
        select=[
            Function("sum", [Column("quantity")], "qty"),
            Column("outcome"),
            Column("reason"),
            Column("category"),
            Column("time"),
        ],
        groupby=[
            Column("outcome"),
            Column("reason"),
            Column("category"),
            Column("time"),
        ],
        where=where,
        orderby=[OrderBy(Column("time"), Direction.ASC)],
        granularity=Granularity(_DAILY_GRANULARITY),
        limit=Limit(_QUERY_LIMIT),
    )
    return Request(
        dataset=_DATASET,
        app_id=_APP_ID,
        query=query,
        tenant_ids={"organization_id": org_id},
    )


def _build_response(rows: list[dict]) -> GetUsageResponse:
    """Process raw ClickHouse rows into a GetUsageResponse proto."""
    # Accumulate: day_str -> category -> usage fields
    days_map: dict[str, dict[int, dict[str, int]]] = {}

    for row in rows:
        day = row["time"]
        category = int(row["category"])
        outcome = int(row["outcome"])
        reason = row.get("reason") or ""
        qty = int(row["qty"])

        if day not in days_map:
            days_map[day] = {}
        if category not in days_map[day]:
            days_map[day][category] = _empty_fields()

        _map_outcome_to_fields(days_map[day][category], outcome, reason, qty)

    days = []
    for day_str in sorted(days_map):
        date = _parse_day(day_str)
        usage = [
            CategoryUsage(category=cat, data=UsageData(**fields))
            for cat, fields in sorted(days_map[day_str].items())
        ]
        days.append(DailyUsage(date=date, usage=usage))

    return GetUsageResponse(days=days, seats=[])


def _map_outcome_to_fields(fields: dict[str, int], outcome: int, reason: str, qty: int) -> None:
    """Map an outcome+reason pair to UsageData fields (mutates fields in place)."""
    fields["total"] += qty

    if outcome == Outcome.ACCEPTED:
        fields["accepted"] += qty
    elif outcome == Outcome.RATE_LIMITED:
        fields["dropped"] += qty
        if reason in OVER_QUOTA_REASONS:
            fields["over_quota"] += qty
        if reason == "smart_rate_limit":
            fields["spike_protection"] += qty
    elif outcome == Outcome.FILTERED:
        fields["filtered"] += qty
        if reason.startswith("Sampled:"):
            fields["dynamic_sampling"] += qty


def _empty_fields() -> dict[str, int]:
    return {
        "total": 0,
        "accepted": 0,
        "dropped": 0,
        "filtered": 0,
        "over_quota": 0,
        "spike_protection": 0,
        "dynamic_sampling": 0,
    }


def _timestamp_to_datetime(ts) -> datetime.datetime:
    """Convert a proto Timestamp to a timezone-aware Python datetime."""
    return datetime.datetime.fromtimestamp(ts.seconds, tz=datetime.timezone.utc)


def _parse_day(value: str) -> Date:
    """Parse a ClickHouse time string into a Date proto."""
    dt = datetime.datetime.fromisoformat(value)
    return Date(year=dt.year, month=dt.month, day=dt.day)
