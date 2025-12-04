import logging
import uuid
from collections import defaultdict
from datetime import UTC, datetime, timedelta, timezone
from typing import Any, cast

from sentry_protos.snuba.v1.endpoint_get_trace_pb2 import GetTraceRequest
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType

from sentry import eventstore, features
from sentry.api import client
from sentry.api.endpoints.organization_events_timeseries import TOP_EVENTS_DATASETS
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.event import EventSerializer, IssueEventSerializerResponse
from sentry.api.serializers.models.group import GroupSerializer
from sentry.api.utils import default_start_end_dates
from sentry.constants import ALL_ACCESS_PROJECT_ID, ObjectStatus
from sentry.issues.grouptype import GroupCategory
from sentry.models.apikey import ApiKey
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.replays.post_process import process_raw_response
from sentry.replays.query import query_replay_id_by_prefix, query_replay_instance
from sentry.search.eap.constants import BOOLEAN, DOUBLE, INT, STRING
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SAMPLING_MODES, SnubaParams
from sentry.seer.autofix.autofix import get_all_tags_overview
from sentry.seer.constants import SEER_SUPPORTED_SCM_PROVIDERS
from sentry.seer.endpoints.utils import validate_date_params
from sentry.seer.explorer.index_data import UNESCAPED_QUOTE_RE
from sentry.seer.explorer.utils import _convert_profile_to_execution_tree, fetch_profile_data
from sentry.seer.sentry_data_models import EAPTrace
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.trace import query_trace_data
from sentry.snuba.trace_metrics import TraceMetrics
from sentry.snuba.utils import get_dataset
from sentry.utils.dates import parse_stats_period
from sentry.utils.snuba_rpc import get_trace_rpc

logger = logging.getLogger(__name__)


def _get_full_trace_id(
    short_trace_id: str, organization: Organization, projects: list[Project]
) -> str | None:
    """
    Get full trace id if a short id is provided. Queries EAP for a single span.
    Use sliding 14-day windows starting from most recent, up to 90 days in the past, to avoid timeouts.
    TODO: This query ignores the trace_id column index and can do large scans, and is a good candidate for optimization.
    This can be done with a materialized string column for the first 8 chars and a secondary index.
    Alternatively we can try more consistent ways of passing the full ID to Explorer.
    """
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
            query_string=f"trace:{short_trace_id}",
            selected_columns=["trace", "timestamp"],
            orderby=["-timestamp"],
            offset=0,
            limit=1,
            referrer=Referrer.SEER_RPC,
            config=SearchResolverConfig(),
            sampling_mode=None,
        )

        data = subquery_result.get("data")
        full_trace_id = data[0].get("trace") if data else None
        if full_trace_id:
            return full_trace_id

    return None


def execute_table_query(
    *,
    org_id: int,
    dataset: str,
    fields: list[str],
    per_page: int,
    query: str | None = None,
    sort: str | None = None,
    project_ids: list[int] | None = None,
    project_slugs: list[str] | None = None,
    stats_period: str | None = None,
    start: str | None = None,
    end: str | None = None,
    sampling_mode: SAMPLING_MODES = "NORMAL",
    case_insensitive: bool | None = None,
) -> dict[str, Any] | None:
    """
    Execute a query to get table data by calling the events endpoint.

    Arg notes:
        project_ids: The IDs of the projects to query. Cannot be provided with project_slugs.
        project_slugs: The slugs of the projects to query. Cannot be provided with project_ids.
        If neither project_ids nor project_slugs are provided, all active projects will be queried.

        To prevent excessive queries and timeouts, either stats_period or *both* start and end must be provided.
        Providing start or end with stats_period will result in a ValueError.
    """
    stats_period, start, end = validate_date_params(stats_period, start, end)

    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    if not project_ids and not project_slugs:
        project_ids = [ALL_ACCESS_PROJECT_ID]
    # Note if both project_ids and project_slugs are provided, the API request will 400.

    if sort:
        # Auto-select sort field to avoid snuba errors.
        sort_field = sort.lstrip("-")
        if sort_field not in fields:
            fields.append(sort_field)

    params: dict[str, Any] = {
        "dataset": dataset,
        "field": fields,
        "query": query or None,
        "sort": sort if sort else ("-timestamp" if "timestamp" in fields else None),
        "per_page": per_page,
        "statsPeriod": stats_period,
        "start": start,
        "end": end,
        "project": project_ids,
        "projectSlug": project_slugs,
        "sampling": sampling_mode,
        "referrer": Referrer.SEER_RPC,
    }

    # Add boolean params only if provided.
    if case_insensitive is not None:
        params["caseInsensitive"] = "1" if case_insensitive else "0"

    # Remove None values
    params = {k: v for k, v in params.items() if v is not None}

    try:
        resp = client.get(
            auth=ApiKey(organization_id=organization.id, scope_list=["org:read", "project:read"]),
            user=None,
            path=f"/organizations/{organization.slug}/events/",
            params=params,
        )
        return {"data": resp.data["data"]}
    except client.ApiError as e:
        if e.status_code == 400:
            logger.exception("execute_table_query: bad request", extra={"org_id": org_id})
            error_detail = e.body.get("detail") if isinstance(e.body, dict) else None
            return {"error": str(error_detail) if error_detail is not None else str(e.body)}
        raise


