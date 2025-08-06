import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import orjson
from django.contrib.auth.models import AnonymousUser

from sentry import search
from sentry.api.event_search import SearchFilter
from sentry.api.helpers.group_index.index import parse_and_convert_issue_search_query
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.event import EventSerializer
from sentry.eventstore import backend as eventstore
from sentry.eventstore.models import Event, GroupEvent
from sentry.models.project import Project
from sentry.profiles.profile_chunks import get_chunk_ids
from sentry.profiles.utils import get_from_profiling_service
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.seer.explorer.utils import convert_profile_to_execution_tree, normalize_description
from sentry.seer.sentry_data_models import (
    IssueDetails,
    ProfileData,
    Span,
    TraceData,
    TraceProfiles,
    Transaction,
    TransactionIssues,
)
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans

logger = logging.getLogger(__name__)


def get_transactions_for_project(project_id: int) -> list[Transaction]:
    """
    Get a list of transactions for a project using EAP, sorted by volume/traffic.

    Args:
        project_id: The ID of the project to fetch transactions for

    Returns:
        List of transactions with name and project id
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        logger.exception(
            "Project does not exist; cannot fetch transactions", extra={"project_id": project_id}
        )
        return []

    end_time = datetime.now(UTC)
    start_time = end_time - timedelta(hours=24)

    snuba_params = SnubaParams(
        start=start_time,
        end=end_time,
        projects=[project],
        organization=project.organization,
    )
    config = SearchResolverConfig(
        auto_fields=True,
    )

    # Query EAP for transactions with volume metrics
    result = Spans.run_table_query(
        params=snuba_params,
        query_string=f"is_transaction:true project.id:{project_id}",
        selected_columns=[
            "transaction",
            "count()",
        ],
        orderby=["-count()"],  # Sort by count descending (highest volume first)
        offset=0,
        limit=500,
        referrer=Referrer.SEER_RPC,
        config=config,
        sampling_mode="NORMAL",
    )

    # Extract transaction data from the result
    transactions = []
    seen_names = set()
    for row in result.get("data", []):
        name = row.get("transaction")
        if not name:
            continue

        normalized_name = normalize_description(name)
        if normalized_name in seen_names:
            continue
        seen_names.add(normalized_name)
        transactions.append(
            Transaction(
                name=name,  # Use original name, not normalized
                project_id=project_id,
            )
        )

    return transactions


def get_trace_for_transaction(transaction_name: str, project_id: int) -> TraceData | None:
    """
    Get a sample trace for a given transaction, choosing the one with median span count.

    Args:
        transaction_name: The name of the transaction to find traces for
        project_id: The ID of the project

    Returns:
        TraceData with all spans and relationships, or None if no traces found
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        logger.exception(
            "Project does not exist; cannot fetch traces",
            extra={"project_id": project_id, "transaction_name": transaction_name},
        )
        return None

    end_time = datetime.now(UTC)
    start_time = end_time - timedelta(hours=24)

    snuba_params = SnubaParams(
        start=start_time,
        end=end_time,
        projects=[project],
        organization=project.organization,
    )
    config = SearchResolverConfig(
        auto_fields=True,
    )

    # Step 1: Get trace IDs with their span counts in a single query
    traces_result = Spans.run_table_query(
        params=snuba_params,
        query_string=f"transaction:{transaction_name} project.id:{project_id}",
        selected_columns=[
            "trace",
            "count()",  # This counts all spans in each trace
        ],
        orderby=["-count()"],
        offset=0,
        limit=20,  # Get more candidates to choose from
        referrer=Referrer.SEER_RPC,
        config=config,
        sampling_mode="NORMAL",
    )

    trace_span_counts = []
    for row in traces_result.get("data", []):
        trace_id = row.get("trace")
        span_count = row.get("count()", 0)
        if trace_id and span_count > 0:
            trace_span_counts.append((trace_id, span_count))

    if not trace_span_counts:
        logger.info(
            "No traces found for transaction",
            extra={"transaction_name": transaction_name, "project_id": project_id},
        )
        return None

    # Choose trace with median span count
    trace_span_counts.sort(key=lambda x: x[1])  # Sort by span count
    median_index = len(trace_span_counts) // 2
    chosen_trace_id, total_spans = trace_span_counts[median_index]

    # Step 2: Get all spans in the chosen trace
    spans_result = Spans.run_table_query(
        params=snuba_params,
        query_string=f"trace:{chosen_trace_id}",
        selected_columns=[
            "span_id",
            "parent_span",
            "span.op",
            "span.description",
            "precise.start_ts",
        ],
        orderby=["precise.start_ts"],
        offset=0,
        limit=1000,
        referrer=Referrer.SEER_RPC,
        config=config,
        sampling_mode="NORMAL",
    )

    # Step 4: Build span objects
    spans = []
    for row in spans_result.get("data", []):
        span_id = row.get("span_id")
        parent_span_id = row.get("parent_span")
        span_op = row.get("span.op")
        span_description = row.get("span.description")

        if span_id:
            spans.append(
                Span(
                    span_id=span_id,
                    parent_span_id=parent_span_id,
                    span_op=span_op,
                    span_description=normalize_description(span_description or ""),
                )
            )

    return TraceData(
        trace_id=chosen_trace_id,
        project_id=project_id,
        transaction_name=transaction_name,
        total_spans=len(spans),
        spans=spans,
    )


