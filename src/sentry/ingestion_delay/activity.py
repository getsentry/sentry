from __future__ import annotations

import logging
from datetime import datetime

from django.core.cache import cache
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry import options
from sentry.constants import DataCategory
from sentry.snuba.outcomes import QueryDefinition, run_outcomes_query_totals
from sentry.utils import metrics
from sentry.utils.hashlib import md5_text
from sentry.utils.outcomes import Outcome

logger = logging.getLogger(__name__)

ITEM_TYPE_TO_CATEGORY: dict[TraceItemType.ValueType, DataCategory] = {
    TraceItemType.TRACE_ITEM_TYPE_SPAN: DataCategory.SPAN,
    TraceItemType.TRACE_ITEM_TYPE_LOG: DataCategory.LOG_ITEM,
    TraceItemType.TRACE_ITEM_TYPE_METRIC: DataCategory.TRACE_METRIC,
}


def has_accepted_outcomes(
    organization_id: int,
    project_ids: list[int],
    item_type: TraceItemType.ValueType,
    start: datetime,
    end: datetime,
) -> bool | None:
    """
    Whether the organization had data accepted in [start, end].
    """
    category = ITEM_TYPE_TO_CATEGORY.get(item_type)
    if category is None:
        return None

    query = QueryDefinition(
        fields=["sum(quantity)"],
        start=start.isoformat(),
        end=end.isoformat(),
        organization_id=organization_id,
        project_ids=project_ids,
        interval="1m",
        outcome=[Outcome.ACCEPTED.api_name()],
        category=[category.api_name()],
    )

    try:
        rows = run_outcomes_query_totals(query, tenant_ids={"organization_id": organization_id})
    except Exception:
        logger.exception(
            "ingestion_delay.outcomes_query_failed",
            extra={"organization_id": organization_id, "item_type": item_type},
        )
        return None

    return any(int(row.get("quantity", 0) or 0) > 0 for row in rows)


def _outcomes_cache_key(
    organization_id: int,
    project_ids: list[int],
    item_type: TraceItemType.ValueType,
) -> str:
    projects = md5_text(",".join(str(id) for id in sorted(project_ids))).hexdigest()
    return f"ingestion-delay:outcomes:{organization_id}:{item_type}:{projects}"


def get_accepted_outcomes(
    organization_id: int,
    project_ids: list[int],
    item_type: TraceItemType.ValueType,
    start: datetime,
    end: datetime,
) -> bool | None:
    """
    Wrapper around `has_accepted_outcomes` cached by organization, projects and item type.
    """
    ttl = options.get("ingestion-delay.measurement-cache-seconds")
    if ttl <= 0:
        return has_accepted_outcomes(organization_id, project_ids, item_type, start, end)

    key = _outcomes_cache_key(organization_id, project_ids, item_type)
    cached = cache.get(key)
    if cached is not None:
        metrics.incr("ingestion_delay.outcomes_cache", tags={"result": "hit"})
        return cached

    metrics.incr("ingestion_delay.outcomes_cache", tags={"result": "miss"})
    accepted = has_accepted_outcomes(organization_id, project_ids, item_type, start, end)

    if accepted is not None:
        cache.set(key, accepted, ttl)
    return accepted
