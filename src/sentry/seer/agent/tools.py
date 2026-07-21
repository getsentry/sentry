import logging
import time
import uuid
from datetime import UTC, datetime, timedelta, timezone
from typing import Any, TypedDict, cast

from django.core.exceptions import BadRequest
from django.db import models
from rest_framework.exceptions import ParseError
from sentry_protos.snuba.v1.endpoint_get_trace_pb2 import GetTraceRequest
from sentry_protos.snuba.v1.request_common_pb2 import TraceItemType
from snuba_sdk import Column, Condition, Entity, Function, Limit, Op, Query, Request

from sentry import eventstore, features
from sentry.api import client
from sentry.api.endpoints.organization_events_timeseries import TOP_EVENTS_DATASETS
from sentry.api.event_search import parse_search_query
from sentry.api.exceptions import BadRequest as SentryBadRequest
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.activity import ActivitySerializer
from sentry.api.serializers.models.commit import CommitSerializer
from sentry.api.serializers.models.event import EventSerializer
from sentry.api.serializers.models.group import GroupSerializer
from sentry.api.utils import MAX_STATS_PERIOD, default_start_end_dates, get_date_range_from_params
from sentry.constants import ALL_ACCESS_PROJECT_ID, ObjectStatus
from sentry.exceptions import InvalidParams, InvalidSearchQuery
from sentry.issues.grouptype import GroupCategory
from sentry.models.activity import Activity
from sentry.models.apikey import ApiKey
from sentry.models.commit import Commit
from sentry.models.commitfilechange import CommitFileChange
from sentry.models.group import EventOrdering, Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey, ProjectKeyStatus, UseCase
from sentry.models.projectownership import ProjectOwnership
from sentry.models.release import Release
from sentry.models.repository import Repository
from sentry.models.team import Team, TeamStatus
from sentry.processing_errors.grouptype import LowValueSpanConfigurationType
from sentry.replays.post_process import process_raw_response
from sentry.replays.query import (
    query_replay_id_by_prefix,
    query_replay_instance,
    query_replays_collection_paginated,
    replay_url_parser_config,
)
from sentry.replays.validators import VALID_FIELD_SET as REPLAY_VALID_FIELD_SET
from sentry.search.eap.constants import BOOLEAN, DOUBLE, INT, STRING
from sentry.search.eap.occurrences.query_utils import build_event_id_in_filter
from sentry.search.eap.resolver import SearchResolver
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.constants import ISSUE_ID_ALIAS
from sentry.search.events.types import SAMPLING_MODES, SnubaParams
from sentry.seer.agent.index_data import UNESCAPED_QUOTE_RE
from sentry.seer.agent.utils import (
    _convert_profile_to_execution_tree,
    fetch_profile_data,
    get_group_date_range,
    get_retention_boundary,
)
from sentry.seer.autofix.autofix import get_all_tags_overview
from sentry.seer.autofix.utils import get_repo_url_path
from sentry.seer.seer_setup import get_supported_scm_providers
from sentry.seer.sentry_data_models import (
    BaselineTagDistributionEntry,
    BaselineTagDistributionResponse,
    EAPTrace,
    EmptyResponse,
    EventDetailsResponse,
    ExecuteQueryErrorResponse,
    ExecuteQuerySuccessResponse,
    ExecuteTimeseriesQueryErrorResponse,
    ExecuteTimeseriesQuerySuccessResponse,
    GetDsnResponse,
    IssueAndEventDetailsResponse,
    IssueCommittersResponse,
    IssueDetailsResponse,
    IssueOwner,
    IssueOwnershipResponse,
    ProfileFlamegraphErrorResponse,
    ProfileFlamegraphMetadata,
    ProfileFlamegraphSuccessResponse,
    ReplayMetadataResponse,
    RepositoryDefinitionResponse,
    TeamMembersResponse,
    TraceItemEventsResponse,
)
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.snuba.dataset import Dataset
from sentry.snuba.ourlogs import OurLogs
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.snuba.trace import query_trace_data
from sentry.snuba.trace_metrics import TraceMetrics
from sentry.snuba.utils import get_dataset
from sentry.types.activity import ActivityType
from sentry.users.services.user.service import user_service
from sentry.utils import metrics
from sentry.utils.committers import (
    get_event_file_committers,
    get_frame_paths,
    get_release_commit_candidates,
    get_serialized_committers,
)
from sentry.utils.dates import parse_stats_period
from sentry.utils.snuba import raw_snql_query
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
    Alternatively we can try more consistent ways of passing the full ID to the agent.
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
            referrer=Referrer.SEER_EXPLORER_TOOLS,
            config=SearchResolverConfig(),
            sampling_mode=None,
        )

        data = subquery_result.get("data")
        full_trace_id = data[0].get("trace") if data else None
        if full_trace_id:
            return full_trace_id

    return None


def _format_events_query_validation_errors(body: dict[str, Any]) -> str:
    """Format an events/validate response body into an agent-readable error string."""
    lines: list[str] = ["Query validation failed:"]

    for section in ("dataset", "environment", "projects"):
        for item in body.get(section) or []:
            if item.get("valid") or not item.get("error"):
                continue
            name = item.get("name")
            if name:
                lines.append(f"- {section} '{name}': {item['error']}")
            else:
                lines.append(f"- {section}: {item['error']}")

    for section in ("field", "orderby"):
        for item in body.get(section) or []:
            if item.get("valid") or not item.get("error"):
                continue
            name = item.get("name", "?")
            lines.append(f"- {section} '{name}': {item['error']}")

    query = body.get("query") or {}
    if not query.get("valid") and query.get("error"):
        lines.append(f"- query: {query['error']}")
        for item in query.get("fields") or []:
            if item.get("valid") or not item.get("error"):
                continue
            name = item.get("name", "?")
            lines.append(f"  - field '{name}': {item['error']}")

    if len(lines) == 1:
        return f"Query validation failed: {body}"
    return "\n".join(lines)


