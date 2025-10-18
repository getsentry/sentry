import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from sentry import eventstore
from sentry.api import client
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.event import EventSerializer, IssueEventSerializerResponse
from sentry.api.serializers.models.group import GroupSerializer
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
from sentry.services.eventstore.models import Event, GroupEvent
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

    # Get full trace id if a short id is provided. Queries EAP for a single span.
    # Use sliding 14-day windows starting from most recent, up to 90 days in the past, to avoid timeouts.
    if len(trace_id) < 32:
        full_trace_id = None
        now = datetime.now(timezone.utc)
        window_days = 14
        max_days = 90

        # Slide back in time in 14-day windows
        for days_back in range(0, max_days, window_days):
            window_end = now - timedelta(days=days_back)
            window_start = now - timedelta(days=min(days_back + window_days, max_days))

            snuba_params = SnubaParams(
                start=window_start,
                end=window_end,
                projects=projects,
                organization=organization,
                debug=True,
            )

            subquery_result = Spans.run_table_query(
                params=snuba_params,
                query_string=f"trace:{trace_id}",
                selected_columns=["trace"],
                orderby=[],
                offset=0,
                limit=1,
                referrer=Referrer.SEER_RPC,
                config=SearchResolverConfig(),
                sampling_mode=None,
            )

            data = subquery_result.get("data")
            if not data:
                # Temporary debug log
                logger.warning(
                    "get_trace_waterfall: No data returned from short id query",
                    extra={
                        "organization_id": organization_id,
                        "trace_id": trace_id,
                        "subquery_result": subquery_result,
                        "start": window_start.isoformat(),
                        "end": window_end.isoformat(),
                    },
                )

            full_trace_id = data[0].get("trace") if data else None
            if full_trace_id:
                break
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
    start, end = default_start_end_dates()
    snuba_params = SnubaParams(
        start=start,
        end=end,
        projects=projects,
        organization=organization,
    )
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
    selected_event: str,
) -> dict[str, int | str | dict | None] | None:
    """
    Args:
        issue_id: The issue/group ID (integer) or short ID (string) to look up.
        organization_id: The ID of the issue's organization.
        selected_event: The event to return - "oldest", "latest", "recommended", or the event's UUID.

    Returns:
        A dict containing:
            `issue`: Serialized issue with exactly one event in `issue.events`, selected
              according to `selected_event`.
            `event_id`: The event ID of the selected event.
            `event_trace_id`: The trace ID of the selected event.
            `tags_overview`: A summary of all tags in the issue.
            `project_id`: The project ID of the issue.
        Returns None when the event is not found or an error occurred.
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

    serialized_group: dict[str, Any] = serialize(group, user=None, serializer=GroupSerializer())

    event: Event | GroupEvent | None
    if selected_event == "oldest":
        event = group.get_oldest_event()
    elif selected_event == "latest":
        event = group.get_latest_event()
    elif selected_event == "recommended":
        event = group.get_recommended_event()
    else:
        event = eventstore.backend.get_event_by_id(
            project_id=group.project_id,
            event_id=selected_event,
            group_id=group.id,
            tenant_ids={"organization_id": organization_id},
        )

    if not event:
        logger.warning(
            "Could not find the selected event for the issue",
            extra={
                "organization_id": organization_id,
                "issue_id": issue_id,
                "selected_event": selected_event,
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
        "event_id": event.event_id,
        "event_trace_id": event.trace_id,
        "project_id": group.project_id,
        "issue": serialized_group,
        "tags_overview": tags_overview,
    }