def _fetch_profile_data(
    profile_id: str,
    organization_id: int,
    project_id: int,
    start_ts: float | None = None,
    end_ts: float | None = None,
    is_continuous: bool = False,
) -> dict[str, Any] | None:
    """
    Fetch raw profile data from the profiling service.

    Args:
        profile_id: The profile ID to fetch (profile_id for transaction profiles, profiler_id for continuous)
        organization_id: Organization ID
        project_id: Project ID
        start_ts: Start timestamp from span
        end_ts: End timestamp from span
        is_continuous: Whether this is a continuous profile (uses /chunk endpoint)

    Returns:
        Raw profile data or None if not found
    """
    if is_continuous:
        if start_ts is None or end_ts is None:
            logger.info(
                "Start and end timestamps not provided for fetching continuous profiles, skipping",
                extra={
                    "profile_id": profile_id,
                    "is_continuous": is_continuous,
                    "start_ts": start_ts,
                    "end_ts": end_ts,
                },
            )
            return None

        span_start = datetime.fromtimestamp(start_ts, UTC)
        span_end = datetime.fromtimestamp(end_ts, UTC)
        try:
            project = Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            logger.warning("Project not found for chunk_ids", extra={"project_id": project_id})
            return None
        span_snuba_params = SnubaParams(
            start=span_start,
            end=span_end,
            projects=[project],
            organization=project.organization,
        )

        chunk_ids = get_chunk_ids(span_snuba_params, profile_id, project_id)

        response = get_from_profiling_service(
            method="POST",
            path=f"/organizations/{organization_id}/projects/{project_id}/chunks",
            json_data={
                "profiler_id": profile_id,
                "chunk_ids": chunk_ids,
                "start": str(int(start_ts * 1e9)),
                "end": str(int(end_ts * 1e9)),
            },
        )
    else:
        # For transaction profiles (profile_id), use the profile endpoint
        response = get_from_profiling_service(
            "GET",
            f"/organizations/{organization_id}/projects/{project_id}/profiles/{profile_id}",
            params={"format": "sample"},
        )

    logger.info(
        "Got response from profiling service",
        extra={
            "profile_id": profile_id,
            "is_continuous": is_continuous,
            "response.status": response.status,
            "response.msg": response.msg,
        },
    )
    if response.status == 200:
        return orjson.loads(response.data)
    return None


