import logging
import uuid
from datetime import UTC, datetime, timedelta, timezone
from typing import Any, cast

from sentry import eventstore, features
from sentry.api import client
from sentry.api.endpoints.organization_events_timeseries import TOP_EVENTS_DATASETS
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.event import EventSerializer, IssueEventSerializerResponse
from sentry.api.serializers.models.group import GroupSerializer
from sentry.api.utils import default_start_end_dates
from sentry.constants import ALL_ACCESS_PROJECT_ID, ObjectStatus
from sentry.models.apikey import ApiKey
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.replays.post_process import process_raw_response
from sentry.replays.query import query_replay_id_by_prefix, query_replay_instance
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SAMPLING_MODES, SnubaParams
from sentry.seer.autofix.autofix import get_all_tags_overview
from sentry.seer.constants import SEER_SUPPORTED_SCM_PROVIDERS
from sentry.seer.explorer.utils import _convert_profile_to_execution_tree, fetch_profile_data
from sentry.seer.sentry_data_models import EAPTrace
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.trace import query_trace_data
from sentry.snuba.utils import get_dataset
from sentry.utils.dates import parse_stats_period

logger = logging.getLogger(__name__)


def execute_table_query(
    *,
    org_id: int,
    dataset: str,
    fields: list[str],
    per_page: int,
    stats_period: str,
    query: str | None = None,
    sort: str | None = None,
    project_ids: list[int] | None = None,
    project_slugs: list[str] | None = None,
    sampling_mode: SAMPLING_MODES = "NORMAL",
    case_insensitive: bool | None = None,
) -> dict[str, Any] | None:
    """
    Execute a query to get table data by calling the events endpoint.

    Arg notes:
        project_ids: The IDs of the projects to query. Cannot be provided with project_slugs.
        project_slugs: The slugs of the projects to query. Cannot be provided with project_ids.
        If neither project_ids nor project_slugs are provided, all active projects will be queried.
    """
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

    # Call sentry API client. This will raise API errors for non-2xx / 3xx status.
    resp = client.get(
        auth=ApiKey(organization_id=organization.id, scope_list=["org:read", "project:read"]),
        user=None,
        path=f"/organizations/{organization.slug}/events/",
        params=params,
    )
    return {"data": resp.data["data"]}


def execute_timeseries_query(
    *,
    org_id: int,
    dataset: str,
    y_axes: list[str],
    group_by: list[str] | None = None,
    query: str,
    stats_period: str,
    interval: str | None = None,
    project_ids: list[int] | None = None,
    project_slugs: list[str] | None = None,
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
    """
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

    # Get full trace id if a short id is provided. Queries EAP for a single span.
    # Use sliding 14-day windows starting from most recent, up to 90 days in the past, to avoid timeouts.
    # TODO: This query ignores the trace_id column index and can do large scans, and is a good candidate for optimization.
    # This can be done with a materialized string column for the first 8 chars and a secondary index.
    # Alternatively we can try more consistent ways of passing the full ID to Explorer.
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


def rpc_get_profile_flamegraph(profile_id: str, organization_id: int) -> dict[str, Any]:
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

        # Query with aggregation to get profile metadata
        result = Spans.run_table_query(
            params=snuba_params,
            query_string=f"(profile.id:{profile_id}* OR profiler.id:{profile_id}*)",
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
    execution_tree = _convert_profile_to_execution_tree(profile_data)

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

    # Extract thread_id from profile data
    profile = profile_data.get("profile") or profile_data.get("chunk", {}).get("profile")
    samples = profile.get("samples", []) if profile else []
    thread_id = str(samples[0]["thread_id"]) if samples else None

    return {
        "execution_tree": execution_tree,
        "metadata": {
            "profile_id": actual_profile_id,
            "project_id": project_id,
            "is_continuous": is_continuous,
            "start_ts": min_start_ts,
            "end_ts": max_end_ts,
            "thread_id": thread_id,
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

    data = execute_timeseries_query(
        org_id=organization.id,
        dataset="issuePlatform",
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
