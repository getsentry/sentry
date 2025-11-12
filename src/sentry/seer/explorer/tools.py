import logging
import uuid
from datetime import UTC, datetime, timedelta, timezone
from typing import Any, Literal, cast

from sentry import eventstore, features
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
from sentry.models.repository import Repository
from sentry.replays.post_process import process_raw_response
from sentry.replays.query import query_replay_instance, query_replay_instance_with_short_id
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.seer.autofix.autofix import get_all_tags_overview
from sentry.seer.constants import SEER_SUPPORTED_SCM_PROVIDERS
from sentry.seer.sentry_data_models import EAPTrace
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.trace import query_trace_data
from sentry.utils.dates import parse_stats_period

logger = logging.getLogger(__name__)


def execute_trace_query_chart(
    *,
    org_id: int,
    query: str,
    stats_period: str,
    y_axes: list[str],
    group_by: list[str] | None = None,
    project_ids: list[int] | None = None,
) -> dict[str, Any] | None:
    """
    Execute a trace query to get chart/timeseries data by calling the events-stats endpoint.
    """
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    # Use provided project_ids or get all project IDs for the organization
    if project_ids is None:
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
    project_ids: list[int] | None = None,
) -> dict[str, Any] | None:
    """
    Execute a trace query to get table data by calling the events endpoint.
    """
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    # Use provided project_ids or get all project IDs for the organization
    if project_ids is None:
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


def get_repository_definition(*, organization_id: int, repo_full_name: str) -> dict | None:
    """
    Look up a repository by full name (owner/repo-name) that the org has access to.
    Returns full RepoDefinition if found and accessible via code mappings, None otherwise.

    Args:
        organization_id: The ID of the organization
        repo_full_name: Full repository name in format "owner/repo-name" (e.g., "getsentry/seer")

    Returns:
        dict with RepoDefinition fields if found, None otherwise
    """
    parts = repo_full_name.split("/")
    if len(parts) != 2:
        logger.warning(
            "seer.rpc.invalid_repo_name_format",
            extra={"repo_full_name": repo_full_name},
        )
        return None

    owner, name = parts

    repo = Repository.objects.filter(
        organization_id=organization_id,
        name=repo_full_name,
        status=ObjectStatus.ACTIVE,
        provider__in=SEER_SUPPORTED_SCM_PROVIDERS,
    ).first()

    if not repo:
        logger.info(
            "seer.rpc.repository_not_found",
            extra={"organization_id": organization_id, "repo_full_name": repo_full_name},
        )
        return None

    return {
        "organization_id": organization_id,
        "integration_id": str(repo.integration_id) if repo.integration_id else None,
        "provider": repo.provider,
        "owner": owner,
        "name": name,
        "external_id": repo.external_id,
    }


# Tuples of (total period, interval) (both in sentry stats period format).
EVENT_TIMESERIES_RESOLUTIONS = (
    ("6h", "15m"),  # 24 buckets
    ("24h", "1h"),  # 24 buckets
    ("3d", "3h"),  # 24 buckets
    ("7d", "6h"),  # 28 buckets
    ("14d", "12h"),  # 28 buckets
    ("30d", "24h"),  # 30 buckets
    ("90d", "3d"),  # 30 buckets
)


def _get_issue_event_timeseries(
    *,
    organization: Organization,
    project_id: int,
    issue_short_id: str,
    first_seen_delta: timedelta,
) -> tuple[dict[str, Any], str, str] | None:
    """
    Get event counts over time for an issue by calling the events-stats endpoint.
    """

    stats_period, interval = None, None
    for p, i in EVENT_TIMESERIES_RESOLUTIONS:
        delta = parse_stats_period(p)
        if delta and first_seen_delta <= delta:
            stats_period, interval = p, i
            break
    stats_period = stats_period or "90d"
    interval = interval or "3d"

    params: dict[str, Any] = {
        "dataset": "issuePlatform",
        "query": f"issue:{issue_short_id}",
        "yAxis": "count()",
        "partial": "1",
        "statsPeriod": stats_period,
        "interval": interval,
        "project": project_id,
        "referrer": Referrer.SEER_RPC,
    }

    resp = client.get(
        auth=ApiKey(organization_id=organization.id, scope_list=["org:read", "project:read"]),
        user=None,
        path=f"/organizations/{organization.slug}/events-stats/",
        params=params,
    )
    if resp.status_code != 200 or not (resp.data or {}).get("data"):
        logger.warning(
            "Failed to get event counts for issue",
            extra={
                "organization_slug": organization.slug,
                "project_id": project_id,
                "issue_id": issue_short_id,
            },
        )
        return None

    return {"count()": {"data": resp.data["data"]}}, stats_period, interval