def _validate_events_query_params(
    *,
    organization: Organization,
    dataset: str,
    fields: list[str],
    query: str | None,
    sort: str | None,
    project_ids: list[int] | None,
    project_slugs: list[str] | None,
    stats_period: str | None,
    start: str | None,
    end: str | None,
) -> ExecuteQueryErrorResponse | None:
    """
    Call events/validate and return an agent-readable error if the query is invalid.

    Unexpected validate failures are logged and ignored so the events query can still run.
    """
    params: dict[str, Any] = {
        "dataset": dataset,
        "field": fields,
        "query": query or None,
        "project": project_ids,
        "projectSlug": project_slugs,
        "statsPeriod": stats_period,
        "start": start,
        "end": end,
        "referrer": Referrer.SEER_EXPLORER_TOOLS,
    }
    if sort:
        params["orderby"] = [sort]
    params = {k: v for k, v in params.items() if v is not None}

    try:
        resp = client.get(
            auth=ApiKey(organization_id=organization.id, scope_list=["org:read", "project:read"]),
            user=None,
            path=f"/organizations/{organization.slug}/events/validate/",
            params=params,
        )
        if isinstance(resp.data, dict) and resp.data.get("valid") is False:
            return ExecuteQueryErrorResponse(
                error=_format_events_query_validation_errors(resp.data)
            )
        return None
    except client.ApiError as e:
        if e.status_code == 400 and isinstance(e.body, dict) and "valid" in e.body:
            return ExecuteQueryErrorResponse(error=_format_events_query_validation_errors(e.body))
        logger.exception(
            "execute_table_query: validate request failed",
            extra={"org_id": organization.id},
        )
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
    span_query: list[str] | None = None,
    log_query: list[str] | None = None,
    metric_query: list[str] | None = None,
    validate: bool = False,
) -> ExecuteQuerySuccessResponse | ExecuteQueryErrorResponse | None:
    """
    Execute a query to get table data by calling the events endpoint.

    span_query/log_query/metric_query are optional cross-event (same-trace) filters:
    when set, results are restricted to the primary dataset's rows whose trace also
    contains a matching span/log/metric. Forwarded to the events endpoint as repeated
    spanQuery/logQuery/metricQuery params (read server-side by get_additional_queries).

    Arg notes:
        project_ids: The IDs of the projects to query. Cannot be provided with project_slugs.
        project_slugs: The slugs of the projects to query. Cannot be provided with project_ids.
        If neither project_ids nor project_slugs are provided, all active projects will be queried.

        To prevent excessive queries and timeouts, either stats_period or *both* start and end must be provided.
        Start/end params take precedence over stats_period.

        validate: When True, call events/validate first. Invalid queries return an
        agent-readable error string instead of running the events query.
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
    elif "timestamp" in fields:
        # Default to -timestamp only if timestamp was selected.
        sort = "-timestamp"

    if validate:
        validation_error = _validate_events_query_params(
            organization=organization,
            dataset=dataset,
            fields=fields,
            query=query,
            sort=sort,
            project_ids=project_ids,
            project_slugs=project_slugs,
            stats_period=stats_period,
            start=start,
            end=end,
        )
        if validation_error is not None:
            return validation_error

    params: dict[str, Any] = {
        "dataset": dataset,
        "field": fields,
        "query": query or None,
        "sort": sort,
        "per_page": per_page,
        "statsPeriod": stats_period,
        "start": start,
        "end": end,
        "project": project_ids,
        "projectSlug": project_slugs,
        "sampling": sampling_mode,
        "referrer": Referrer.SEER_EXPLORER_TOOLS,
    }

    # Add boolean params only if provided.
    if case_insensitive is not None:
        params["caseInsensitive"] = "1" if case_insensitive else "0"

    # Cross-event (same-trace) filters.
    if span_query:
        params["spanQuery"] = span_query
    if log_query:
        params["logQuery"] = log_query
    if metric_query:
        params["metricQuery"] = metric_query

    # Remove None values
    params = {k: v for k, v in params.items() if v is not None}

    try:
        resp = client.get(
            auth=ApiKey(organization_id=organization.id, scope_list=["org:read", "project:read"]),
            user=None,
            path=f"/organizations/{organization.slug}/events/",
            params=params,
        )
        if resp.data.get("meta"):
            return ExecuteQuerySuccessResponse(data=resp.data["data"], meta=resp.data["meta"])
        return ExecuteQuerySuccessResponse(data=resp.data["data"])
    except client.ApiError as e:
        # For 400 errors, return an error string for the query builder agent.
        if e.status_code == 400:
            logger.exception("execute_table_query: bad request", extra={"org_id": org_id})
            error_detail = e.body.get("detail") if isinstance(e.body, dict) else None
            return ExecuteQueryErrorResponse(
                error=str(error_detail) if error_detail is not None else str(e.body)
            )
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
) -> ExecuteTimeseriesQuerySuccessResponse | ExecuteTimeseriesQueryErrorResponse | None:
    """
    Execute a query to get chart/timeseries data by calling the events-stats endpoint.

    Arg notes:
        interval: The interval of each bucket. Valid stats period format, e.g. '3h'.
        partial: Whether to allow partial buckets if the last bucket does not align with rollup.
        project_ids: The IDs of the projects to query. Cannot be provided with project_slugs.
        project_slugs: The slugs of the projects to query. Cannot be provided with project_ids.
        If neither project_ids nor project_slugs are provided, all active projects will be queried.

        To prevent excessive queries and timeouts, either stats_period or *both* start and end must be provided.
        Start/end params take precedence over stats_period.
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
        "start": start,
        "end": end,
        "interval": interval,
        "project": project_ids,
        "projectSlug": project_slugs,
        "sampling": sampling_mode,
        "referrer": Referrer.SEER_EXPLORER_TOOLS,
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
    try:
        resp = client.get(
            auth=ApiKey(organization_id=organization.id, scope_list=["org:read", "project:read"]),
            user=None,
            path=f"/organizations/{organization.slug}/events-stats/",
            params=params,
        )
    except client.ApiError as e:
        # For 400 errors, return an error detail for the query builder agent.
        # Use a reserved "_seer_error_detail" key so it can't collide with a
        # group_by value (which becomes a top-level key in grouped responses below).
        if e.status_code == 400:
            logger.exception("execute_timeseries_query: bad request", extra={"org_id": org_id})
            error_detail = e.body.get("detail") if isinstance(e.body, dict) else None
            return ExecuteTimeseriesQueryErrorResponse(
                seer_error_detail=(str(error_detail) if error_detail is not None else str(e.body))
            )
        raise
    data = resp.data

    # Always normalize to the nested {"metric": {"data": [...]}} format for consistency
    metric_is_single = len(y_axes) == 1
    metric_name = y_axes[0] if metric_is_single else None
    if metric_name and metric_is_single:
        # Handle grouped data with single metric: wrap each group's data in the metric name
        if group_by:
            return ExecuteTimeseriesQuerySuccessResponse(
                __root__={
                    group_value: (
                        {metric_name: group_data}
                        if isinstance(group_data, dict) and "data" in group_data
                        else group_data
                    )
                    for group_value, group_data in data.items()
                }
            )

        # Handle non-grouped data with single metric: wrap data in the metric name
        if isinstance(data, dict) and "data" in data:
            return ExecuteTimeseriesQuerySuccessResponse(__root__={metric_name: data})

    return ExecuteTimeseriesQuerySuccessResponse(__root__=data)


def execute_trace_table_query(
    *,
    organization_id: int,
    query: str | None = None,
    sort: str | None = None,
    per_page: int,
    project_ids: list[int] | None = None,
    project_slugs: list[str] | None = None,
    stats_period: str | None = None,
    start: str | None = None,
    end: str | None = None,
    sampling_mode: SAMPLING_MODES = "NORMAL",
    case_insensitive: bool | None = None,
) -> ExecuteQuerySuccessResponse | ExecuteQueryErrorResponse | None:
    """
    Execute a query to get trace samples by passing through the OrganizationTracesEndpoint.
    This endpoint does not support any kind of aggregation.

    Arg notes:
        project_ids: The IDs of the projects to query. Cannot be provided with project_slugs.
        project_slugs: The slugs of the projects to query. Cannot be provided with project_ids.
        If neither project_ids nor project_slugs are provided, all active projects will be queried.
        Start/end params take precedence over stats_period. Default time range is the last 24 hours.
    """
    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        logger.warning(
            "execute_trace_table_query: Organization not found",
            extra={"org_id": organization_id},
        )
        return None
    if not project_ids and not project_slugs:
        project_ids = [ALL_ACCESS_PROJECT_ID]

    params: dict[str, Any] = {
        "dataset": "spans",  # the only supported value.
        "query": query or None,
        "sort": sort,
        "per_page": per_page,
        "statsPeriod": stats_period,
        "start": start,
        "end": end,
        "project": project_ids,
        "projectSlug": project_slugs,
        "sampling": sampling_mode,
        "referrer": Referrer.SEER_EXPLORER_TOOLS,
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
            path=f"/organizations/{organization.slug}/traces/",
            params=params,
        )
        if resp.data.get("meta"):
            return ExecuteQuerySuccessResponse(data=resp.data["data"], meta=resp.data["meta"])
        return ExecuteQuerySuccessResponse(data=resp.data["data"])
    except client.ApiError as e:
        # For 400 errors, return an error string for the query builder agent.
        if e.status_code == 400:
            logger.exception(
                "execute_trace_table_query: bad request", extra={"org_id": organization_id}
            )
            error_detail = e.body.get("detail") if isinstance(e.body, dict) else None
            return ExecuteQueryErrorResponse(
                error=str(error_detail) if error_detail is not None else str(e.body)
            )
        raise


DEFAULT_REPLAY_SEARCH_FIELDS = [
    "id",
    "project_id",
    "started_at",
    "finished_at",
    "duration",
    "count_errors",
    "count_dead_clicks",
    "count_rage_clicks",
    "count_urls",
    "urls",
    "user",
    "trace_ids",
    "platform",
]


def execute_replays_query(
    *,
    organization_id: int,
    per_page: int,
    query: str | None = None,
    fields: list[str] | None = None,
    sort: str | None = None,
    project_ids: list[int] | None = None,
    project_slugs: list[str] | None = None,
    stats_period: str | None = None,
    start: str | None = None,
    end: str | None = None,
) -> ExecuteQuerySuccessResponse | ExecuteQueryErrorResponse | None:
    """
    Execute a session replay search using the dedicated Replay collection query.

    Arg notes:
        project_ids: The IDs of the projects to query. Cannot be provided with project_slugs.
        project_slugs: The slugs of the projects to query. Cannot be provided with project_ids.
        If neither project_ids nor project_slugs are provided, all active projects will be queried.
        Start/end params take precedence over stats_period. Defaults to Sentry's standard max period.
    """
    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        logger.warning(
            "execute_replays_query: Organization not found", extra={"org_id": organization_id}
        )
        return None

    if not features.has("organizations:session-replay", organization):
        return ExecuteQueryErrorResponse(
            error="Session Replay is not enabled for this organization."
        )

    if project_ids and project_slugs:
        return ExecuteQueryErrorResponse(
            error="Pass either project_ids or project_slugs, not both."
        )

    project_filter: dict[str, Any] = {}
    if project_ids:
        project_filter["id__in"] = project_ids
    elif project_slugs:
        project_filter["slug__in"] = project_slugs

    resolved_project_ids = list(
        Project.objects.filter(
            organization_id=organization.id,
            status=ObjectStatus.ACTIVE,
            **project_filter,
        ).values_list("id", flat=True)
    )
    if not resolved_project_ids:
        return ExecuteQuerySuccessResponse(data=[])

    requested_fields = fields or DEFAULT_REPLAY_SEARCH_FIELDS
    invalid_fields = sorted(set(requested_fields) - set(REPLAY_VALID_FIELD_SET))
    if invalid_fields:
        return ExecuteQueryErrorResponse(
            error=f"Invalid replay field(s): {', '.join(invalid_fields)}"
        )

    date_params: dict[str, Any] = {}
    if start and end:
        date_params["start"] = start
        date_params["end"] = end
    elif stats_period:
        date_params["statsPeriod"] = stats_period

    try:
        start_dt, end_dt = get_date_range_from_params(date_params)
        search_filters = parse_search_query(query or "", config=replay_url_parser_config)
        response = query_replays_collection_paginated(
            project_ids=resolved_project_ids,
            start=start_dt,
            end=end_dt,
            environment=[],
            sort=sort,
            fields=requested_fields,
            limit=per_page + 1,
            offset=0,
            search_filters=search_filters,
            preferred_source="scalar",
            organization=organization,
            actor=None,
            referrer=Referrer.SEER_EXPLORER_TOOLS.value,
        )
        processed_response = process_raw_response(response.response, fields=requested_fields)
    except KeyError as e:
        logger.exception(
            "execute_replays_query: unsupported response field",
            extra={
                "org_id": organization_id,
                "query": query,
                "field": e.args[0] if e.args else None,
            },
        )
        return ExecuteQueryErrorResponse(
            error=f"Invalid replay field: {e.args[0]}" if e.args else "Invalid replay field"
        )
    except (InvalidParams, InvalidSearchQuery, SentryBadRequest, BadRequest, ParseError) as e:
        logger.exception(
            "execute_replays_query: bad request",
            extra={"org_id": organization_id, "query": query},
        )
        return ExecuteQueryErrorResponse(error=str(e))

    return ExecuteQuerySuccessResponse(
        data=processed_response,
        meta={"source": response.source, "has_more": response.has_more},
    )