def execute_timeseries_query(
    *,
    org_id: int,
    dataset: str,
    y_axes: list[str],
    group_by: list[str] | None = None,
    query: str,
    project_ids: list[int] | None = None,
    project_slugs: list[str] | None = None,
    stats_period: str | None = None,
    start: str | None = None,
    end: str | None = None,
    interval: str | None = None,
    sampling_mode: SAMPLING_MODES = "NORMAL",
    partial: bool | None = None,
    case_insensitive: bool | None = None,
) -> dict[str, Any] | None:
    """
    Execute a query to get chart/timeseries data by calling the events-stats endpoint.

    Arg notes:
        interval: The interval of each bucket. Valid stats period format, e.g. '3h'.
        partial: Whether to allow partial buckets if the last bucket does not align with rollup.
        project_ids: The IDs of the projects to query. Cannot be provided with project_slugs.
        project_slugs: The slugs of the projects to query. Cannot be provided with project_ids.
        If neither project_ids nor project_slugs are provided, all active projects will be queried.

        To prevent excessive queries and timeouts, either stats_period or *both* start and end must be provided.
        Providing start or end with stats_period will result in a ValueError.
    """
    stats_period, start, end = validate_date_params(stats_period, start, end)

    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    group_by = group_by or []
    if not project_ids and not project_slugs:
        project_ids = [ALL_ACCESS_PROJECT_ID]
    # Note if both project_ids and project_slugs are provided, the API request will 400.

    params: dict[str, Any] = {
        "dataset": dataset,
        "yAxis": y_axes,
        "field": y_axes + group_by,
        "query": query,
        "statsPeriod": stats_period,
        "start": start,
        "end": end,
        "interval": interval,
        "project": project_ids,
        "projectSlug": project_slugs,
        "sampling": sampling_mode,
        "referrer": Referrer.SEER_RPC,
        "excludeOther": "0",  # Always include "Other" series
    }

    # Add top_events if group_by is provided
    if group_by and get_dataset(dataset) in TOP_EVENTS_DATASETS:
        params["topEvents"] = 5

    # Add boolean params only if provided.
    if partial is not None:
        params["partial"] = "1" if partial else "0"

    if case_insensitive is not None:
        params["caseInsensitive"] = "1" if case_insensitive else "0"

    # Remove None values
    params = {k: v for k, v in params.items() if v is not None}

    # Call sentry API client. This will raise API errors for non-2xx / 3xx status.
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

    if len(trace_id) < 32:
        full_trace_id = _get_full_trace_id(trace_id, organization, projects)
        if not full_trace_id:
            logger.warning(
                "get_trace_waterfall: No full trace id found for short trace id",
                extra={"organization_id": organization_id, "trace_id": trace_id},
            )
            return None
    else:
        full_trace_id = trace_id

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