def get_profiles_for_trace(trace_id: str, project_id: int) -> TraceProfiles | None:
    """
    Get profiles for a given trace, with one profile per unique span/transaction.

    Args:
        trace_id: The trace ID to find profiles for
        project_id: The ID of the project

    Returns:
        TraceProfiles with processed execution trees, or None if no profiles found
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        logger.exception(
            "Project does not exist; cannot fetch profiles",
            extra={"project_id": project_id, "trace_id": trace_id},
        )
        return None

    end_time = datetime.now(UTC)
    start_time = end_time - timedelta(hours=24)

    snuba_params = SnubaParams(
        start=start_time,
        end=end_time,
        projects=[project],
        organization=project.organization,
    )
    config = SearchResolverConfig(
        auto_fields=True,
    )

    # Step 1: Find spans in the trace that have profile data - using same constraint as flamegraph
    profiling_constraint = "(has:profile.id) or (has:profiler.id has:thread.id)"
    profiles_result = Spans.run_table_query(
        params=snuba_params,
        query_string=f"trace:{trace_id} project.id:{project_id} {profiling_constraint}",
        selected_columns=[
            "span_id",
            "profile.id",
            "profiler.id",
            "thread.id",
            "transaction",
            "span.op",
            "is_transaction",
            "precise.start_ts",
            "precise.finish_ts",
        ],
        orderby=["precise.start_ts"],
        offset=0,
        limit=50,
        referrer=Referrer.SEER_RPC,
        config=config,
        sampling_mode="NORMAL",
    )

    # Step 2: Deduplicate by span_id (one profile per span/transaction)
    seen_spans = set()
    unique_profiles = []

    logger.info(
        "Span query for profiles completed",
        extra={
            "num_rows": len(profiles_result.get("data", [])),
        },
    )

    for row in profiles_result.get("data", []):
        span_id = row.get("span_id")
        profile_id = row.get("profile.id")  # Transaction profiles
        profiler_id = row.get("profiler.id")  # Continuous profiles
        transaction_name = row.get("transaction")
        start_ts = row.get("precise.start_ts")
        end_ts = row.get("precise.finish_ts")

        logger.info(
            "Iterating over span to get profiles",
            extra={
                "span_id": span_id,
                "profile_id": profile_id,
                "profiler_id": profiler_id,
                "transaction_name": transaction_name,
            },
        )

        if not span_id or span_id in seen_spans:
            logger.info(
                "Span already seen or doesn't have an id, skipping",
                extra={"span_id": span_id},
            )
            continue

        # Use profile.id first (transaction profiles), fallback to profiler.id (continuous profiles)
        actual_profile_id = profile_id or profiler_id
        if not actual_profile_id:
            logger.info(
                "Span doesn't have a profile or profiler id, skipping",
                extra={"span_id": span_id},
            )
            continue

        # Determine if this is a continuous profile (profiler.id without profile.id)
        is_continuous = profile_id is None and profiler_id is not None

        logger.info(
            "Span is continuous and has profile",
            extra={
                "span_id": span_id,
                "is_continuous": is_continuous,
                "actual_profile_id": actual_profile_id,
            },
        )

        seen_spans.add(span_id)
        unique_profiles.append(
            {
                "span_id": span_id,
                "profile_id": actual_profile_id,
                "transaction_name": transaction_name,
                "is_continuous": is_continuous,
                "start_ts": start_ts,
                "end_ts": end_ts,
            }
        )

    if not unique_profiles:
        logger.info(
            "No profiles found for trace",
            extra={"trace_id": trace_id, "project_id": project_id},
        )
        return None

    # Step 3: Fetch and process each profile
    processed_profiles = []

    for profile_info in unique_profiles:
        profile_id = profile_info["profile_id"]
        span_id = profile_info["span_id"]
        transaction_name = profile_info["transaction_name"]
        is_continuous = profile_info["is_continuous"]
        start_ts = profile_info["start_ts"]
        end_ts = profile_info["end_ts"]

        # Fetch raw profile data
        raw_profile = _fetch_profile_data(
            profile_id=profile_id,
            organization_id=project.organization_id,
            project_id=project_id,
            start_ts=start_ts,
            end_ts=end_ts,
            is_continuous=is_continuous,
        )

        if not raw_profile:
            logger.warning(
                "Failed to fetch profile data",
                extra={
                    "profile_id": profile_id,
                    "trace_id": trace_id,
                    "project_id": project_id,
                },
            )
            continue

        # Convert to execution tree
        execution_tree = convert_profile_to_execution_tree(raw_profile)

        if execution_tree:
            processed_profiles.append(
                ProfileData(
                    profile_id=profile_id,
                    span_id=span_id,
                    transaction_name=transaction_name,
                    execution_tree=execution_tree,
                    project_id=project_id,
                )
            )
        else:
            logger.warning(
                "Failed to convert profile to execution tree",
                extra={
                    "profile_id": profile_id,
                    "trace_id": trace_id,
                    "project_id": project_id,
                    "raw_profile": raw_profile,
                },
            )

    if not processed_profiles:
        logger.info(
            "No processable profiles found for trace",
            extra={"trace_id": trace_id, "project_id": project_id},
        )
        return None

    return TraceProfiles(
        trace_id=trace_id,
        project_id=project_id,
        profiles=processed_profiles,
    )


def get_issues_for_transaction(transaction_name: str, project_id: int) -> TransactionIssues | None:
    """
    Get the top 3 issues for a transaction in the last 24 hours, sorted by event count.

    Args:
        transaction_name: The name of the transaction to find issues for
        project_id: The ID of the project

    Returns:
        TransactionIssues with issue data and recommended events, or None if no issues found
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        logger.exception(
            "Project does not exist; cannot fetch issues",
            extra={"project_id": project_id, "transaction_name": transaction_name},
        )
        return None

    end_time = datetime.now(UTC)
    start_time = end_time - timedelta(hours=24)

    # Step 1: Search for issues using transaction filter
    query = f'is:unresolved transaction:"{transaction_name}"'
    search_filters = parse_and_convert_issue_search_query(
        query, project.organization, [project], [], AnonymousUser()
    )
    search_filters_only = [f for f in search_filters if isinstance(f, SearchFilter)]

    results_cursor = search.backend.query(
        projects=[project],
        date_from=start_time,
        date_to=end_time,
        search_filters=search_filters_only,
        sort_by="freq",
        limit=3,
        referrer=Referrer.SEER_RPC,
    )
    issues = list(results_cursor)

    if not issues:
        logger.info(
            "No issues found for transaction",
            extra={"transaction_name": transaction_name, "project_id": project_id},
        )
        return None

    # Step 2: For each issue, get the recommended event and serialize it
    issue_data_list = []
    for group in issues:
        recommended_event = group.get_recommended_event(start=start_time, end=end_time)
        if not recommended_event:
            recommended_event = group.get_latest_event(start=start_time, end=end_time)

        if not recommended_event:
            logger.warning(
                "No event found for issue",
                extra={"group_id": group.id, "transaction_name": transaction_name},
            )
            continue

        full_event: Event | GroupEvent | None = eventstore.get_event_by_id(
            project_id=group.project_id,
            event_id=recommended_event.event_id,
            group_id=group.id,
        )

        if not full_event:
            logger.warning(
                "No event found for issue",
                extra={"group_id": group.id, "transaction_name": transaction_name},
            )
            continue

        serialized_event = serialize(full_event, user=None, serializer=EventSerializer())

        issue_data_list.append(
            IssueDetails(
                id=group.id,
                title=group.title,
                culprit=group.culprit,
                transaction=full_event.transaction,
                events=[serialized_event],
            )
        )

    if not issue_data_list:
        logger.info(
            "No valid issues with events found for transaction",
            extra={"transaction_name": transaction_name, "project_id": project_id},
        )
        return None

    return TransactionIssues(
        transaction_name=transaction_name,
        project_id=project_id,
        issues=issue_data_list,
    )


# RPC wrappers


def rpc_get_transactions_for_project(project_id: int) -> dict[str, Any]:
    transactions = get_transactions_for_project(project_id)
    transaction_dicts = [transaction.dict() for transaction in transactions]
    return {"transactions": transaction_dicts}


def rpc_get_trace_for_transaction(transaction_name: str, project_id: int) -> dict[str, Any]:
    trace = get_trace_for_transaction(transaction_name, project_id)
    return trace.dict() if trace else {}


def rpc_get_profiles_for_trace(trace_id: str, project_id: int) -> dict[str, Any]:
    profiles = get_profiles_for_trace(trace_id, project_id)
    return profiles.dict() if profiles else {}


def rpc_get_issues_for_transaction(transaction_name: str, project_id: int) -> dict[str, Any]:
    issues = get_issues_for_transaction(transaction_name, project_id)
    return issues.dict() if issues else {}