def get_trace_waterfall(
    trace_id: str,
    organization_id: int,
    additional_attributes: list[str] | None = None,
    referrer: Referrer = Referrer.SEER_EXPLORER_TOOLS,
) -> EAPTrace | None:
    """
    Get the full span waterfall and connected errors for a trace.

    Args:
        trace_id: The ID of the trace to fetch. Can be shortened to the first 8 or 16 characters.
        organization_id: The ID of the trace's organization

    Returns:
        The spans and errors in the trace, along with the full 32-character trace ID.
    """
    if additional_attributes is None:
        additional_attributes = ["span.status_code"]

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
    events = query_trace_data(
        snuba_params,
        full_trace_id,
        additional_attributes=additional_attributes,
        referrer=referrer,
        organization=organization,
    )

    return EAPTrace(
        trace_id=full_trace_id,
        org_id=organization_id,
        trace=events,
    )


def rpc_get_trace_waterfall(
    trace_id: str,
    organization_id: int,
    additional_attributes: list[str] | None = None,
    referrer: str | None = None,
) -> EAPTrace | EmptyResponse:
    """Surface the underlying typed `EAPTrace` directly.

    The not-found path returns `EmptyResponse`, which serializes to `{}` via
    `.dict()` — byte-identical to the prior wire shape.
    """
    try:
        referrer_enum = Referrer(referrer) if referrer else Referrer.SEER_EXPLORER_TOOLS
    except ValueError:
        referrer_enum = Referrer.SEER_EXPLORER_TOOLS
    trace = get_trace_waterfall(trace_id, organization_id, additional_attributes, referrer_enum)
    return trace if trace else EmptyResponse()


def rpc_get_profile_flamegraph(
    profile_id: str,
    organization_id: int,
    trace_id: str | None = None,
    span_description: str | None = None,
) -> ProfileFlamegraphSuccessResponse | ProfileFlamegraphErrorResponse:
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
        return ProfileFlamegraphErrorResponse(error="Organization not found")

    # Get all projects for the organization
    projects = list(Project.objects.filter(organization=organization, status=ObjectStatus.ACTIVE))

    if not projects:
        logger.warning(
            "rpc_get_profile_flamegraph: No projects found for organization",
            extra={"organization_id": organization_id},
        )
        return ProfileFlamegraphErrorResponse(error="No projects found for organization")

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
            referrer=Referrer.SEER_EXPLORER_TOOLS,
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
                "window_start": window_start,
                "window_end": window_end,
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
                    "window_start": window_start,
                    "window_end": window_end,
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
        return ProfileFlamegraphErrorResponse(error="Profile not found in the last 90 days")
    if not project_id:
        logger.warning(
            "rpc_get_profile_flamegraph: Could not find project id for profile",
            extra={"profile_id": profile_id, "organization_id": organization_id},
        )
        return ProfileFlamegraphErrorResponse(error="Project not found")

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
        return ProfileFlamegraphErrorResponse(
            error="Failed to fetch profile data from profiling service"
        )

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
        return ProfileFlamegraphErrorResponse(
            error="Failed to generate execution tree from profile data"
        )

    return ProfileFlamegraphSuccessResponse(
        execution_tree=execution_tree,
        metadata=ProfileFlamegraphMetadata(
            profile_id=actual_profile_id,
            project_id=project_id,
            is_continuous=is_continuous,
            start_ts=min_start_ts,
            end_ts=max_end_ts,
            thread_id=selected_thread_id,
        ),
    )


def get_repository_definition(
    *,
    organization_id: int,
    repo_full_name: str,
    external_id: str | None = None,
) -> RepositoryDefinitionResponse | None:
    """
    Look up a repository that the org has access to.
    Returns full RepoDefinition if found and accessible via code mappings, None otherwise.

    Lookup priority:
    1. external_id (GitHub's repo ID - stable across renames)
    2. Current name (exact match)

    Args:
        organization_id: The ID of the organization
        repo_full_name: Full repository name in format "owner/repo-name" (e.g., "getsentry/seer")
        external_id: Optional external repository ID (e.g., GitHub repo ID). Stable across renames.
                     If provided, this is used for lookup instead of name.

    Returns:
        dict with RepoDefinition fields if found, None otherwise. Includes external_id
        which should be stored for future lookups.
    """
    try:
        organization = Organization.objects.get_from_cache(id=organization_id)
    except Organization.DoesNotExist:
        return None
    supported_providers = get_supported_scm_providers(organization)

    repo: Repository | None = None

    if external_id:
        repo = Repository.objects.filter(
            organization_id=organization_id,
            external_id=external_id,
            status=ObjectStatus.ACTIVE,
            provider__in=supported_providers,
        ).first()

    if not repo:
        parts = repo_full_name.split("/")
        if len(parts) < 2:
            logger.warning(
                "seer.rpc.invalid_repo_name_format",
                extra={"repo_full_name": repo_full_name},
            )
            return None

        repo = Repository.objects.filter(
            organization_id=organization_id,
            name=repo_full_name,
            status=ObjectStatus.ACTIVE,
            provider__in=supported_providers,
        ).first()

    if not repo:
        logger.info(
            "seer.rpc.repository_not_found",
            extra={
                "organization_id": organization_id,
                "repo_full_name": repo_full_name,
                "external_id": external_id,
            },
        )
        return None

    # Use the actual repo name from the database, not the requested name.
    # For GitLab, repo.name is the display name (name_with_namespace, may contain spaces);
    # get_repo_url_path() returns the URL-safe path_with_namespace instead.
    repo_name_parts = get_repo_url_path(repo).split("/")
    owner = repo_name_parts[0]
    name = "/".join(repo_name_parts[1:])

    return RepositoryDefinitionResponse(
        organization_id=organization_id,
        integration_id=str(repo.integration_id) if repo.integration_id is not None else None,
        provider=repo.provider,
        owner=owner,
        name=name,
        external_id=repo.external_id,
    )


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
    group: Group,
    organization: Organization,
    start: datetime | None = None,
    end: datetime | None = None,
) -> tuple[dict[str, Any], str, str] | None:
    """
    Get event counts over time for an issue (no group by) by calling the events-stats endpoint. Dynamically picks
    an interval based on the time range and EVENT_TIMESERIES_RESOLUTIONS.
    """
    start, end = get_group_date_range(group, organization, start, end)
    logger.info(
        "get_issue_and_event_details_v2: Querying event timeseries",
        extra={
            "organization_id": organization.id,
            "issue_id": group.id,
            "timedelta": end - start,
            "start": start,
            "end": end,
        },
    )

    # Round up to nearest supported period
    delta = end - start
    selected_period, selected_delta, interval = None, None, None
    for p, i in EVENT_TIMESERIES_RESOLUTIONS:
        d = parse_stats_period(p)
        if d and delta <= d:
            selected_period, selected_delta, interval = p, d, i
            break
    selected_period = selected_period or "90d"
    selected_delta = selected_delta or timedelta(days=90)
    interval = interval or "3d"

    # Adjust range to equal period
    end = start + selected_delta

    # Use the correct dataset based on issue category
    # Error issues are stored in the "events" dataset, while issue platform issues
    # (performance, etc.) are stored in "issuePlatform" (search_issues)
    dataset = "errors" if group.issue_category == GroupCategory.ERROR else "issuePlatform"

    data = execute_timeseries_query(
        org_id=organization.id,
        dataset=dataset,
        y_axes=["count()"],
        group_by=[],
        query=f"{ISSUE_ID_ALIAS}:{group.id}",
        start=start.isoformat(),
        end=end.isoformat(),
        interval=interval,
        project_ids=[group.project_id],
        partial=True,
    )

    if data is None or isinstance(data, ExecuteTimeseriesQueryErrorResponse):
        return None
    return data.dict(), selected_period, interval