def rpc_get_profile_flamegraph(
    profile_id: str,
    organization_id: int,
    trace_id: str | None = None,
    span_description: str | None = None,
) -> dict[str, Any]:
    """
    Fetch and format a profile flamegraph by profile ID (8-char or full 32-char).

    This function:
    1. Queries EAP spans across all projects in the organization
    2. Uses 14-day sliding windows to search up to 90 days back
    3. Finds spans with matching profile_id/profiler_id and aggregates timestamps
    4. Fetches the raw profile data from the profiling service
    5. Converts to execution tree and formats as ASCII flamegraph

    Args:
        profile_id: Profile ID - can be 8 characters (prefix) or full 32 characters
        organization_id: Organization ID to search within
        trace_id: Optional trace ID to filter profile spans more precisely
        span_description: Optional span description to filter profile spans more precisely

    Returns:
        Dictionary with either:
        - Success: {"formatted_profile": str, "metadata": dict}
        - Failure: {"error": str}
    """
    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        logger.warning(
            "rpc_get_profile_flamegraph: Organization not found",
            extra={"organization_id": organization_id},
        )
        return {"error": "Organization not found"}

    # Get all projects for the organization
    projects = list(Project.objects.filter(organization=organization, status=ObjectStatus.ACTIVE))

    if not projects:
        logger.warning(
            "rpc_get_profile_flamegraph: No projects found for organization",
            extra={"organization_id": organization_id},
        )
        return {"error": "No projects found for organization"}

    # Search up to 90 days back using 14-day sliding windows
    now = datetime.now(UTC)
    window_days = 14
    max_days = 90

    full_profile_id: str | None = None
    full_profiler_id: str | None = None
    project_id: int | None = None
    min_start_ts: float | None = None
    max_end_ts: float | None = None

    # Slide back in time in 14-day windows
    for days_back in range(0, max_days, window_days):
        window_end = now - timedelta(days=days_back)
        window_start = now - timedelta(days=min(days_back + window_days, max_days))

        snuba_params = SnubaParams(
            start=window_start,
            end=window_end,
            projects=projects,
            organization=organization,
        )

        query_string = f"(profile.id:{profile_id}* OR profiler.id:{profile_id}*)"
        if trace_id:
            query_string += f" trace:{trace_id}"
        if span_description:
            escaped_description = UNESCAPED_QUOTE_RE.sub('\\"', span_description)
            query_string += f' span.description:"*{escaped_description}*"'

        # Query with aggregation to get profile metadata
        result = Spans.run_table_query(
            params=snuba_params,
            query_string=query_string,
            selected_columns=[
                "profile.id",
                "profiler.id",
                "project.id",
                "min(precise.start_ts)",
                "max(precise.finish_ts)",
            ],
            orderby=[],
            offset=0,
            limit=1,
            referrer=Referrer.SEER_RPC,
            config=SearchResolverConfig(
                auto_fields=True,
            ),
            sampling_mode="NORMAL",
        )

        data = result.get("data")
        logger.info(
            "rpc_get_profile_flamegraph: ran spans query in window",
            extra={
                "profile_id": profile_id,
                "organization_id": organization_id,
                "trace_id": trace_id,
                "span_description": span_description,
                "query_string": query_string,
                "data": data,
                "window_start": window_start.isoformat(),
                "window_end": window_end.isoformat(),
            },
        )
        if data:
            row = data[0]
            full_profile_id = row.get("profile.id")
            full_profiler_id = row.get("profiler.id")
            project_id = row.get("project.id")
            min_start_ts = row.get("min(precise.start_ts)")
            max_end_ts = row.get("max(precise.finish_ts)")

            logger.info(
                "rpc_get_profile_flamegraph: found profile in window",
                extra={
                    "profile_id": profile_id,
                    "organization_id": organization_id,
                    "data": data,
                    "window_start": window_start.isoformat(),
                    "window_end": window_end.isoformat(),
                    "full_profile_id": full_profile_id,
                    "full_profiler_id": full_profiler_id,
                    "project_id": project_id,
                    "min_start_ts": min_start_ts,
                    "max_end_ts": max_end_ts,
                },
            )
            break

    # Determine profile type and actual ID to use
    is_continuous = bool(full_profiler_id and not full_profile_id)
    actual_profile_id = full_profiler_id or full_profile_id

    if not actual_profile_id:
        logger.info(
            "rpc_get_profile_flamegraph: Profile not found",
            extra={"profile_id": profile_id, "organization_id": organization_id},
        )
        return {"error": "Profile not found in the last 90 days"}
    if not project_id:
        logger.warning(
            "rpc_get_profile_flamegraph: Could not find project id for profile",
            extra={"profile_id": profile_id, "organization_id": organization_id},
        )
        return {"error": "Project not found"}

    logger.info(
        "rpc_get_profile_flamegraph: Found profile",
        extra={
            "profile_id": actual_profile_id,
            "project_id": project_id,
            "is_continuous": is_continuous,
            "min_start_ts": min_start_ts,
            "max_end_ts": max_end_ts,
        },
    )

    # Fetch the profile data
    profile_data = fetch_profile_data(
        profile_id=actual_profile_id,
        organization_id=organization_id,
        project_id=project_id,
        start_ts=min_start_ts,
        end_ts=max_end_ts,
        is_continuous=is_continuous,
    )

    if not profile_data:
        logger.warning(
            "rpc_get_profile_flamegraph: Failed to fetch profile data from profiling service",
            extra={"profile_id": actual_profile_id, "project_id": project_id},
        )
        return {"error": "Failed to fetch profile data from profiling service"}

    # Convert to execution tree (returns dicts, not Pydantic models)
    execution_tree, selected_thread_id = _convert_profile_to_execution_tree(profile_data)

    if not execution_tree:
        logger.warning(
            "rpc_get_profile_flamegraph: Empty execution tree",
            extra={
                "profile_id": actual_profile_id,
                "project_id": project_id,
                "raw_profile_data": profile_data,
            },
        )
        return {"error": "Failed to generate execution tree from profile data"}

    return {
        "execution_tree": execution_tree,
        "metadata": {
            "profile_id": actual_profile_id,
            "project_id": project_id,
            "is_continuous": is_continuous,
            "start_ts": min_start_ts,
            "end_ts": max_end_ts,
            "thread_id": selected_thread_id,
        },
    }


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
    issue_category: GroupCategory,
) -> tuple[dict[str, Any], str, str] | None:
    """
    Get event counts over time for an issue (no group by) by calling the events-stats endpoint. Dynamically picks
    a stats period and interval based on the issue's first seen date and EVENT_TIMESERIES_RESOLUTIONS.
    """

    stats_period, interval = None, None
    for p, i in EVENT_TIMESERIES_RESOLUTIONS:
        delta = parse_stats_period(p)
        if delta and first_seen_delta <= delta:
            stats_period, interval = p, i
            break
    stats_period = stats_period or "90d"
    interval = interval or "3d"

    # Use the correct dataset based on issue category
    # Error issues are stored in the "events" dataset, while issue platform issues
    # (performance, etc.) are stored in "issuePlatform" (search_issues)
    dataset = "errors" if issue_category == GroupCategory.ERROR else "issuePlatform"

    data = execute_timeseries_query(
        org_id=organization.id,
        dataset=dataset,
        y_axes=["count()"],
        group_by=[],
        query=f"issue:{issue_short_id}",
        stats_period=stats_period,
        interval=interval,
        project_ids=[project_id],
        partial=True,
    )

    if data is None:
        return None
    return data, stats_period, interval


