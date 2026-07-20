import logging
from typing import Any

from sentry.api.client import ApiClient, ApiError
from sentry.constants import ALL_ACCESS_PROJECT_ID
from sentry.models.apikey import ApiKey
from sentry.models.organization import Organization
from sentry.seer.sentry_data_models import (
    MetricMetadataErrorResponse,
    MetricMetadataRow,
    MetricMetadataSuccessResponse,
)

logger = logging.getLogger(__name__)

API_KEY_SCOPES = ["org:read", "project:read", "event:read"]

# Upper bound on how many substrings a caller may pass in a single request.
MAX_SUBSTRINGS = 8

# Default and hard cap on the number of returned metrics.
DEFAULT_LIMIT = 20
MAX_LIMIT = 100


def _build_or_query(name_substrings: list[str]) -> str:
    """
    Build a Sentry search query that matches any of the substrings against metric.name.

    Uses wildcards for substring match. Substrings containing quotes are skipped
    to avoid query-parse errors — callers should pass identifier fragments.
    """
    clauses: list[str] = []
    for sub in name_substrings:
        if '"' in sub or "\\" in sub:
            continue
        clauses.append(f'metric.name:"*{sub}*"')
    if not clauses:
        return ""
    if len(clauses) == 1:
        return clauses[0]
    return "(" + " OR ".join(clauses) + ")"


def get_metric_metadata(
    *,
    org_id: int,
    project_ids: list[int],
    name_substrings: list[str] | None = None,
    stats_period: str = "7d",
    limit: int = DEFAULT_LIMIT,
    include_context: bool = False,
    context_only: bool = False,
) -> MetricMetadataSuccessResponse | MetricMetadataErrorResponse:
    """
    Return distinct (metric.name, metric.type, metric.unit) tuples ordered by
    event count descending. When ``name_substrings`` are given, only metrics
    whose name matches one of them are returned; otherwise all metrics are
    returned (highest count first).

    Backed by the trace-items metrics endpoint (which also serves authored
    context), so Seer can surface metric descriptions. Intended to short-circuit
    the get_field_values(metric.name) + get_field_values(metric.type) discovery
    loop with a single call that returns all three fields plus an event count for
    tie-breaking, and optionally the metric's context.

    Args:
        org_id: Organization ID.
        project_ids: Projects to query. Empty list means all accessible projects.
        name_substrings: Up to MAX_SUBSTRINGS keyword substrings. A metric matches
            if metric.name ILIKE %sub% for any one substring. Omit (or pass an
            empty list) to return all metrics.
        stats_period: Time window, e.g. "7d". Defaults to 7d.
        limit: Maximum number of distinct tuples to return. Defaults to
            DEFAULT_LIMIT and is clamped to MAX_LIMIT.
        include_context: When True, request per-metric context (brief, notes) from
            the endpoint via expand=context and attach it to each candidate.
        context_only: Forwarded to the metrics endpoint as `context_only`
            (endpoint behavior for this flag is wired up separately).

    Returns:
        {
            "candidates": [{"name", "type", "unit", "count", "context"}, ...],
            "has_more": bool,
            "error": str,  # present only on handler-side failure (e.g.
                           # "organization_not_found", "metrics_query_failed").
                           # Callers should treat a non-empty error as a tool
                           # failure rather than an empty result set.
        }
    """
    substrings = [s for s in (name_substrings or []) if s][:MAX_SUBSTRINGS]
    # No usable substrings → no name filter, i.e. return all metrics.
    query = _build_or_query(substrings)
    limit = max(1, min(limit, MAX_LIMIT))

    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("get_metric_metadata: organization not found", extra={"org_id": org_id})
        return MetricMetadataErrorResponse(
            candidates=[], has_more=False, error="organization_not_found"
        )

    params: dict[str, Any] = {
        "statsPeriod": stats_period,
        "project": project_ids or [ALL_ACCESS_PROJECT_ID],
        # Highest-count metrics first; over-fetch by 1 to detect has_more.
        "sort": "-count",
        "per_page": limit + 1,
        "context_only": context_only,
    }
    # Omit an empty query so the endpoint returns all metrics rather than
    # filtering on a blank name.
    if query:
        params["query"] = query
    if include_context:
        params["expand"] = "context"

    try:
        resp = ApiClient().get(
            auth=ApiKey(organization_id=organization.id, scope_list=API_KEY_SCOPES),
            user=None,
            path=f"/organizations/{organization.slug}/trace-items/metrics/",
            params=params,
        )
    except ApiError as e:
        # Surface status + body prefix in log extras so prod flakes are debuggable
        # without a new deploy. Keep the return `error` code stable for callers.
        logger.exception(
            "get_metric_metadata: metrics query failed",
            extra={
                "org_id": org_id,
                "project_ids": project_ids,
                "status_code": getattr(e, "status_code", None),
                "body_prefix": str(getattr(e, "body", None))[:500],
            },
        )
        return MetricMetadataErrorResponse(
            candidates=[], has_more=False, error="metrics_query_failed"
        )

    # The metrics endpoint returns a bare list of {name, type, unit, count, ...},
    # already ordered by count descending via the sort param above.
    raw_rows = resp.data or []

    # has_more must be derived from what the API returned, not from what survives
    # the local parse filter below — dropping a malformed row shouldn't hide that
    # Sentry has more matches than the caller asked for.
    has_more = len(raw_rows) > limit

    candidates: list[MetricMetadataRow] = []
    for row in raw_rows:
        name = row.get("name")
        mtype = row.get("type")
        if not name or not mtype:
            continue
        candidates.append(
            MetricMetadataRow(
                name=str(name),
                type=str(mtype),
                unit=str(row.get("unit") or "none"),
                count=int(row.get("count") or 0),
                context=row.get("context"),
            )
        )

    return MetricMetadataSuccessResponse(candidates=candidates[:limit], has_more=has_more)
