import logging
from typing import Any, Literal

from sentry.api import client
from sentry.models.apikey import ApiKey
from sentry.models.organization import Organization
from sentry.snuba.referrer import Referrer

logger = logging.getLogger(__name__)


def execute_trace_query_chart(
    *,
    org_id: int,
    query: str,
    stats_period: str,
    y_axes: list[str],
    group_by: list[str] | None = None,
) -> dict[str, Any] | None:
    """
    Execute a trace query to get chart/timeseries data by calling the events-stats endpoint.
    """
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    # Get all project IDs for the organization
    project_ids = list(organization.project_set.values_list("id", flat=True))
    if not project_ids:
        logger.warning("No projects found for organization", extra={"org_id": org_id})
        return None

    params: dict[str, Any] = {
        "query": query,
        "statsPeriod": stats_period,
        "yAxis": y_axes,
        "project": project_ids,
        "dataset": "spans",
        "referrer": Referrer.SEER_RPC,
        "transformAliasToInputFormat": "1",  # Required for RPC datasets
    }

    # Add group_by if provided (for top events)
    if group_by and len(group_by) > 0:
        params["topEvents"] = 5
        params["field"] = group_by
        params["excludeOther"] = "0"  # Include "Other" series

    resp = client.get(
        auth=ApiKey(organization_id=organization.id, scope_list=["org:read", "project:read"]),
        user=None,
        path=f"/organizations/{organization.slug}/events-stats/",
        params=params,
    )
    data = resp.data

    # Normalize response format: single-axis returns flat format, multi-axis returns nested
    # We always want the nested format {"metric": {"data": [...]}}
    if isinstance(data, dict) and "data" in data and len(y_axes) == 1:
        # Single axis response - wrap it
        metric_name = y_axes[0]
        return {metric_name: data}

    return data


def execute_trace_query_table(
    *,
    org_id: int,
    query: str,
    stats_period: str,
    sort: str,
    group_by: list[str] | None = None,
    y_axes: list[str] | None = None,
    per_page: int = 50,
    mode: Literal["spans", "aggregates"] = "spans",
) -> dict[str, Any] | None:
    """
    Execute a trace query to get table data by calling the events endpoint.
    """
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    # Get all project IDs for the organization
    project_ids = list(organization.project_set.values_list("id", flat=True))
    if not project_ids:
        logger.warning("No projects found for organization", extra={"org_id": org_id})
        return None

    # Determine fields based on mode
    if mode == "aggregates":
        # Aggregates mode: group_by fields + aggregate functions
        fields = []
        if group_by:
            fields.extend(group_by)
        if y_axes:
            fields.extend(y_axes)
    else:
        # Samples mode: default span fields
        fields = [
            "id",
            "span.op",
            "span.description",
            "span.duration",
            "transaction",
            "timestamp",
            "project",
            "project.name",
            "trace",
        ]

    params: dict[str, Any] = {
        "query": query,
        "statsPeriod": stats_period,
        "field": fields,
        "sort": sort if sort else ("-timestamp" if not group_by else None),
        "per_page": per_page,
        "project": project_ids,
        "dataset": "spans",
        "referrer": Referrer.SEER_RPC,
        "transformAliasToInputFormat": "1",  # Required for RPC datasets
    }

    # Remove None values
    params = {k: v for k, v in params.items() if v is not None}

    resp = client.get(
        auth=ApiKey(organization_id=organization.id, scope_list=["org:read", "project:read"]),
        user=None,
        path=f"/organizations/{organization.slug}/events/",
        params=params,
    )
    return resp.data