def _get_trace_with_spans(
    trace_ids: list[str], org_id: int, start: datetime, end: datetime
) -> str | None:
    """
    Given a list of trace IDs, return a trace ID with at least one span (non-deterministic).
    """

    if not trace_ids:
        return None

    if len(trace_ids) == 1:
        query = f"trace:{trace_ids[0]}"
    else:
        query = f"trace:[{','.join(trace_ids)}]"

    # Table query for a single item that has one of the trace IDs.
    result = execute_table_query(
        org_id=org_id,
        dataset="spans",
        per_page=1,
        fields=["trace"],
        query=query,
        sort="-timestamp",
        start=start.isoformat(),
        end=end.isoformat(),
    )

    if not result or not result.get("data"):
        return None

    return result["data"][0]["trace"]


def _get_event_with_valid_trace(group: Group, org_id: int) -> Event | GroupEvent | None:
    """
    Given a group, find an event with a trace that has at least one span.
    """

    # Get up to 50 event IDs and their traces.
    events_result = execute_table_query(
        org_id=org_id,
        dataset="errors",
        per_page=50,
        fields=["trace"],
        query=f"issue:{group.qualified_short_id}",
        sort="-timestamp",
        project_ids=[group.project_id],
        start=group.first_seen.isoformat(),
        end=group.last_seen.isoformat(),
    )

    if not events_result or not events_result.get("data"):
        return None

    trace_to_event_ids = defaultdict(list)
    for e in events_result["data"]:
        if trace := e.get("trace"):
            trace_to_event_ids[trace].append(e["id"])

    # Query spans to select one of the event traces with at least one span.
    trace_with_spans = _get_trace_with_spans(
        list(trace_to_event_ids.keys()),
        org_id,
        group.first_seen - timedelta(days=1),
        group.last_seen + timedelta(days=1),
    )

    if not trace_with_spans:
        return None

    event_id = trace_to_event_ids[trace_with_spans][0]

    return eventstore.backend.get_event_by_id(
        project_id=group.project_id,
        event_id=event_id,
        group_id=group.id,
        tenant_ids={"organization_id": org_id},
    )