def _get_recommended_event(
    group: Group,
    organization: Organization,
    start: datetime | None = None,
    end: datetime | None = None,
) -> GroupEvent | None:
    """
    Our own implementation of Group.get_recommended_event. Requires the return event to fall in the time range and have a non-empty trace.
    Time range defaults to the group's first and last seen times.
    If multiple events are valid, return the one with highest RECOMMENDED ordering.
    If no events are valid, return the highest recommended event.

    Also falls back to the regular recommended event in case of query failures or custom timeout.
    """
    start_time = time.time()

    # Config
    max_date_range = timedelta(days=14)  # Clamp date range as the query loop can be very expensive.
    timeout = 50  # Sentry API timeout is 60s - 10s buffer.
    event_query_limit = 50  # Events/trace IDs to query in each window.
    window_size = timedelta(days=3)

    start, end = get_group_date_range(group, organization, start, end)
    unclamped_start = start
    start = max(start, end - max_date_range)
    retention_boundary = get_retention_boundary(organization, bool(start.tzinfo))
    window_start = max(end - window_size, start)
    window_end = end
    # Fallback to first event we find (most recommended in most recent window).
    fallback_event: GroupEvent | None = None

    if group.issue_category == GroupCategory.ERROR:
        dataset = Dataset.Events
    else:
        dataset = Dataset.IssuePlatform

    def get_latest_event() -> GroupEvent | None:
        """If no events are found in the clamped range, use this query to return most recent event in the full range."""
        return group.get_latest_event(start=unclamped_start, end=end)

    logger.info(
        "_get_recommended_event: starting query loop",
        extra={
            "organization_id": organization.id,
            "project_id": group.project.id,
            "issue_id": group.id,
            "timedelta": end - start,
            "start": start,
            "end": end,
            "dataset": dataset.value,
        },
    )

    while window_start >= start:
        if time.time() - start_time > timeout:
            logger.warning(
                "_get_recommended_event: timeout reached",
                extra={
                    "organization_id": organization.id,
                    "project_id": group.project.id,
                    "issue_id": group.id,
                    "timedelta": end - start,
                    "start": start,
                    "end": end,
                    "dataset": dataset.value,
                    "timeout": timeout,
                },
            )
            return fallback_event or get_latest_event()

        # Get candidate events with the standard recommended ordering.
        # This is an expensive orderby, hence the inner limit and sliding window.
        try:
            events: list[Event] = eventstore.backend.get_events_snql(
                organization_id=organization.id,
                group_id=group.id,
                start=window_start,
                end=window_end,
                conditions=[
                    Condition(Column("project_id"), Op.IN, [group.project.id]),
                    Condition(Column("group_id"), Op.IN, [group.id]),
                ],
                limit=event_query_limit,
                orderby=EventOrdering.RECOMMENDED.value,
                referrer=Referrer.SEER_EXPLORER_TOOLS,
                dataset=dataset,
                tenant_ids={"organization_id": group.project.organization_id},
                inner_limit=1000,
            )
        except Exception:
            logger.exception(
                "_get_recommended_event: eventstore query failed",
                extra={
                    "organization_id": organization.id,
                    "project_id": group.project.id,
                    "issue_id": group.id,
                    "dataset": dataset.value,
                },
            )
            return fallback_event or get_latest_event()

        if events and not fallback_event:
            fallback_event = events[0].for_group(group)

        trace_ids = list({e.trace_id for e in events if e.trace_id})

        if len(trace_ids) > 0:
            # Query EAP to get the span count of each trace.
            # Extend the time range by +-1 day to account for min/max trace start/end times.
            # Clamp spans_start to retention boundary to avoid QueryOutsideRetentionError.
            spans_start = max(window_start - timedelta(days=1), retention_boundary)
            spans_end = window_end + timedelta(days=1)
            count_field = "count(span.duration)"

            try:
                result = execute_table_query(
                    org_id=organization.id,
                    dataset="spans",
                    per_page=len(trace_ids),
                    fields=["trace", count_field],
                    query=f"trace:[{','.join(trace_ids)}]",
                    start=spans_start.isoformat(),
                    end=spans_end.isoformat(),
                )
            except Exception:
                logger.exception(
                    "_get_recommended_event: spans query failed",
                    extra={
                        "organization_id": organization.id,
                        "project_id": group.project.id,
                        "issue_id": group.id,
                        "num_trace_ids": len(trace_ids),
                    },
                )
                return fallback_event or get_latest_event()

            if isinstance(result, ExecuteQuerySuccessResponse) and result.data:
                # Return the first event with a span count greater than 0.
                traces_with_spans = {
                    item["trace"]
                    for item in result.data
                    if item.get("trace") and item.get(count_field, 0) > 0
                }

                for e in events:
                    if e.trace_id in traces_with_spans:
                        return e.for_group(group)

        if window_start == start:
            break

        window_end = window_start
        window_start = max(window_start - window_size, start)

    logger.warning(
        "_get_recommended_event: no event with a span found",
        extra={
            "issue_id": group.id,
            "organization_id": organization.id,
            "project_id": group.project.id,
            "start": start,
            "end": end,
            "timedelta": end - start,
            "dataset": dataset.value,
            "has_fallback_event": bool(fallback_event),
        },
    )
    return fallback_event or get_latest_event()


# Activity types to include in issue details for Seer Agent (manual actions only)
_SEER_EXPLORER_ACTIVITY_TYPES = [
    ActivityType.NOTE.value,
    ActivityType.SET_RESOLVED.value,
    ActivityType.SET_RESOLVED_IN_RELEASE.value,
    ActivityType.SET_RESOLVED_IN_COMMIT.value,
    ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value,
    ActivityType.SET_UNRESOLVED.value,
    ActivityType.ASSIGNED.value,
]


class _EventTroubleshootingContext(TypedDict):
    # These fields are added to the serialized event, which uses camelCase keys.
    detectionContext: str | None
    troubleshootingHint: str | None


def _get_event_troubleshooting_context(
    event: Event | GroupEvent,
) -> _EventTroubleshootingContext:
    group = event.group
    if group is None:
        return {"detectionContext": None, "troubleshootingHint": None}

    if group.type == LowValueSpanConfigurationType.type_id:
        occurrence = getattr(event, "occurrence", None)
        evidence_data = occurrence.evidence_data if occurrence else {}
        span_origin = evidence_data.get("span_origin")

        troubleshooting_hint = (
            "If the span is manually instrumented, remove the instrumentation that creates "
            "it. Otherwise, filter the automatically created span before sending, typically "
            "in Sentry SDK initialization."
        )
        if span_origin == "manual":
            troubleshooting_hint = (
                "Remove the manually instrumented span code that creates this span."
            )
        elif span_origin:
            troubleshooting_hint = (
                "Filter this automatically created span before sending, typically in Sentry SDK "
                "initialization."
            )

        return {
            "detectionContext": (
                "This issue was created by a Sentry detector, not by an exception in the "
                "application. It reports a high-volume span with low telemetry value so the "
                "project can reduce noisy telemetry."
            ),
            "troubleshootingHint": troubleshooting_hint,
        }

    return {
        "detectionContext": None,
        "troubleshootingHint": None,
    }


