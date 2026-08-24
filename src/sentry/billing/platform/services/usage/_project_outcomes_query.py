from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Sequence
from datetime import datetime

from sentry_protos.billing.v1.services.usage.v1.endpoint_usage_by_project_pb2 import (
    GetUsageByProjectRequest,
    GetUsageByProjectResponse,
    ProjectUsage,
)
from sentry_protos.billing.v1.services.usage.v1.endpoint_usage_pb2 import CategoryUsage, DailyUsage
from snuba_sdk import Request

from sentry.billing.platform.services.category_mapping import proto_to_sentry_category
from sentry.billing.platform.services.usage._outcomes_query import (
    _BILLABLE_OUTCOMES,
    _QUERY_LIMIT,
    _build_query,
    _category_usage_from_row,
    _inclusive_end_to_exclusive,
    _latest_usage_timestamp,
    _parse_day,
    _timestamp_to_datetime,
)
from sentry.snuba.referrer import Referrer
from sentry.utils import metrics
from sentry.utils.snuba import raw_snql_query

logger = logging.getLogger(__name__)

_REFERRER = Referrer.BILLING_USAGE_SERVICE_CLICKHOUSE.value


class ProjectUsageQueryTruncatedError(RuntimeError):
    """Raised when ClickHouse may have omitted project usage rows."""


def query_project_outcomes_usage(request: GetUsageByProjectRequest) -> GetUsageByProjectResponse:
    start = _timestamp_to_datetime(request.start)
    end = _inclusive_end_to_exclusive(request.end)

    categories = [proto_to_sentry_category(category) for category in request.categories]
    snuba_request = _build_project_query(
        request.organization_id,
        start,
        end,
        categories,
    )
    with metrics.timer("billing.project_usage_query.duration"):
        result = raw_snql_query(snuba_request, referrer=_REFERRER)
    rows = result["data"]
    metrics.distribution("billing.project_usage_query.rows", len(rows))
    if len(rows) >= _QUERY_LIMIT:
        logger.error(
            "billing.project_usage_query.truncated",
            extra={
                "org_id": request.organization_id,
                "row_count": len(rows),
            },
        )
        metrics.incr("billing.project_usage_query.truncated", sample_rate=1.0)
        raise ProjectUsageQueryTruncatedError(
            f"project usage query for organization {request.organization_id} reached "
            f"the {_QUERY_LIMIT:,}-row limit"
        )

    return _build_project_response(rows, _latest_usage_timestamp(rows))


def _build_project_query(
    org_id: int,
    start: datetime,
    end: datetime,
    categories: Sequence[int],
) -> Request:
    return _build_query(
        org_id,
        start,
        end,
        categories,
        total_outcomes=_BILLABLE_OUTCOMES,
        additional_groupby=["project_id"],
    )


def _build_project_response(
    rows: list[dict], last_usage_ts: datetime | None
) -> GetUsageByProjectResponse:
    projects: defaultdict[int, defaultdict[str, dict[int, CategoryUsage]]] = defaultdict(
        lambda: defaultdict(dict)
    )
    for row in rows:
        category_usage = _category_usage_from_row(row)
        if category_usage is None:
            continue
        projects[int(row["project_id"])][row["time"]][category_usage.category] = category_usage

    project_usages = []
    for project_id in sorted(projects):
        days = []
        for day_str in sorted(projects[project_id]):
            usage = [
                category_usage
                for _, category_usage in sorted(projects[project_id][day_str].items())
            ]
            days.append(DailyUsage(date=_parse_day(day_str), usage=usage))
        project_usages.append(ProjectUsage(project_id=project_id, days=days, seat_days=[]))

    response = GetUsageByProjectResponse(projects=project_usages)
    if last_usage_ts is not None:
        response.last_usage_ts.FromDatetime(last_usage_ts)
    return response
