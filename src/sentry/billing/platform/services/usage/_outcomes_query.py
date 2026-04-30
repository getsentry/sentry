from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Sequence
from datetime import datetime, timedelta, timezone

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

from sentry.billing.platform.services.category_mapping import proto_to_sentry_category
from sentry.snuba.referrer import Referrer
from sentry.utils import metrics
from sentry.utils.outcomes import Outcome
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

_REFERRER = Referrer.BILLING_USAGE_SERVICE_CLICKHOUSE.value
_APP_ID = "billing"
_DATASET = "outcomes"
_DAILY_GRANULARITY = 86400
_QUERY_LIMIT = 10000

# Outcomes stored in PG BillingMetricUsage (getsentry outcomes consumer
# filters to these three at ingest). The CH outcomes table also has
# INVALID, ABUSE, CLIENT_DISCARD, and CARDINALITY_LIMITED.
_BILLABLE_OUTCOMES = [Outcome.ACCEPTED, Outcome.FILTERED, Outcome.RATE_LIMITED]


def query_outcomes_usage(request: GetUsageRequest) -> GetUsageResponse:
    org_id = request.organization_id
    start = _timestamp_to_datetime(request.start)
    # The proto contract defines `end` as inclusive (midnight of the last
    # included day). Snuba queries use a half-open interval [start, end),
    # so we add one day to convert inclusive→exclusive. Without this, all
    # hourly rows on the last day would be excluded.
    end = _timestamp_to_datetime(request.end) + timedelta(days=1)
    # Proto categories use different int values from Relay/ClickHouse
    # (e.g., proto ATTACHMENT=3 vs Relay ATTACHMENT=4). Convert before querying.
    categories = [proto_to_sentry_category(c) for c in request.categories]

    snuba_request = _build_query(org_id, start, end, categories, total_outcomes=_BILLABLE_OUTCOMES)
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
    categories: Sequence[int],
    *,
    total_outcomes: Sequence[int] | None = None,
) -> Request:
    # Half-open interval [start, end) — standard sentry.snuba.outcomes convention.
    # `end` has already been shifted +1 day in query_outcomes_usage() to convert
    # the proto's inclusive end into the exclusive boundary Snuba expects.
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
            Column("category"),
            Column("time"),
            _total_function(total_outcomes),
            Function(
                "sumIf",
                [Column("quantity"), Function("equals", [Column("outcome"), Outcome.ACCEPTED])],
                "accepted",
            ),
            Function(
                "sumIf",
                [
                    Column("quantity"),
                    Function("equals", [Column("outcome"), Outcome.RATE_LIMITED]),
                ],
                "dropped",
            ),
            Function(
                "sumIf",
                [Column("quantity"), Function("equals", [Column("outcome"), Outcome.FILTERED])],
                "filtered",
            ),
            Function("sumIf", [Column("quantity"), _over_quota_condition()], "over_quota"),
            Function(
                "sumIf",
                [
                    Column("quantity"),
                    Function(
                        "and",
                        [
                            Function("equals", [Column("outcome"), Outcome.RATE_LIMITED]),
                            Function("equals", [Column("reason"), "smart_rate_limit"]),
                        ],
                    ),
                ],
                "spike_protection",
            ),
            Function(
                "sumIf",
                [
                    Column("quantity"),
                    Function(
                        "and",
                        [
                            Function("equals", [Column("outcome"), Outcome.FILTERED]),
                            Function("startsWith", [Column("reason"), "Sampled:"]),
                        ],
                    ),
                ],
                "dynamic_sampling",
            ),
        ],
        groupby=[Column("category"), Column("time")],
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
    # Two-level accumulator: days_map[day_str][category_id] -> usage fields.
    # Each row already contains all 7 sumIf-aggregated fields from ClickHouse.
    #
    # NOTE: CategoryUsage.category carries Relay/Sentry int values (not proto
    # DataCategory ints).  The proto field is typed as DataCategory but every
    # existing consumer (getsentry postgres backend, shadow comparison,
    # UsagePricerService, customer_usage, projection, etc.) interprets it as a
    # Relay int.  Converting to proto ints here would break all consumers and
    # the shadow comparison.  See the TODO in getsentry's
    # usage_pricer/service.py for the planned migration.
    days_map: defaultdict[str, dict[int, dict[str, int]]] = defaultdict(dict)

    for row in rows:
        day = row["time"]
        category = int(row["category"])
        days_map[day][category] = {
            "total": int(row["total"]),
            "accepted": int(row["accepted"]),
            "dropped": int(row["dropped"]),
            "filtered": int(row["filtered"]),
            "over_quota": int(row["over_quota"]),
            "spike_protection": int(row["spike_protection"]),
            "dynamic_sampling": int(row["dynamic_sampling"]),
        }

    days = []
    for day_str in sorted(days_map):
        date = _parse_day(day_str)
        usage = [
            CategoryUsage(category=cat, data=UsageData(**fields))  # type: ignore[arg-type]
            for cat, fields in sorted(days_map[day_str].items())
        ]
        days.append(DailyUsage(date=date, usage=usage))

    return GetUsageResponse(days=days, seats=[])


def _total_function(outcomes: Sequence[int] | None) -> Function:
    """Build the ``total`` aggregate.

    When *outcomes* is provided, only those outcome types are counted
    (billing callers pass ``_BILLABLE_OUTCOMES``).  When ``None``, every
    outcome is counted (useful for general-purpose usage queries).
    """
    if outcomes is None:
        return Function("sum", [Column("quantity")], "total")
    return Function(
        "sumIf",
        [
            Column("quantity"),
            Function(
                "in",
                [
                    Column("outcome"),
                    Function("tuple", list(outcomes)),
                ],
            ),
        ],
        "total",
    )


def _over_quota_condition() -> Function:
    """ClickHouse condition for over-quota rate limiting.

    Matches: outcome=RATE_LIMITED AND (reason ends with "_usage_exceeded"
    OR reason="usage_exceeded" OR reason="grace_period").
    """
    return Function(
        "and",
        [
            Function("equals", [Column("outcome"), Outcome.RATE_LIMITED]),
            Function(
                "or",
                [
                    Function("endsWith", [Column("reason"), "_usage_exceeded"]),
                    Function(
                        "or",
                        [
                            Function("equals", [Column("reason"), "usage_exceeded"]),
                            Function("equals", [Column("reason"), "grace_period"]),
                        ],
                    ),
                ],
            ),
        ],
    )


def _timestamp_to_datetime(ts: Timestamp) -> datetime:
    return ts.ToDatetime(tzinfo=timezone.utc)


def _parse_day(value: str) -> Date:
    dt = datetime.fromisoformat(value)
    return Date(year=dt.year, month=dt.month, day=dt.day)