def get_issue_and_event_response(
    event: Event | GroupEvent,
    group: Group | None,
    organization: Organization,
    start: datetime | None = None,
    end: datetime | None = None,
) -> IssueAndEventDetailsResponse:
    serialized_event = dict(serialize(event, user=None, serializer=EventSerializer()))
    serialized_event.update(_get_event_troubleshooting_context(event))

    event_fields: dict[str, Any] = {
        "event": serialized_event,
        "event_id": event.event_id,
        "event_trace_id": event.trace_id,
        "project_id": event.project_id,
        "project_slug": event.project.slug,
    }

    if group is None:
        return IssueAndEventDetailsResponse(**event_fields)

    # Get the issue metadata, tags overview, and event count timeseries.
    serialized_group = dict(serialize(group, user=None, serializer=GroupSerializer()))
    # Add issueTypeDescription as it provides better context for LLMs. Note the initial type should be BaseGroupSerializerResponse.
    serialized_group["issueTypeDescription"] = group.issue_type.description

    logger.info(
        "get_issue_and_event_details_v2: Querying for tags overview",
        extra={
            "organization_id": organization.id,
            "issue_id": group.id,
            "timedelta": (end - start) if start and end else None,
            "start": start,
            "end": end,
        },
    )

    try:
        tags_overview = get_all_tags_overview(group, start, end)
    except Exception:
        logger.exception(
            "Failed to get tags overview for issue",
            extra={
                "organization_id": organization.id,
                "issue_id": group.id,
                "start": start,
                "end": end,
            },
        )
        tags_overview = None

    try:
        ts_result = _get_issue_event_timeseries(
            group=group,
            organization=organization,
            start=start,
            end=end,
        )
    except Exception:
        logger.exception(
            "Failed to get issue event timeseries",
            extra={
                "organization_id": organization.id,
                "issue_id": group.id,
                "start": start,
                "end": end,
            },
        )
        ts_result = None

    if ts_result:
        timeseries, timeseries_stats_period, timeseries_interval = ts_result
    else:
        timeseries, timeseries_stats_period, timeseries_interval = None, None, None

    # Fetch user activity (comments, status changes, etc.)
    try:
        activities = Activity.objects.filter(
            group=group,
            type__in=_SEER_EXPLORER_ACTIVITY_TYPES,
        ).order_by("-datetime")[:50]
        serialized_activities = serialize(
            list(activities), user=None, serializer=ActivitySerializer()
        )
    except Exception:
        logger.exception(
            "Failed to get user activity for issue",
            extra={"organization_id": organization.id, "issue_id": group.id},
        )
        serialized_activities = []

    return IssueAndEventDetailsResponse(
        **event_fields,
        issue=serialized_group,
        event_timeseries=timeseries,
        timeseries_stats_period=timeseries_stats_period,
        timeseries_interval=timeseries_interval,
        tags_overview=tags_overview,
        user_activity=serialized_activities,
    )


def _resolve_seer_group(
    *,
    organization_id: int,
    issue_id: str,
    project_slug: str | None = None,
) -> Group:
    """
    Resolve an ``issue_id`` to a :class:`Group`, scoped to ``organization_id`` (and to
    ``project_slug`` when provided).

    ``issue_id`` may be a numeric primary key or a qualified short id (e.g. ``PROJECT-123``):

    - Numeric ids are looked up via ``get_from_cache``. The model cache only accepts a single
      kwarg, so the org/project boundary cannot live in the query and is enforced with an
      explicit post-fetch check instead. This also skips the ``project_ids`` query on the hot
      numeric path.
    - Short ids keep query-level project scoping via ``by_qualified_short_id`` to preserve the
      in-org IDOR guard documented on that method; ``project_ids`` is only computed here.

    Raises ``Group.DoesNotExist`` when no matching group is visible within the scope, so callers
    can keep their existing ``except Group.DoesNotExist`` handling.
    """
    if issue_id.isdigit():
        group = Group.objects.get_from_cache(id=int(issue_id))
        # ``group.project`` is the org/project boundary the numeric query used to enforce.
        # A hard-deleted project makes this FK access raise ``Project.DoesNotExist``; translate
        # it so callers' ``except Group.DoesNotExist`` handling still applies.
        try:
            project = group.project
        except Project.DoesNotExist:
            raise Group.DoesNotExist() from None
        if (
            project.organization_id != organization_id
            or project.status != ObjectStatus.ACTIVE
            or (project_slug is not None and project.slug != project_slug)
        ):
            raise Group.DoesNotExist()
        return group

    project_ids = list(
        Project.objects.filter(
            organization_id=organization_id,
            status=ObjectStatus.ACTIVE,
            **({"slug": project_slug} if project_slug else {}),
        ).values_list("id", flat=True)
    )
    if not project_ids:
        raise Group.DoesNotExist()
    return Group.objects.by_qualified_short_id(organization_id, issue_id, project_ids=project_ids)


def get_issue_details(
    *,
    organization_id: int,
    issue_id: str,
    start: str | None = None,
    end: str | None = None,
    project_slug: str | None = None,
) -> IssueDetailsResponse | None:
    """
    Get issue-level details for an issue, optionally scoped by time range.

    Args:
        organization_id: The ID of the organization.
        issue_id: The issue ID (numeric) or qualified short ID (e.g. PROJECT-123).
        start: ISO timestamp for the start of the time range (optional).
        end: ISO timestamp for the end of the time range (optional).
        project_slug: The slug of the project (optional, used to improve numeric ID lookups).

    Returns:
        Dict with issue metadata, event_timeseries, tags_overview, and user_activity, or None if not found.
    """
    # NOTE: start and end are interdependent. get_date_range_from_params raises InvalidParams
    # unless both or neither are set, so passing only one will fail despite the optional signature.
    start_dt, end_dt = get_date_range_from_params({"start": start, "end": end}, optional=True)

    organization = Organization.objects.get(id=organization_id)

    try:
        group = _resolve_seer_group(
            organization_id=organization_id, issue_id=issue_id, project_slug=project_slug
        )
    except Group.DoesNotExist:
        return None

    # Get the issue metadata.
    serialized_group = dict(serialize(group, user=None, serializer=GroupSerializer()))
    # Add issueTypeDescription as it provides better context for LLMs. Note the initial type should be BaseGroupSerializerResponse.
    serialized_group["issueTypeDescription"] = group.issue_type.description

    # Get aggregate tag and event data and activity.
    try:
        tags_overview = get_all_tags_overview(group, start_dt, end_dt)
    except Exception:
        logger.exception(
            "get_issue_details: Failed to get tags overview",
            extra={"organization_id": organization_id, "issue_id": issue_id},
        )
        tags_overview = None

    try:
        ts_result = _get_issue_event_timeseries(
            group=group,
            organization=organization,
            start=start_dt,
            end=end_dt,
        )
    except Exception:
        logger.exception(
            "get_issue_details: Failed to get event timeseries",
            extra={"organization_id": organization_id, "issue_id": issue_id},
        )
        ts_result = None

    if ts_result:
        timeseries, timeseries_stats_period, timeseries_interval = ts_result
    else:
        timeseries, timeseries_stats_period, timeseries_interval = None, None, None

    try:
        activities = Activity.objects.filter(
            group=group,
            type__in=_SEER_EXPLORER_ACTIVITY_TYPES,
        ).order_by("-datetime")[:50]
        serialized_activities = serialize(
            list(activities), user=None, serializer=ActivitySerializer()
        )
    except Exception:
        logger.exception(
            "get_issue_details: Failed to get user activity",
            extra={"organization_id": organization_id, "issue_id": issue_id},
        )
        serialized_activities = []

    return IssueDetailsResponse(
        issue=serialized_group,
        event_timeseries=timeseries,
        timeseries_stats_period=timeseries_stats_period,
        timeseries_interval=timeseries_interval,
        tags_overview=tags_overview,
        user_activity=serialized_activities,
        project_id=group.project_id,
        project_slug=group.project.slug,
    )


def get_issue_committers(
    *,
    organization_id: int,
    issue_id: str,
    start: str | None = None,
    end: str | None = None,
) -> IssueCommittersResponse | None:
    """
    Get the likely code authors for an issue from Sentry's ingested commit data.

    Combines three signals, all computed from ingested commits with NO SCM/GitHub call
    (so it works without SCM credentials):

    - ``stack_commits``: commit authors that touched the files in the issue's
      stacktrace, scored by frame relevance. This is the *input* to Sentry's
      suspect-commit feature (release-based blame of the failing frames) and is
      available far more often than a single precomputed suspect commit.
    - ``suspect_commits``: the precomputed suspect commit(s) from ``GroupOwner``, if
      any (the same "Suspect Commit" shown in the Sentry UI).
    - ``release_commits``: a broader pool of commits shipped around when the issue
      first appeared, NOT limited to the stacktrace frames (catches regressions in
      code that does not appear in the trace), each enriched with PR title/body,
      file-change count, and a merge-commit flag so the caller can prune.

    Default time windows differ by signal: ``release_commits`` covers ~6 weeks before
    the issue first appeared (to surface what shipped just before it regressed), while
    the sampled stacktrace event (for ``stack_commits``) is drawn from the issue's own
    lifetime (``first_seen``..``last_seen``), since the issue has no events before it
    first appeared. Pass ``start``/``end`` to override both.

    Args:
        organization_id: The ID of the organization.
        issue_id: The issue ID (numeric) or qualified short ID (e.g. PROJECT-123). The
            project is derived from the issue, so no project identifier is needed.
        start: ISO timestamp for the start of the time range (optional).
        end: ISO timestamp for the end of the time range (optional).

    Returns:
        An ``IssueCommittersResponse`` with ``stack_commits``, ``suspect_commits``,
        ``release_commits``, ``project_id``, ``project_slug``. The commit lists may be
        empty (e.g. no release/commit data linked to the issue) — callers can iterate
        them without ``None`` checks. Returns ``None`` if the project/issue cannot be
        resolved.
    """
    try:
        committers = _IssueCommitters(
            organization_id=organization_id,
            issue_id=issue_id,
            start=start,
            end=end,
        )
    except Group.DoesNotExist:
        return None
    return committers.get()


