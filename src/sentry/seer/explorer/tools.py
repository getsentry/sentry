import logging
from typing import Any, Literal, cast

from sentry.api import client
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.event import EventSerializer, IssueEventSerializerResponse
from sentry.api.serializers.models.group import BaseGroupSerializerResponse, GroupSerializer
from sentry.api.utils import default_start_end_dates
from sentry.constants import ObjectStatus
from sentry.models.apikey import ApiKey
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.seer.autofix.autofix import get_all_tags_overview
from sentry.seer.sentry_data_models import EAPTrace
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.trace import query_trace_data

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

    # Always normalize to the nested {"metric": {"data": [...]}} format for consistency
    metric_is_single = len(y_axes) == 1
    metric_name = y_axes[0] if metric_is_single else None
    if metric_name and metric_is_single:
        # Handle grouped data with single metric: wrap each group's data in the metric name
        if group_by:
            return {
                group_value: (
                    {metric_name: group_data}
                    if isinstance(group_data, dict) and "data" in group_data
                    else group_data
                )
                for group_value, group_data in data.items()
            }

        # Handle non-grouped data with single metric: wrap data in the metric name
        if isinstance(data, dict) and "data" in data:
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


def get_trace_waterfall(trace_id: str, organization_id: int) -> EAPTrace | None:
    """
    Get the full span waterfall and connected errors for a trace.

    Args:
        trace_id: The ID of the trace to fetch. Can be shortened to the first 8 or 16 characters.
        organization_id: The ID of the trace's organization

    Returns:
        The spans and errors in the trace, along with the full 32-character trace ID.
    """

    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        logger.warning(
            "get_trace_waterfall: Organization does not exist",
            extra={"organization_id": organization_id, "trace_id": trace_id},
        )
        return None

    projects = list(Project.objects.filter(organization=organization, status=ObjectStatus.ACTIVE))
    start, end = default_start_end_dates()  # Last 90 days.
    snuba_params = SnubaParams(
        start=start,
        end=end,
        projects=projects,
        organization=organization,
    )

    # Get full trace id if a short id is provided. Queries EAP for a single span.
    if len(trace_id) < 32:
        subquery_result = Spans.run_table_query(
            params=snuba_params,
            query_string=f"trace:{trace_id}",
            selected_columns=["trace", "precise.start_ts"],
            orderby=["-precise.start_ts"],  # Get most recent trace if there's multiple.
            offset=0,
            limit=1,
            referrer=Referrer.SEER_RPC,
            config=SearchResolverConfig(),
            sampling_mode="BEST_EFFORT",  # Prioritize performance to avoid timeouts - we only need 1 span.
        )
        full_trace_id = (
            subquery_result["data"][0].get("trace") if subquery_result.get("data") else None
        )
    else:
        full_trace_id = trace_id

    if not isinstance(full_trace_id, str):
        logger.warning(
            "get_trace_waterfall: Trace not found from short id",
            extra={
                "organization_id": organization_id,
                "trace_id": trace_id,
            },
        )
        return None

    # Get full trace data.
    events = query_trace_data(snuba_params, full_trace_id, referrer=Referrer.SEER_RPC)

    return EAPTrace(
        trace_id=full_trace_id,
        org_id=organization_id,
        trace=events,
    )


def rpc_get_trace_waterfall(trace_id: str, organization_id: int) -> dict[str, Any]:
    trace = get_trace_waterfall(trace_id, organization_id)
    return trace.dict() if trace else {}


def get_issue_details(
    *,
    issue_id: int | str,
    organization_id: int,
    selected_event_type: Literal["oldest", "latest", "recommended"],
) -> dict[str, int | str | dict] | None:
    """
    Args:
        issue_id: The issue/group ID (integer) or short ID (string) to look up.
        organization_id: The ID of the issue's organization.
        selected_event_type: Which event to return - "oldest", "latest", or "recommended".

    Returns:
        A dict containing:
            `issue`: Serialized issue with exactly one event in `issue.events`, selected
              according to `selected_event_type`.
            `event_trace_id`: The trace ID of the selected event.
            `project_id`: The project ID of the issue.
            `tags_overview`: A summary of all tags in the issue.
        Returns None in case of errors.
    """
    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        logger.warning(
            "Organization does not exist",
            extra={"organization_id": organization_id, "issue_id": issue_id},
        )
        return None

    try:
        if isinstance(issue_id, int):
            org_project_ids = Project.objects.filter(
                organization=organization, status=ObjectStatus.ACTIVE
            ).values_list("id", flat=True)

            group = Group.objects.get(project_id__in=org_project_ids, id=issue_id)
        else:
            group = Group.objects.by_qualified_short_id(organization_id, issue_id)

    except Group.DoesNotExist:
        logger.warning(
            "Issue does not exist for organization",
            extra={"organization_id": organization_id, "issue_id": issue_id},
        )
        return None
    group = cast(Group, group)

    serialized_group: BaseGroupSerializerResponse = serialize(
        group, user=None, serializer=GroupSerializer()
    )

    if selected_event_type == "oldest":
        event = group.get_oldest_event()
    elif selected_event_type == "latest":
        event = group.get_latest_event()
    else:
        event = group.get_recommended_event()

    if not event:
        logger.warning(
            "Could not find an event for the issue",
            extra={
                "organization_id": organization_id,
                "issue_id": issue_id,
                "selected_event_type": selected_event_type,
            },
        )
        return None

    serialized_event: IssueEventSerializerResponse | None = serialize(
        event, user=None, serializer=EventSerializer()
    )
    serialized_group["events"] = [serialized_event]

    try:
        tags_overview = get_all_tags_overview(group)
    except Exception:
        logger.exception(
            "Failed to get tags overview for issue",
            extra={"organization_id": organization_id, "issue_id": issue_id},
        )
        tags_overview = None

    return {
        "event_trace_id": event.trace_id,
        "project_id": group.project_id,
        "issue": serialized_group,
        "tags_overview": tags_overview,
    }
