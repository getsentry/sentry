from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timezone

from google.protobuf.timestamp_pb2 import Timestamp
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

from sentry.utils import metrics
from sentry.utils.outcomes import Outcome
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

_REFERRER = "billing.usage_service.clickhouse"
_APP_ID = "billing"
_DATASET = "outcomes"
_DAILY_GRANULARITY = 86400
_QUERY_LIMIT = 10000


def query_outcomes_usage(request: GetUsageRequest) -> GetUsageResponse:
    org_id = request.organization_id
    start = _timestamp_to_datetime(request.start)
    end = _timestamp_to_datetime(request.end)
    categories = list(request.categories)

    snuba_request = _build_query(org_id, start, end, categories)
    result = raw_snql_query(snuba_request, referrer=_REFERRER)
    rows = result["data"]

    if len(rows) >= _QUERY_LIMIT:
        logger.warning(
            "billing.usage_query.truncated",
            extra={"org_id": org_id, "row_count": len(rows)},
        )
        metrics.incr(
            "billing.usage_query.truncated",
            tags={"org_id": str(org_id)},
            sample_rate=1.0,
        )

    return _build_response(rows)


def _build_query(
    org_id: int,
    start: datetime,
    end: datetime,
    categories: list[int],
) -> Request:
    # Half-open interval [start, end) — matches sentry.snuba.outcomes convention.
    # Callers pass end as the exclusive boundary (start of the next period) so
    # adjacent periods never overlap and rows are never double-counted.
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
    # Two-level accumulator: days_map[day_str][category_id] -> usage counters.
    #   str  = day timestamp from Snuba (e.g. "2026-03-30T00:00:00+00:00")
    #   int  = outcome category ID (e.g. 1=errors, 2=transactions)
    #   dict = zeroed usage counters from _empty_fields()
    #          (total, accepted, dropped, filtered, over_quota, spike_protection, dynamic_sampling)
    days_map: defaultdict[str, defaultdict[int, dict[str, int]]] = defaultdict(
        lambda: defaultdict(_empty_fields)
    )

    for row in rows:
        day = row["time"]
        category = int(row["category"])
        outcome = int(row["outcome"])
        reason = row.get("reason") or ""
        qty = int(row["qty"])

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
    fields["total"] += qty

    if outcome == Outcome.ACCEPTED:
        fields["accepted"] += qty
    elif outcome == Outcome.RATE_LIMITED:
        fields["dropped"] += qty
        if _is_over_quota_reason(reason):
            fields["over_quota"] += qty
        if reason == "smart_rate_limit":
            fields["spike_protection"] += qty
    elif outcome == Outcome.FILTERED:
        fields["filtered"] += qty
        if reason.startswith("Sampled:"):
            fields["dynamic_sampling"] += qty


def _is_over_quota_reason(reason: str) -> bool:
    # Quota reasons follow the pattern "{category_api_name}_usage_exceeded"
    # (generated in getsentry/quotas.py). Suffix match is future-proof.
    return (
        reason == "usage_exceeded" or reason.endswith("_usage_exceeded") or reason == "grace_period"
    )


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


def _timestamp_to_datetime(ts: Timestamp) -> datetime:
    return ts.ToDatetime(tzinfo=timezone.utc)


def _parse_day(value: str) -> Date:
    dt = datetime.fromisoformat(value)
    return Date(year=dt.year, month=dt.month, day=dt.day)