class _IssueCommitters:
    """Computes the likely code authors for an issue from ingested commit data.

    Backs :func:`get_issue_committers`. The shared inputs (resolved group,
    organization, time window) are computed once in ``__init__`` and reused by the
    per-signal helpers. Each signal is computed independently and its failures are
    isolated, so a problem in one signal doesn't blank out the others.
    """

    def __init__(
        self,
        *,
        organization_id: int,
        issue_id: str,
        start: str | None = None,
        end: str | None = None,
    ) -> None:
        self.organization_id = organization_id
        self.issue_id = issue_id
        self.start_dt: datetime | None
        self.end_dt: datetime | None
        self.start_dt, self.end_dt = get_date_range_from_params(
            {"start": start, "end": end}, optional=True
        )
        self.organization = Organization.objects.get(id=organization_id)
        # Lets ``Group.DoesNotExist`` propagate so ``get_issue_committers`` can map it to
        # ``None`` (the shared "issue not found" signal for the seer issue methods).
        self.group = _resolve_seer_group(organization_id=organization_id, issue_id=issue_id)

    def get(self) -> IssueCommittersResponse:
        return IssueCommittersResponse(
            stack_commits=self._get_stack_commits(),
            suspect_commits=self._get_suspect_commits(),
            release_commits=self._get_release_commits(),
            project_id=self.group.project_id,
            project_slug=self.group.project.slug,
        )

    @property
    def _log_extra(self) -> dict[str, Any]:
        return {"organization_id": self.organization_id, "issue_id": self.issue_id}

    def _get_suspect_commits(self) -> list[dict[str, Any]]:
        """Precomputed author+commit (one or none) from the suspect-commit feature."""
        try:
            suspect_commits = get_serialized_committers(self.group.project, self.group.id)
        except Exception:
            metrics.incr("seer.get_issue_committers.error", tags={"step": "suspect_commits"})
            logger.exception(
                "get_issue_committers: Failed to get suspect commits",
                extra=self._log_extra,
            )
            return []
        return [dict(committer) for committer in suspect_commits]

    def _get_stack_commits(self) -> list[dict[str, Any]]:
        """Frame-based blame: authors of the files in the stacktrace.

        This is the input to the suspect-commit feature and is available far more often.
        """
        try:
            event = _get_recommended_event(
                self.group, self.organization, self.start_dt, self.end_dt
            )
            if event is None:
                # Frame blame only needs a stacktrace, not a span/trace.
                # _get_recommended_event requires a span-bearing event and returns None
                # for issues without spans (the common case for error issues), which
                # would silently drop frame blame. Fall back to the latest event so the
                # failing frames are still available. Frame paths are stable across an
                # issue's events, so this is a safe source for blame. Thread the window
                # through so a caller-supplied start/end is still honored (no-op when empty).
                event = self.group.get_latest_event(start=self.start_dt, end=self.end_dt)
            if event is None:
                return []
            sdk_name = (event.data.get("sdk") or {}).get("name")
            author_commits = get_event_file_committers(
                self.group.project,
                self.group.id,
                get_frame_paths(event),
                event.platform,
                sdk_name=sdk_name,
            )
            # get_event_file_committers serializes the author but leaves commits as
            # (Commit, score) tuples ordered weakest-first; serialize the commits and
            # reverse so the strongest blame is first.
            # Batch-serialize every commit in one call: CommitSerializer.get_attrs runs
            # repository and pull request queries per invocation, so serializing one
            # commit at a time would be an N+1.
            commits_by_id = {
                commit.id: commit
                for entry in author_commits
                for commit, _ in entry.get("commits", [])
            }
            serialized_by_id = {
                commit_id: serialized
                for commit_id, serialized in zip(
                    commits_by_id,
                    serialize(
                        list(commits_by_id.values()),
                        serializer=CommitSerializer(exclude=["author"]),
                    ),
                )
            }
            stack_commits = [
                {
                    "author": entry.get("author"),
                    "commits": [
                        {**serialized_by_id[commit.id], "score": score}
                        for commit, score in entry.get("commits", [])
                    ],
                }
                for entry in author_commits
            ]
            stack_commits.reverse()
            return stack_commits
        except (Release.DoesNotExist, Commit.DoesNotExist):
            # No release/commit data linked to this issue; frame blame isn't available.
            return []
        except Exception:
            metrics.incr("seer.get_issue_committers.error", tags={"step": "stack_commits"})
            logger.exception(
                "get_issue_committers: Failed to compute stack commits",
                extra=self._log_extra,
            )
            return []

    def _get_release_commits(self) -> list[dict[str, Any]]:
        """Broader candidate pool: commits shipped around when the issue first appeared.

        NOT limited to the stacktrace frames. Window defaults to ~6 weeks before
        first_seen; an explicit start/end overrides it.
        """
        release_commits: list[dict[str, Any]] = []
        try:
            window_end = self.end_dt or self.group.first_seen
            window_start = self.start_dt or (window_end - timedelta(weeks=6))
            candidates = get_release_commit_candidates(
                self.group.project, self.group.id, since=window_start, until=window_end
            )
            if candidates:
                file_change_counts = dict(
                    CommitFileChange.objects.filter(commit_id__in=[c.id for c in candidates])
                    .values_list("commit_id")
                    .annotate(n=models.Count("id"))
                )
                serialized_candidates = serialize(
                    candidates, serializer=CommitSerializer(exclude=["repository"])
                )
                for commit, serialized in zip(candidates, serialized_candidates):
                    message = (commit.message or "").strip()
                    release_commits.append(
                        {
                            **serialized,
                            "files_changed_count": file_change_counts.get(commit.id),
                            "is_merge_commit": message.startswith("Merge "),
                        }
                    )
        except Exception:
            metrics.incr("seer.get_issue_committers.error", tags={"step": "release_commits"})
            logger.exception(
                "get_issue_committers: Failed to fetch release commits",
                extra=self._log_extra,
            )
            return []
        return release_commits


def get_issue_ownership(
    *,
    organization_id: int,
    issue_id: str,
) -> IssueOwnershipResponse | None:
    """
    Get the configured code owners for an issue from Sentry's Ownership Rules / CODEOWNERS.

    This answers "who is RESPONSIBLE for this area of code", which is independent of who
    authored any commit (``get_issue_committers``). It matches the files in the issue's
    stacktrace against the project's ownership schema and returns the resolved owners.

    Use it when commit signals are weak or absent (e.g. infra/transient errors that still
    fall inside an owned area), or to corroborate a commit-based suggestion. The
    ``auto_assignment`` flag tells you whether Sentry already auto-assigns from these
    rules: when it is False, the owners are configured but nothing acts on them, which is
    exactly the gap a suggested assignee fills.

    Args:
        organization_id: The ID of the organization.
        issue_id: The issue ID (numeric) or qualified short ID (e.g. PROJECT-123). The
            project is derived from the issue, so no project identifier is needed.

    Returns:
        An ``IssueOwnershipResponse`` with ``owners`` (ordered users/teams), ``matched_rules``
        (the rule patterns that matched), ``auto_assignment``, ``project_id``, and
        ``project_slug``. ``owners`` may be empty when no rule covers the failing files.
        Returns ``None`` if the project/issue cannot be resolved.
    """
    try:
        ownership = _IssueOwnership(
            organization_id=organization_id,
            issue_id=issue_id,
        )
    except Group.DoesNotExist:
        return None
    return ownership.get()


# ``ProjectOwnership.get_issue_owners`` defaults to 2 (suggested-assignee sizing); the
# ownership tool wants the full set of responsible owners, so we cap higher.
_OWNERSHIP_RULE_LIMIT = 25