def get_issue_details(
    *,
    issue_id: str,
    organization_id: int,
    selected_event: str,
) -> dict[str, Any] | None:
    """
    Args:
        issue_id: The issue/group ID (numeric) or short ID (string) to look up.
        organization_id: The ID of the issue's organization.
        selected_event: The event to return - "oldest", "latest", "recommended", or the event's UUID.

    Returns:
        A dict containing:
            `issue`: Serialized issue details.
            `tags_overview`: A summary of all tags in the issue.
            `event`: Serialized event details, selected according to `selected_event`.
            `event_id`: The event ID of the selected event.
            `event_trace_id`: The trace ID of the selected event.
            `project_id`: The ID of the issue's project.
            `project_slug`: The slug of the issue's project.
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

    org_project_ids = Project.objects.filter(
        organization=organization, status=ObjectStatus.ACTIVE
    ).values_list("id", flat=True)

    try:
        if issue_id.isdigit():
            group = Group.objects.get(project_id__in=org_project_ids, id=int(issue_id))
        else:
            group = Group.objects.by_qualified_short_id(organization_id, issue_id)

    except Group.DoesNotExist:
        logger.warning(
            "Issue does not exist for organization",
            extra={"organization_id": organization_id, "issue_id": issue_id},
        )
        return None

    serialized_group: dict = serialize(group, user=None, serializer=GroupSerializer())

    # Add issueTypeDescription as it provides better context for LLMs. Note the initial type should be BaseGroupSerializerResponse.
    serialized_group["issueTypeDescription"] = group.issue_type.description

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

    serialized_event: IssueEventSerializerResponse = serialize(
        event, user=None, serializer=EventSerializer()
    )

    try:
        tags_overview = get_all_tags_overview(group)
    except Exception:
        logger.exception(
            "Failed to get tags overview for issue",
            extra={"organization_id": organization_id, "issue_id": issue_id},
        )
        tags_overview = None

    ts_result = _get_issue_event_timeseries(
        organization=organization,
        project_id=group.project_id,
        issue_short_id=group.qualified_short_id,
        first_seen_delta=datetime.now(UTC) - group.first_seen,
    )
    if ts_result:
        timeseries, stats_period, interval = ts_result
    else:
        timeseries = None
        stats_period = None
        interval = None

    return {
        "issue": serialized_group,
        "event_timeseries": timeseries,
        "timeseries_stats_period": stats_period,
        "timeseries_interval": interval,
        "tags_overview": tags_overview,
        "event": serialized_event,
        "event_id": event.event_id,
        "event_trace_id": event.trace_id,
        "project_id": int(serialized_group["project"]["id"]),
        "project_slug": serialized_group["project"]["slug"],
    }


def get_replay_metadata(
    *,
    replay_id: str,
    organization_id: int,
    project_id: int | None = None,
) -> dict[str, Any] | None:
    """
    Get the metadata for a replay through an aggregate replay event query.

    Args:
        replay_id: The ID of the replay. Either a valid UUID or a 8-character hex string prefix. If known, the full ID is recommended for performance.
        organization_id: The ID of the organization the replay belongs to.
        project_id: The projects to query. If not provided, all projects in the organization will be queried.

    Returns:
        A dict containing the metadata for the replay, or None if it's not found.
        The return type should conform to ReplayDetailsResponse (may have extra fields).
    """
    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        logger.warning(
            "Organization does not exist",
            extra={"organization_id": organization_id, "replay_id": replay_id},
        )
        return None

    if not features.has("organizations:session-replay", organization):
        return None

    # Validate the replay ID.
    if len(replay_id) >= 32:
        try:
            replay_id = str(uuid.UUID(replay_id))  # UUID with dashes is recommended for the query.
        except ValueError:
            return None

    elif len(replay_id) != 8 or not replay_id.isalnum():
        return None

    p_ids_and_slugs = list(
        Project.objects.filter(
            organization_id=organization.id,
            status=ObjectStatus.ACTIVE,
            **({"id": project_id} if project_id else {}),
        ).values_list("id", "slug")
    )

    start, end = default_start_end_dates()

    if len(replay_id) >= 32:
        snuba_response = query_replay_instance(
            project_id=[id for id, _ in p_ids_and_slugs],
            replay_id=replay_id,
            start=start,
            end=end,
            organization=organization,
            request_user_id=None,
        )
    else:
        snuba_response = query_replay_instance_with_short_id(
            project_ids=[id for id, _ in p_ids_and_slugs],
            replay_id_prefix=replay_id,
            start=start,
            end=end,
            organization=organization,
            request_user_id=None,
        )

    response = process_raw_response(
        snuba_response,
        fields=[],
    )

    if not response:
        logger.warning(
            "Replay instance not found - no data returned from query",
            extra={
                "replay_id": replay_id,
                "organization_id": organization_id,
            },
        )
        return None

    # Add project_slug field.
    result = cast(dict[str, Any], response[0])
    _, project_slug = next(filter(lambda x: x[0] == int(result["project_id"]), p_ids_and_slugs))
    result["project_slug"] = project_slug
    return result
