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
from sentry.snuba.referrer import Referrer

logger = logging.getLogger(__name__)

API_KEY_SCOPES = ["org:read", "project:read", "event:read"]

# Upper bound on how many substrings a caller may pass in a single request.
MAX_SUBSTRINGS = 8

# Default number of returned metrics when the caller doesn't specify one.
DEFAULT_LIMIT = 20


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
            DEFAULT_LIMIT; the metrics endpoint enforces its own upper bound.
        include_context: When True, request per-metric context from the endpoint
            via expand=context and attach it to each candidate. Context is
            `{"brief": str, "details": list[str]}` — the same shape the attributes
            tool (get_attribute_names) returns — or None when the metric has none.
        context_only: Forwarded to the metrics endpoint as `contextOnly` to
            restrict results to metrics that have authored context.

    Returns:
        {
            "candidates": [
                {"name", "type", "unit", "count", "context"}, ...
            ],  # context: {"brief": str, "details": list[str]} | None
            "has_more": bool,
            "error": str,  # present only on handler-side failure (e.g.
                           # "organization_not_found", "metrics_query_failed").
                           # Callers should treat a non-empty error as a tool
                           # failure rather than an empty result set.
        }
    """
    substrings = [s for s in (name_substrings or []) if s][:MAX_SUBSTRINGS]
    query = _build_or_query(substrings)
    # Substrings were provided but all unusable (e.g. contained quotes) → treat as
    # no matches. This differs from *no* substrings, which returns all metrics.
    if substrings and not query:
        return MetricMetadataSuccessResponse(candidates=[], has_more=False)

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
        "contextOnly": context_only,
        "referrer": Referrer.SEER_EXPLORER_TOOLS,
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
        # A 404 means the org lacks the (feature-gated) trace-items metrics
        # endpoint — there are no metrics to describe, so return an empty result
        # rather than a failure (the events-backed version degraded gracefully here).
        if getattr(e, "status_code", None) == 404:
            return MetricMetadataSuccessResponse(candidates=[], has_more=False)
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

    # We over-fetch by 1 (per_page = limit + 1) specifically to detect whether
    # Sentry has more matches than the caller asked for. That signal must be
    # derived from what the API returned, not from what survived our local
    # parse filter — if we filter a malformed row we would otherwise under-
    # report `has_more` and hide the existence of further matches.
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