class _IssueOwnership:
    """Resolves the configured code owners for an issue.

    Backs :func:`get_issue_ownership`. Mirrors :class:`_IssueCommitters`: the shared
    inputs (resolved group, organization) are computed once in ``__init__`` and reused by
    the per-signal helpers, and each signal isolates its own failures so one failing
    lookup doesn't blank out the others.
    """

    def __init__(
        self,
        *,
        organization_id: int,
        issue_id: str,
    ) -> None:
        self.organization_id = organization_id
        self.issue_id = issue_id
        self.organization = Organization.objects.get(id=organization_id)
        # Lets ``Group.DoesNotExist`` propagate so ``get_issue_ownership`` can map it to
        # ``None`` (the shared "issue not found" signal for the seer issue methods).
        self.group = _resolve_seer_group(organization_id=organization_id, issue_id=issue_id)

    def get(self) -> IssueOwnershipResponse:
        owners, matched_rules = self._resolve_owners()
        return IssueOwnershipResponse(
            owners=owners,
            matched_rules=matched_rules,
            auto_assignment=self._auto_assignment_enabled(),
            project_id=self.group.project_id,
            project_slug=self.group.project.slug,
        )

    @property
    def _log_extra(self) -> dict[str, Any]:
        return {"organization_id": self.organization_id, "issue_id": self.issue_id}

    def _resolve_owners(self) -> tuple[list[IssueOwner], list[str]]:
        """Match the issue's stacktrace files against the project ownership schema.

        Delegates to ``ProjectOwnership.get_issue_owners`` — the same resolution Sentry
        runs in post-processing to populate ``GroupOwner`` — so owners come back already
        resolved to teams/users (control-silo user lookups included) and grouped under the
        rule that matched. ``get_issue_owners`` caps its result at ``limit`` rules that
        resolved to at least one owner (default 2, tuned for suggested assignees); we raise
        it so the agent gets a fuller picture of who's responsible.
        """
        try:
            event = self.group.get_latest_event()
            if event is None:
                return [], []
            issue_owners = ProjectOwnership.get_issue_owners(
                self.group.project_id, event.data, limit=_OWNERSHIP_RULE_LIMIT
            )
        except Exception:
            metrics.incr("seer.get_issue_ownership.error", tags={"step": "get_owners"})
            logger.exception(
                "get_issue_ownership: Failed to resolve owners",
                extra=self._log_extra,
            )
            return [], []

        owners: list[IssueOwner] = []
        seen: set[tuple[str, int]] = set()  # the same owner can match multiple rules
        matched_rules: set[str] = set()
        for rule, rule_owners, _rule_type in issue_owners:
            if rule.matcher:
                matched_rules.add(str(rule.matcher.pattern))
            for owner in rule_owners:
                if isinstance(owner, Team):
                    if ("team", owner.id) in seen:
                        continue
                    seen.add(("team", owner.id))
                    owners.append(IssueOwner(type="team", slug=owner.slug, name=owner.name))
                else:  # RpcUser
                    if ("user", owner.id) in seen:
                        continue
                    seen.add(("user", owner.id))
                    owners.append(
                        IssueOwner(type="user", email=owner.email, name=owner.get_display_name())
                    )

        return owners, sorted(matched_rules)

    def _auto_assignment_enabled(self) -> bool:
        """Whether Sentry already auto-assigns issues from these ownership rules."""
        try:
            ownership = ProjectOwnership.get_ownership_cached(self.group.project_id)
        except Exception:
            metrics.incr("seer.get_issue_ownership.error", tags={"step": "auto_assignment"})
            logger.exception(
                "get_issue_ownership: Failed to read auto-assignment flag",
                extra=self._log_extra,
            )
            return False
        return bool(ownership and ownership.auto_assignment)


def get_team_members(
    *,
    organization_id: int,
    team_slug: str,
) -> TeamMembersResponse | None:
    """
    Get the active users on a team.

    Pairs with ``get_issue_ownership``: that tool may resolve an issue's owner to a
    *team*, which on its own isn't an actionable assignee. Call this with the team's slug
    to expand it into the individual users on it, so the agent can get down to a specific
    person to suggest.

    Args:
        organization_id: The ID of the organization.
        team_slug: The slug of the team (e.g. the ``slug`` of a ``team`` owner returned by
            ``get_issue_ownership``).

    Returns:
        A ``TeamMembersResponse`` with ``team_id``/``team_slug``/``team_name`` and
        ``members`` (each an ``IssueOwner`` with ``type="user"``, ``email``, ``name``).
        ``members`` is empty when the team has no active members. Returns ``None`` if the
        team cannot be found in the organization.
    """
    try:
        team = Team.objects.get(
            organization_id=organization_id,
            slug=team_slug,
            status=TeamStatus.ACTIVE,
        )
    except Team.DoesNotExist:
        return None

    # ``User`` lives in the control silo, so resolve the team's member ids (a region
    # query) through the user service to get emails/display names from the region the RPC
    # runs in.
    user_ids = list(team.get_member_user_ids())
    members = (
        [
            IssueOwner(type="user", email=user.email, name=user.get_display_name())
            for user in user_service.get_many(filter={"user_ids": user_ids})
        ]
        if user_ids
        else []
    )
    return TeamMembersResponse(
        team_id=team.id,
        team_slug=team.slug,
        team_name=team.name,
        members=members,
    )


def get_event_details(
    *,
    organization_id: int,
    event_id: str | None = None,
    issue_id: str | None = None,
    start: str | None = None,
    end: str | None = None,
    project_slug: str | None = None,
) -> EventDetailsResponse | None:
    """
    Get event details by event ID, or get the recommended event for an issue, optionally scoped by time range.
    Exactly one of event_id or issue_id must be provided.

    Args:
        organization_id: The ID of the organization.
        event_id: The UUID of the event (mutually exclusive with issue_id).
        issue_id: The issue ID (numeric) or qualified short ID (mutually exclusive with event_id).
        start: ISO timestamp for the start of the time range to get recommended event for (optional).
        end: ISO timestamp for the end of the time range to get recommended event for (optional).
        project_slug: The slug of the project (optional).

    Returns:
        Dict with serialized event, event_id, event_trace_id, project_id, project_slug, or None if not found.
    """
    if bool(event_id) == bool(issue_id):
        raise BadRequest("Either event_id or issue_id must be provided, but not both.")

    organization = Organization.objects.get(id=organization_id)

    event: Event | GroupEvent | None
    group: Group | None

    if event_id is None:
        start_dt, end_dt = get_date_range_from_params({"start": start, "end": end}, optional=True)

        # Fetch the group then get a sample event from the time range.
        assert issue_id is not None
        try:
            group = _resolve_seer_group(
                organization_id=organization_id, issue_id=issue_id, project_slug=project_slug
            )
        except Group.DoesNotExist:
            return None
        event = _get_recommended_event(group, organization, start_dt, end_dt)

    else:
        # The project boundary is only needed for the by-event-id lookup below.
        project_ids = list(
            Project.objects.filter(
                organization=organization,
                status=ObjectStatus.ACTIVE,
                **({"slug": project_slug} if project_slug else {}),
            ).values_list("id", flat=True)
        )
        if not project_ids:
            return None

        # Fetch the event directly by ID.
        uuid.UUID(event_id)  # Raises ValueError if not valid UUID
        if len(project_ids) == 1:
            event = eventstore.backend.get_event_by_id(
                project_id=project_ids[0],
                event_id=event_id,
                tenant_ids={"organization_id": organization_id},
            )
        else:
            # Error events live in Events, occurrence events in IssuePlatform;
            # we don't know which dataset holds this event_id until we query.
            event = None
            for dataset in (Dataset.Events, Dataset.IssuePlatform):
                events_result = eventstore.backend.get_events(
                    filter=eventstore.Filter(
                        event_ids=[event_id],
                        organization_id=organization_id,
                        project_ids=project_ids,
                    ),
                    eap_conditions=build_event_id_in_filter([event_id]),
                    limit=1,
                    tenant_ids={"organization_id": organization_id},
                    dataset=dataset,
                )
                if events_result:
                    event = events_result[0]
                    break

        group = event.group if event else None

    # Convert Event to GroupEvent so the occurrence (if any) can be lazy-loaded
    # from nodestore via the occurrence_id in snuba_data during serialization.
    if event is not None and group is not None and isinstance(event, Event):
        event = event.for_group(group)

    if event is None:
        logger.warning(
            "get_event_details: Event not found",
            extra={
                "organization_id": organization_id,
                "project_slug": project_slug,
                "issue_id": issue_id,
                "event_id": event_id,
                "start": start,
                "end": end,
            },
        )
        return None

    serialized_event = dict(serialize(event, user=None, serializer=EventSerializer()))
    serialized_event.update(_get_event_troubleshooting_context(event))

    return EventDetailsResponse(
        event=serialized_event,
        event_id=event.event_id,
        event_trace_id=event.trace_id,
        project_id=event.project_id,
        project_slug=event.project.slug,
    )