def get_issue_and_event_details(
    *,
    organization_id: int,
    issue_id: str | None,
    selected_event: str,
) -> dict[str, Any] | None:
    """
    Tool to get details for a Sentry issue and one of its associated events. null issue_id can be passed so the
    is issue is looked up from the event. We assume the event is always associated with an issue, otherwise None is returned.

    Args:
        organization_id: The ID of the organization to query.
        issue_id: The issue/group ID (numeric) or short ID (string) to look up. If None, we fill this in with the event's `group` property.
        selected_event:
          If issue_id is provided, this is the event to return and must exist in the issue - the options are "oldest", "latest", "recommended", or a UUID.
          If issue_id is not provided, this must be a UUID.

    Returns:
        A dict containing:
            Issue fields: aside from `issue` these are nullable if an error occurred.
            `issue`: Serialized issue details.
            `tags_overview`: A summary of all tags in the issue.
            `event_timeseries`: Event counts over time for the issue.
            `timeseries_stats_period`: The stats period used for the event timeseries.
            `timeseries_interval`: The interval used for the event timeseries.

            Event fields:
            `event`: Serialized event details.
            `event_id`: The event ID of the selected event.
            `event_trace_id`: The trace ID of the selected event. Nullable.
            `project_id`: The event and issue's project ID.
            `project_slug`: The event and issue's project slug.

        Returns None when the requested event or issue is not found, or an error occurred.
    """
    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        logger.warning(
            "Organization does not exist",
            extra={"organization_id": organization_id, "issue_id": issue_id},
        )
        return None

    org_project_ids = list(
        Project.objects.filter(organization=organization, status=ObjectStatus.ACTIVE).values_list(
            "id", flat=True
        )
    )
    if not org_project_ids:
        return None

    event: Event | GroupEvent | None = None
    group: Group

    # Fetch the group object.
    if issue_id is None:
        # If issue_id is not provided, first find the event. Then use this to fetch the group.
        uuid.UUID(selected_event)  # Raises ValueError if not valid UUID
        # We can't use get_event_by_id since we don't know the exact project yet.
        events_result = eventstore.backend.get_events(
            filter=eventstore.Filter(
                event_ids=[selected_event],
                organization_id=organization_id,
                project_ids=org_project_ids,
            ),
            limit=1,
            tenant_ids={"organization_id": organization_id},
        )
        if not events_result:
            logger.warning(
                "Could not find the requested event ID",
                extra={
                    "organization_id": organization_id,
                    "issue_id": issue_id,
                    "selected_event": selected_event,
                },
            )
            return None

        event = events_result[0]
        assert event is not None
        if event.group is None:
            logger.warning(
                "Event is not associated with a group",
                extra={"organization_id": organization_id, "event_id": event.event_id},
            )
            return None

        group = event.group

    else:
        # Fetch the group from issue_id.
        try:
            if issue_id.isdigit():
                group = Group.objects.get(project_id__in=org_project_ids, id=int(issue_id))
            else:
                group = Group.objects.by_qualified_short_id(organization_id, issue_id)

        except Group.DoesNotExist:
            logger.warning(
                "Requested issue does not exist for organization",
                extra={"organization_id": organization_id, "issue_id": issue_id},
            )
            return None

    # Get the issue data, tags overview, and event count timeseries.
    serialized_group = dict(serialize(group, user=None, serializer=GroupSerializer()))
    # Add issueTypeDescription as it provides better context for LLMs. Note the initial type should be BaseGroupSerializerResponse.
    serialized_group["issueTypeDescription"] = group.issue_type.description

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
        issue_category=group.issue_category,
    )
    if ts_result:
        timeseries, timeseries_stats_period, timeseries_interval = ts_result
    else:
        timeseries, timeseries_stats_period, timeseries_interval = None, None, None

    # Fetch event from group, if not already fetched.
    if event is None:
        if selected_event == "oldest":
            event = group.get_oldest_event()
        elif selected_event == "latest":
            event = group.get_latest_event()
        elif selected_event == "recommended":
            event = group.get_recommended_event()
        else:
            uuid.UUID(selected_event)  # Raises ValueError if not valid UUID
            event = eventstore.backend.get_event_by_id(
                project_id=group.project_id,
                event_id=selected_event,
                group_id=group.id,
                tenant_ids={"organization_id": organization_id},
            )

    # If the recommended event (default when agent doesn't specify an event) doesn't have a useful trace, try finding a different event.
    try:
        if selected_event == "recommended" and (
            event is None
            or event.trace_id is None
            or _get_trace_with_spans(
                [event.trace_id],
                organization_id,
                group.first_seen - timedelta(days=1),
                group.last_seen + timedelta(days=1),
            )
            is None
        ):
            logger.info(
                "No spans found for recommended event, trying a different event.",
                extra={
                    "organization_id": organization_id,
                    "issue_id": group.id,
                    "recommended_event_id": event.event_id if event else None,
                    "event_trace_id": event.trace_id if event else None,
                },
            )

            candidate_event = _get_event_with_valid_trace(group, organization_id)
            if candidate_event:
                event = candidate_event

                logger.info(
                    "Replaced recommended event with an event with spans.",
                    extra={
                        "organization_id": organization_id,
                        "issue_id": group.id,
                        "candidate_event_id": candidate_event.event_id,
                        "candidate_event_trace_id": candidate_event.trace_id,
                    },
                )

    except Exception:
        logger.exception(
            "Error getting event with valid trace",
            extra={
                "organization_id": organization_id,
                "issue_id": group.id,
                "selected_event": selected_event,
            },
        )

    if event is None:
        logger.warning(
            "Could not find the selected event.",
            extra={
                "organization_id": organization_id,
                "issue_id": issue_id,
                "selected_event": selected_event,
            },
        )
        return None

    # Serialize event.
    serialized_event: IssueEventSerializerResponse = serialize(
        event, user=None, serializer=EventSerializer()
    )

    return {
        "issue": serialized_group,
        "event_timeseries": timeseries,
        "timeseries_stats_period": timeseries_stats_period,
        "timeseries_interval": timeseries_interval,
        "tags_overview": tags_overview,
        "event": serialized_event,
        "event_id": event.event_id,
        "event_trace_id": event.trace_id,
        "project_id": event.project_id,
        "project_slug": event.project.slug,
    }


