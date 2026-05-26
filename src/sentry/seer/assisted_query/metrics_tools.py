import logging
from typing import Any, TypedDict

from sentry.api import client
from sentry.constants import ALL_ACCESS_PROJECT_ID
from sentry.models.apikey import ApiKey
from sentry.models.organization import Organization
from sentry.snuba.referrer import Referrer

logger = logging.getLogger(__name__)

API_KEY_SCOPES = ["org:read", "project:read", "event:read"]

# Upper bound on how many substrings a caller may pass in a single request.
MAX_SUBSTRINGS = 8


class MetricMetadataRow(TypedDict):
    name: str
    type: str
    unit: str
    count: int


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
    name_substrings: list[str],
    stats_period: str = "7d",
    limit: int = 20,
) -> dict[str, Any]:
    """
    Return distinct (metric.name, metric.type, metric.unit) tuples matching any of
    the given name substrings, ordered by event count descending.

    Intended for Seer's metrics assisted-query agent to short-circuit the
    get_field_values(metric.name) + get_field_values(metric.type) discovery
    loop with a single call that returns all three fields plus an event count
    for tie-breaking.

    Args:
        org_id: Organization ID.
        project_ids: Projects to query. Empty list means all accessible projects.
        name_substrings: Up to MAX_SUBSTRINGS keyword substrings. A metric matches
            if metric.name ILIKE %sub% for any one substring.
        stats_period: Time window, e.g. "7d". Defaults to 7d.
        limit: Maximum number of distinct tuples to return. Caller may over-fetch
            to rerank on their side.

    Returns:
        {
            "candidates": [{"name", "type", "unit", "count"}, ...],
            "has_more": bool,
            "error": str,  # present only on handler-side failure (e.g.
                           # "organization_not_found", "events_query_failed").
                           # Callers should treat a non-empty error as a tool
                           # failure rather than an empty result set.
        }
    """
    substrings = [s for s in (name_substrings or []) if s][:MAX_SUBSTRINGS]
    if not substrings:
        return {"candidates": [], "has_more": False}

    query = _build_or_query(substrings)
    if not query:
        return {"candidates": [], "has_more": False}

    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("get_metric_metadata: organization not found", extra={"org_id": org_id})
        return {"candidates": [], "has_more": False, "error": "organization_not_found"}

    # Over-fetch by 1 to detect has_more.
    per_page = max(1, limit) + 1

    params: dict[str, Any] = {
        "dataset": "tracemetrics",
        # Selecting metric.name/type/unit plus count(value) groups by the selected
        # non-aggregate fields, giving us distinct tuples with event counts.
        # tracemetrics requires count() to take an attribute argument — zero-arg
        # count() parse-fails at the events layer.
        "field": ["metric.name", "metric.type", "metric.unit", "count(value)"],
        "query": query,
        "sort": "-count(value)",
        "per_page": per_page,
        "statsPeriod": stats_period,
        "project": project_ids or [ALL_ACCESS_PROJECT_ID],
        "referrer": Referrer.SEER_EXPLORER_TOOLS,
    }

    try:
        resp = client.get(
            auth=ApiKey(organization_id=organization.id, scope_list=API_KEY_SCOPES),
            user=None,
            path=f"/organizations/{organization.slug}/events/",
            params=params,
        )
    except client.ApiError as e:
        # Surface status + body prefix in log extras so prod flakes are debuggable
        # without a new deploy. Keep the return `error` code stable for callers.
        logger.exception(
            "get_metric_metadata: events query failed",
            extra={
                "org_id": org_id,
                "project_ids": project_ids,
                "status_code": getattr(e, "status_code", None),
                "body_prefix": str(getattr(e, "body", None))[:500],
            },
        )
        return {"candidates": [], "has_more": False, "error": "events_query_failed"}

    raw_rows = (resp.data or {}).get("data") or []

    # We over-fetch by 1 (per_page = limit + 1) specifically to detect whether
    # Sentry has more matches than the caller asked for. That signal must be
    # derived from what the API returned, not from what survived our local
    # parse filter — if we filter a malformed row we would otherwise under-
    # report `has_more` and hide the existence of further matches.
    has_more = len(raw_rows) > limit

    candidates: list[MetricMetadataRow] = []
    for row in raw_rows:
        name = row.get("metric.name")
        mtype = row.get("metric.type")
        munit = row.get("metric.unit") or "none"
        if not name or not mtype:
            continue
        # count(value) may come back under the full function key or the bare name
        # depending on the dataset shape.
        count = row.get("count(value)")
        if count is None:
            count = row.get("count", 0)
        candidates.append(
            MetricMetadataRow(
                name=str(name),
                type=str(mtype),
                unit=str(munit),
                count=int(count or 0),
            )
        )

    return {"candidates": candidates[:limit], "has_more": has_more}