def get_issue_and_event_details_v2(
    *,
    organization_id: int,
    issue_id: str | None = None,
    start: str | None = None,
    end: str | None = None,
    event_id: str | None = None,
    project_slug: str | None = None,
    include_issue: bool = True,
) -> IssueAndEventDetailsResponse | None:
    if bool(issue_id) == bool(event_id):
        raise BadRequest("Either issue_id or event_id must be provided, but not both.")

    start_dt, end_dt = get_date_range_from_params({"start": start, "end": end}, optional=True)

    organization = Organization.objects.get(id=organization_id)

    event: Event | GroupEvent | None
    group: Group | None

    if event_id is None:
        # Fetch the group then get a sample event from the time range.
        assert issue_id is not None
        try:
            group = _resolve_seer_group(
                organization_id=organization_id, issue_id=issue_id, project_slug=project_slug
            )
        except Group.DoesNotExist:
            return None
        event = _get_recommended_event(group, organization, start_dt, end_dt)

    else:
        # The project boundary is only needed for the by-event-id lookup below.
        project_ids = list(
            Project.objects.filter(
                organization=organization,
                status=ObjectStatus.ACTIVE,
                **({"slug": project_slug} if project_slug else {}),
            ).values_list("id", flat=True)
        )
        if not project_ids:
            return None

        # Fetch the event then look up its group.
        uuid.UUID(event_id)  # Raises ValueError if not valid UUID
        if len(project_ids) == 1:
            event = eventstore.backend.get_event_by_id(
                project_id=project_ids[0],
                event_id=event_id,
                tenant_ids={"organization_id": organization_id},
            )
        else:
            # Error events live in Events, occurrence events in IssuePlatform;
            # we don't know which dataset holds this event_id until we query.
            event = None
            for dataset in (Dataset.Events, Dataset.IssuePlatform):
                events_result = eventstore.backend.get_events(
                    filter=eventstore.Filter(
                        event_ids=[event_id],
                        organization_id=organization_id,
                        project_ids=project_ids,
                    ),
                    eap_conditions=build_event_id_in_filter([event_id]),
                    limit=1,
                    tenant_ids={"organization_id": organization_id},
                    dataset=dataset,
                )
                if events_result:
                    event = events_result[0]
                    break

        group = event.group if event else None

    # Convert Event to GroupEvent so the occurrence (if any) can be lazy-loaded
    # from nodestore via the occurrence_id in snuba_data during serialization.
    if event is not None and group is not None and isinstance(event, Event):
        event = event.for_group(group)

    if group is None:
        logger.warning(
            "get_issue_and_event_details_v2: Missing group",
            extra={
                "organization_id": organization_id,
                "project_slug": project_slug,
                "issue_id": issue_id,
                "event_id": event_id,
            },
        )
        return None

    if event is None:
        logger.warning(
            "get_issue_and_event_details_v2: Missing event",
            extra={
                "organization_id": organization_id,
                "project_slug": project_slug,
                "issue_id": issue_id,
                "event_id": event_id,
                "start": start,
                "end": end,
            },
        )
        return None

    if include_issue:
        return get_issue_and_event_response(event, group, organization, start_dt, end_dt)

    return get_issue_and_event_response(event, None, organization, start_dt, end_dt)


def get_replay_metadata(
    *,
    replay_id: str,
    organization_id: int,
    project_slug: str | None = None,
) -> ReplayMetadataResponse | None:
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
    return ReplayMetadataResponse(__root__=result)


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
    meta = resolver.resolve_meta(referrer=Referrer.SEER_EXPLORER_TOOLS, sampling_mode=sampling_mode)
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
) -> TraceItemEventsResponse | None:
    """
    Get all attributes for all logs in a trace. You can optionally filter by message substring and/or project slugs.

    Returns:
        A list of dictionaries for each log, with the keys:
        - id: The trace item ID.
        - timestamp: ISO 8601 timestamp.
        - attributes: A dict[str, dict[str, Any]] where the keys are the attribute names. See _make_get_trace_request for more details.
    """

    start_dt, end_dt = get_date_range_from_params(
        {"start": start, "end": end, "statsPeriod": stats_period},
        default_stats_period=MAX_STATS_PERIOD,
    )

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
        start=start_dt,
        end=end_dt,
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
        return TraceItemEventsResponse(data=items)

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

    return TraceItemEventsResponse(data=filtered_items)


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
) -> TraceItemEventsResponse | None:
    """
    Get all attributes for all metrics in a trace. You can optionally filter by metric name and/or project slugs.
    The metric name is a case-insensitive exact match.

    Returns:
        A list of dictionaries for each metric event, with the keys:
        - id: The trace item ID.
        - timestamp: ISO 8601 timestamp.
        - attributes: A dict[str, dict[str, Any]] where the keys are the attribute names. See _make_get_trace_request for more details.
    """

    start_dt, end_dt = get_date_range_from_params(
        {"start": start, "end": end, "statsPeriod": stats_period},
        default_stats_period=MAX_STATS_PERIOD,
    )

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
        start=start_dt,
        end=end_dt,
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
        return TraceItemEventsResponse(data=items)

    # Filter on metric name (exact case-insensitive match).
    filtered_items: list[dict[str, Any]] = []
    for item in items:
        if limit is not None and len(filtered_items) >= limit:
            break

        item_metric_name: str = item["attributes"].get("metric.name", {}).get("value", "")
        if metric_name.lower() == item_metric_name.lower():
            filtered_items.append(item)

    return TraceItemEventsResponse(data=filtered_items)


def get_baseline_tag_distribution(
    *,
    organization_id: int,
    project_id: int,
    group_id: int,
    tag_keys: list[str],
    stats_period: str | None = None,
    start: str | None = None,
    end: str | None = None,
) -> BaselineTagDistributionResponse:
    """
    Get baseline tag distribution for suspect attributes analysis.

    Returns tag value counts for all events/occurrences except those in the specified issue,
    filtered to only include the specified tag keys. Queries both error events and
    issue platform occurrences (performance issues, etc.) to build a comprehensive baseline.

    Args:
        organization_id: The organization ID
        project_id: The project ID
        group_id: The issue group ID to exclude from baseline
        tag_keys: List of tag keys to fetch (from the issue's tags_overview)
        stats_period: Stats period for the time range (optional and mutually exclusive with start and end)
        start: ISO timestamp for start of time range (optional)
        end: ISO timestamp for end of time range (optional)

        If no date params are provided, we use the issue's first_seen to last_seen range.

    Returns:
        Dict with "baseline_tag_distribution" containing list of
        {"tag_key": str, "tag_value": str, "count": int} entries.
    """

    group = Group.objects.get(id=group_id, project_id=project_id)
    organization = group.organization
    if organization.id != organization_id:
        raise BadRequest("Group does not belong to the specified organization")

    start_dt, end_dt = get_date_range_from_params(
        {"start": start, "end": end, "statsPeriod": stats_period},
        optional=True,
    )

    if not tag_keys:
        return BaselineTagDistributionResponse(baseline_tag_distribution=[])

    # Use first/last seen if date params are not provided.
    start_dt, end_dt = get_group_date_range(group, organization, start_dt, end_dt)

    # Query both error events and issue platform occurrences for a comprehensive baseline.
    # "events" contains error issues, "search_issues" contains performance and other issue types.
    combined_counts: dict[tuple[str, str], int] = {}

    for dataset in ["events", "search_issues"]:
        query = Query(
            match=Entity(dataset),
            select=[
                Function(
                    "arrayJoin",
                    parameters=[
                        Function(
                            "arrayZip",
                            parameters=[
                                Column("tags.key"),
                                Column("tags.value"),
                            ],
                        ),
                    ],
                    alias="variants",
                ),
                Function("count", parameters=[], alias="count"),
            ],
            where=[
                Condition(Column("project_id"), Op.EQ, project_id),
                Condition(Column("timestamp"), Op.GTE, start_dt),
                Condition(Column("timestamp"), Op.LT, end_dt),
                # Exclude the current issue from baseline
                Condition(Column("group_id"), Op.NEQ, group_id),
                # Only include specified tag keys
                Condition(
                    Function(
                        "has",
                        parameters=[
                            tag_keys,
                            Function("tupleElement", parameters=[Column("variants"), 1]),
                        ],
                    ),
                    Op.EQ,
                    1,
                ),
            ],
            groupby=[Column("variants")],
            limit=Limit(5000),
        )

        snuba_request = Request(
            dataset=dataset,
            app_id="seer-explorer",
            query=query,
            tenant_ids={"organization_id": organization_id},
        )
        response = raw_snql_query(
            snuba_request,
            referrer="seer.explorer.get_baseline_tag_distribution",
            use_cache=True,
        )

        for result in response.get("data", []):
            key = (result["variants"][0], result["variants"][1])
            combined_counts[key] = combined_counts.get(key, 0) + result["count"]

    baseline_distribution = [
        BaselineTagDistributionEntry(tag_key=tag_key, tag_value=tag_value, count=count)
        for (tag_key, tag_value), count in combined_counts.items()
    ]

    return BaselineTagDistributionResponse(baseline_tag_distribution=baseline_distribution)


def get_dsn(
    *,
    organization_id: int,
    project_slug: str,
) -> GetDsnResponse | None:
    """
    Get the public DSN for a single project in an organization.

    Returns the project's public DSN, or None if the organization/project does
    not exist or the project has no active client key.
    """
    try:
        organization = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        logger.warning("Organization not found", extra={"organization_id": organization_id})
        return None

    project = Project.objects.filter(
        organization=organization,
        status=ObjectStatus.ACTIVE,
        slug=project_slug,
    ).first()
    if project is None:
        return None

    # Mirror the filters applied by OrganizationProjectKeysEndpoint for non-superuser
    # callers: user-visible keys only (exclude internal use cases like PROFILING,
    # TEMPEST, DEMO), with the store role, active. Newest first to match the
    # endpoint's `-id` ordering.
    key = (
        ProjectKey.objects.filter(
            project=project,
            status=ProjectKeyStatus.ACTIVE,
            use_case=UseCase.USER.value,
            roles=models.F("roles").bitor(ProjectKey.roles.store),
        )
        .order_by("-id")
        .first()
    )
    if key is None:
        return None

    return GetDsnResponse(
        project_slug=project.slug,
        platform=project.platform,
        dsn_public=key.dsn_public,
    )