def get_replay_metadata(
    *,
    replay_id: str,
    organization_id: int,
    project_slug: str | None = None,
) -> dict[str, Any] | None:
    """
    Get the metadata for a replay through an aggregate replay event query.

    Args:
        replay_id: The ID of the replay. Either a valid UUID or a 8-character hex string prefix. If known, the full ID is recommended for performance.
        organization_id: The ID of the organization the replay belongs to.
        project_slug: The slug of the project to query. If not provided, all projects in the organization will be queried.

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

    p_ids_and_slugs = list(
        Project.objects.filter(
            organization_id=organization.id,
            status=ObjectStatus.ACTIVE,
            **({"slug": project_slug} if project_slug else {}),
        ).values_list("id", "slug")
    )

    if not p_ids_and_slugs:
        logger.warning(
            "No projects found for given organization and project slug",
            extra={"organization_id": organization_id, "project_slug": project_slug},
        )
        return None

    start, end = default_start_end_dates()

    if len(replay_id) < 32:
        # Subquery for the full replay ID.
        full_replay_id = query_replay_id_by_prefix(
            project_ids=[id for id, _ in p_ids_and_slugs],
            replay_id_prefix=replay_id,
            start=start,
            end=end,
            organization=organization,
        )
        if not full_replay_id:
            logger.warning(
                "Replay short ID lookup failed",
                extra={"replay_id": replay_id, "organization_id": organization_id},
            )
            return None

        replay_id = full_replay_id

    try:
        replay_id = str(
            uuid.UUID(replay_id)
        )  # Normalizing with dashes is recommended for the query.
    except ValueError:
        logger.warning(
            "Invalid replay ID", extra={"replay_id": replay_id, "organization_id": organization_id}
        )
        return None

    snuba_response = query_replay_instance(
        project_id=[id for id, _ in p_ids_and_slugs],
        replay_id=replay_id,
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
    result["project_slug"] = next(
        filter(lambda x: x[0] == int(result["project_id"]), p_ids_and_slugs)
    )[1]
    return result


def get_trace_item_attributes(
    *,
    org_id: int,
    project_id: int,
    trace_id: str,
    item_id: str,
    item_type: str,
) -> dict[str, Any]:
    """
    Fetch all attributes for a given trace item (span, metric, log, etc.).

    This is a generic version that supports all trace item types.

    Args:
        org_id: Organization ID
        project_id: Project ID
        trace_id: Trace ID
        item_id: The item ID (span_id, metric_id, log_id, etc.)
        item_type: The trace item type as a string ("spans", "tracemetrics", "logs", etc.)

    Returns:
        Dict with "attributes" key containing all attributes for the item
    """
    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning(
            "get_trace_item_attributes: Organization not found",
            extra={"org_id": org_id},
        )
        return {"attributes": []}

    try:
        project = Project.objects.get(id=project_id, organization=organization)
    except Project.DoesNotExist:
        logger.warning(
            "get_trace_item_attributes: Project not found",
            extra={"org_id": org_id, "project_id": project_id},
        )
        return {"attributes": []}

    params = {
        "item_type": item_type,
        "referrer": Referrer.SEER_RPC.value,
        "trace_id": trace_id,
    }

    resp = client.get(
        auth=ApiKey(organization_id=organization.id, scope_list=["org:read", "project:read"]),
        user=None,
        path=f"/projects/{organization.slug}/{project.slug}/trace-items/{item_id}/",
        params=params,
    )

    return {"attributes": resp.data["attributes"]}


def _make_get_trace_request(
    trace_id: str,
    trace_item_type: TraceItemType.ValueType,
    resolver: SearchResolver,
    limit: int | None,
    sampling_mode: SAMPLING_MODES,
) -> list[dict[str, Any]]:
    """
    Make a request to the EAP GetTrace endpoint to get all attributes for a given trace and item type.
    Includes a short ID translation if one is provided.

    Args:
        trace_id: The trace ID to query.
        trace_item_type: The type of trace item to query.
        resolver: The EAP search resolver, with SnubaParams set.
        limit: The limit to apply to the request. Passing None will use a Snuba server default.
        sampling_mode: The sampling mode to use for the request.

    Returns:
        A list of dictionaries for each trace item, with the keys:
        - id: The trace item ID.
        - timestamp: ISO 8601 timestamp, Z suffix.
        - attributes: A dictionary of dictionaries, where the keys are the attribute names.
          - attributes[name].value: The value of the attribute (primitives only)
    """
    organization = cast(Organization, resolver.params.organization)
    projects = list(resolver.params.projects)

    # Look up full trace id if a short id is provided.
    if len(trace_id) < 32:
        full_trace_id = _get_full_trace_id(trace_id, organization, projects)
        if not full_trace_id:
            logger.warning(
                "No full trace id found for short trace id",
                extra={"org_id": organization.id, "trace_id": trace_id},
            )
            return []
    else:
        full_trace_id = trace_id

    # Build the GetTraceRequest.
    meta = resolver.resolve_meta(referrer=Referrer.SEER_RPC, sampling_mode=sampling_mode)
    request = GetTraceRequest(
        meta=meta,
        trace_id=full_trace_id,
        items=[
            GetTraceRequest.TraceItem(
                item_type=trace_item_type,
                attributes=None,  # Returns all attributes.
            )
        ],
    )
    if limit:
        request.limit = limit

    # Query EAP EndpointGetTrace then format the response - based on spans_rpc.Spans.run_trace_query
    response = get_trace_rpc(request)

    # Map internal names to attribute definitions for easy lookup
    resolved_attrs_by_internal_name = {
        c.internal_name: c for c in resolver.definitions.columns.values() if not c.secondary_alias
    }

    # Parse response, returning the public aliases.
    for item_group in response.item_groups:
        item_dicts: list[dict[str, Any]] = []

        for item in item_group.items:
            attr_dict: dict[str, dict[str, Any]] = {}
            for a in item.attributes:
                r = resolved_attrs_by_internal_name.get(a.key.name)
                name = r.public_alias if r else a.key.name

                if name.startswith("sentry._internal"):
                    continue

                if name == "project_id":  # Same internal name, normalize to project.id
                    name = "project.id"

                # Note - custom attrs not in the definitions can only be returned as strings or doubles.
                if a.key.type == STRING:
                    attr_dict[name] = {
                        "value": a.value.val_str,
                    }
                elif a.key.type == DOUBLE:
                    attr_dict[name] = {
                        "value": a.value.val_double,
                    }
                elif a.key.type == BOOLEAN:
                    attr_dict[name] = {
                        "value": a.value.val_bool,
                    }
                elif a.key.type == INT:
                    if r and r.search_type == "boolean":
                        attr_dict[name] = {
                            "value": a.value.val_int == 1,
                        }
                    else:
                        attr_dict[name] = {
                            "value": a.value.val_int,
                        }

                    if name == "project.id":
                        # Enrich with project slug, alias "project"
                        attr_dict["project"] = {
                            "value": resolver.params.project_id_map.get(a.value.val_int, "Unknown"),
                        }

            item_dicts.append(
                {
                    "id": item.id,
                    "timestamp": item.timestamp.ToJsonString(),
                    "attributes": attr_dict,
                }
            )

        # We expect exactly one item group in the request/response.
        return item_dicts

    return []


def get_log_attributes_for_trace(
    *,
    org_id: int,
    trace_id: str,
    message_substring: str = "",
    substring_case_sensitive: bool = True,
    stats_period: str | None = None,
    start: str | None = None,
    end: str | None = None,
    project_slugs: list[str] | None = None,
    sampling_mode: SAMPLING_MODES = "NORMAL",
    limit: int | None = 50,
) -> dict[str, Any] | None:
    """
    Get all attributes for all logs in a trace. You can optionally filter by message substring and/or project slugs.

    Returns:
        A list of dictionaries for each log, with the keys:
        - id: The trace item ID.
        - timestamp: ISO 8601 timestamp.
        - attributes: A dict[str, dict[str, Any]] where the keys are the attribute names. See _make_get_trace_request for more details.
    """

    stats_period, start, end = validate_date_params(stats_period, start, end)

    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    projects = list(
        Project.objects.filter(
            organization=organization,
            status=ObjectStatus.ACTIVE,
            **({"slug__in": project_slugs} if bool(project_slugs) else {}),
        )
    )

    snuba_params = SnubaParams(
        start=datetime.fromisoformat(start) if start else None,
        end=datetime.fromisoformat(end) if end else None,
        stats_period=stats_period,
        projects=projects,
        organization=organization,
        sampling_mode=sampling_mode,
    )
    resolver = OurLogs.get_resolver(params=snuba_params, config=SearchResolverConfig())

    items = _make_get_trace_request(
        trace_id=trace_id,
        trace_item_type=TraceItemType.TRACE_ITEM_TYPE_LOG,
        resolver=resolver,
        limit=(limit if not message_substring else None),  # Return all results if we're filtering.
        sampling_mode=sampling_mode,
    )

    if not message_substring:
        return {"data": items}

    # Filter on message substring.
    filtered_items: list[dict[str, Any]] = []
    for item in items:
        if limit is not None and len(filtered_items) >= limit:
            break

        message: str = item["attributes"].get("message", {}).get("value", "")
        if (substring_case_sensitive and message_substring in message) or (
            not substring_case_sensitive and message_substring.lower() in message.lower()
        ):
            filtered_items.append(item)

    return {"data": filtered_items}


def get_metric_attributes_for_trace(
    *,
    org_id: int,
    trace_id: str,
    metric_name: str = "",
    stats_period: str | None = None,
    start: str | None = None,
    end: str | None = None,
    project_slugs: list[str] | None = None,
    sampling_mode: SAMPLING_MODES = "NORMAL",
    limit: int | None = 50,
) -> dict[str, Any] | None:
    """
    Get all attributes for all metrics in a trace. You can optionally filter by metric name and/or project slugs.
    The metric name is a case-insensitive exact match.

    Returns:
        A list of dictionaries for each metric event, with the keys:
        - id: The trace item ID.
        - timestamp: ISO 8601 timestamp.
        - attributes: A dict[str, dict[str, Any]] where the keys are the attribute names. See _make_get_trace_request for more details.
    """

    stats_period, start, end = validate_date_params(stats_period, start, end)

    try:
        organization = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"org_id": org_id})
        return None

    projects = list(
        Project.objects.filter(
            organization=organization,
            status=ObjectStatus.ACTIVE,
            **({"slug__in": project_slugs} if project_slugs else {}),
        )
    )

    snuba_params = SnubaParams(
        start=datetime.fromisoformat(start) if start else None,
        end=datetime.fromisoformat(end) if end else None,
        stats_period=stats_period,
        projects=projects,
        organization=organization,
        sampling_mode=sampling_mode,
    )
    resolver = TraceMetrics.get_resolver(params=snuba_params, config=SearchResolverConfig())

    items = _make_get_trace_request(
        trace_id=trace_id,
        trace_item_type=TraceItemType.TRACE_ITEM_TYPE_METRIC,
        resolver=resolver,
        limit=(limit if not metric_name else None),  # Return all results if we're filtering.
        sampling_mode=sampling_mode,
    )

    if not metric_name:
        return {"data": items}

    # Filter on metric name (exact case-insensitive match).
    filtered_items: list[dict[str, Any]] = []
    for item in items:
        if limit is not None and len(filtered_items) >= limit:
            break

        item_metric_name: str = item["attributes"].get("metric.name", {}).get("value", "")
        if metric_name.lower() == item_metric_name.lower():
            filtered_items.append(item)

    return {"data": filtered_items}
