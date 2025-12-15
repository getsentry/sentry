import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime, timedelta
from typing import Any

from django.contrib.auth.models import AnonymousUser

from sentry import search
from sentry.api.event_search import SearchFilter
from sentry.api.helpers.group_index.index import parse_and_convert_issue_search_query
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.event import EventSerializer
from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.seer.explorer.utils import (
    convert_profile_to_execution_tree,
    fetch_profile_data,
    normalize_description,
)
from sentry.seer.sentry_data_models import (
    IssueDetails,
    ProfileData,
    Span,
    TraceData,
    TraceProfiles,
    Transaction,
    TransactionIssues,
)
from sentry.services.eventstore import backend as eventstore
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans

logger = logging.getLogger(__name__)

# Regex to match unescaped quotes (not preceded by backslash)
UNESCAPED_QUOTE_RE = re.compile('(?<!\\\\)"')


def get_transactions_for_project(
    project_id: int, limit: int = 500, start_time_delta: dict[str, int] | None = None
) -> list[Transaction]:
    """
    Get a list of transactions for a project using EAP, sorted by total time spent.

    Args:
        project_id: The ID of the project to fetch transactions for

    Returns:
        List of transactions with name and project id
    """
    if start_time_delta is None:
        start_time_delta = {"hours": 24}

    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        logger.exception(
            "Project does not exist; cannot fetch transactions", extra={"project_id": project_id}
        )
        return []

    end_time = datetime.now(UTC)
    start_time = end_time - timedelta(**start_time_delta)

    snuba_params = SnubaParams(
        start=start_time,
        end=end_time,
        projects=[project],
        organization=project.organization,
    )
    config = SearchResolverConfig(
        auto_fields=True,
    )

    # Query EAP for most important transactions (highest total time spent)
    result = Spans.run_table_query(
        params=snuba_params,
        query_string="is_transaction:true",
        selected_columns=[
            "transaction",
            "sum(span.duration)",
        ],
        orderby=["-sum(span.duration)"],
        offset=0,
        limit=limit,
        referrer=Referrer.SEER_EXPLORER_INDEX,
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

    # Step 1: Get a random trace ID for the transaction
    escaped_transaction_name = UNESCAPED_QUOTE_RE.sub('\\"', transaction_name)
    traces_result = Spans.run_table_query(
        params=snuba_params,
        query_string=f'transaction:"{escaped_transaction_name}" project.id:{project_id}',
        selected_columns=[
            "trace",
            "precise.start_ts",
        ],
        orderby=["precise.start_ts"],
        offset=0,
        limit=1,
        referrer=Referrer.SEER_EXPLORER_INDEX,
        config=config,
        sampling_mode="NORMAL",
    )

    trace_id = None
    for row in traces_result.get("data", []):
        trace_id = row.get("trace")
        if trace_id:
            break

    if not trace_id:
        logger.info(
            "No traces found for transaction",
            extra={"transaction_name": transaction_name, "project_id": project_id},
        )
        return None

    # Step 2: Get all spans in the chosen trace
    spans_result = Spans.run_table_query(
        params=snuba_params,
        query_string=f"trace:{trace_id}",
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
        referrer=Referrer.SEER_EXPLORER_INDEX,
        config=config,
        sampling_mode="NORMAL",
    )

    # Step 3: Build span objects
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
                    span_description=span_description or "",
                )
            )

    return TraceData(
        trace_id=trace_id,
        project_id=project_id,
        transaction_name=transaction_name,
        total_spans=len(spans),
        spans=spans,
    )


def _fetch_and_process_profile(
    profile_info: dict[str, Any],
    organization_id: int,
    project_id: int,
    trace_id: str,
) -> ProfileData | None:
    """
    Fetch and process a single profile. This function is designed to be called
    concurrently from multiple threads.

    Args:
        profile_info: Dictionary containing profile metadata (profile_id, is_continuous, start_ts, end_ts)
        organization_id: Organization ID
        project_id: Project ID
        trace_id: Trace ID for logging

    Returns:
        ProfileData if successful, None otherwise
    """
    profile_id = profile_info["profile_id"]
    transaction_name = profile_info["transaction_name"]
    is_continuous = profile_info["is_continuous"]
    start_ts = profile_info["start_ts"]
    end_ts = profile_info["end_ts"]

    # Fetch raw profile data
    raw_profile = fetch_profile_data(
        profile_id=profile_id,
        organization_id=organization_id,
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
        return None

    # Convert to execution tree
    execution_tree = convert_profile_to_execution_tree(raw_profile)

    if execution_tree:
        return ProfileData(
            profile_id=profile_id,
            transaction_name=transaction_name,
            execution_tree=execution_tree,
            project_id=project_id,
            start_ts=start_ts,
            end_ts=end_ts,
            is_continuous=is_continuous,
        )
    else:
        logger.warning(
            "Failed to convert profile to execution tree",
            extra={
                "profile_id": profile_id,
                "trace_id": trace_id,
                "project_id": project_id,
            },
        )
        return None


def get_profiles_for_trace(trace_id: str, project_id: int) -> TraceProfiles | None:
    """
    Get profiles for a given trace, supporting both transaction and continuous profiles.

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

    # Use aggregation query to get unique profile IDs and trace time range
    # Query for both transaction profiles (profile.id) and continuous profiles (profiler.id)
    profiles_result = Spans.run_table_query(
        params=snuba_params,
        query_string=f"trace:{trace_id} project.id:{project_id} (has:profile.id OR has:profiler.id)",
        selected_columns=[
            "profile.id",
            "profiler.id",
            "min(precise.start_ts)",
            "max(precise.finish_ts)",
        ],
        orderby=[],
        offset=0,
        limit=5,
        referrer=Referrer.SEER_EXPLORER_INDEX,
        config=config,
        sampling_mode="NORMAL",
    )

    profile_data = []

    for row in profiles_result.get("data", []):
        profile_id = row.get("profile.id")  # Transaction profiles
        profiler_id = row.get("profiler.id")  # Continuous profiles
        start_ts = row.get("min(precise.start_ts)")
        end_ts = row.get("max(precise.finish_ts)")

        actual_profile_id = profiler_id or profile_id
        if not actual_profile_id:
            continue

        is_continuous = profiler_id is not None

        profile_data.append(
            {
                "profile_id": actual_profile_id,
                "is_continuous": is_continuous,
                "start_ts": start_ts,
                "end_ts": end_ts,
            }
        )

    if not profile_data:
        logger.info(
            "No profiles found for trace",
            extra={"trace_id": trace_id, "project_id": project_id},
        )
        return None

    logger.info(
        "Found unique profiles for trace",
        extra={
            "trace_id": trace_id,
            "profile_count": len(profile_data),
        },
    )

    # Fetch and process profiles in parallel
    processed_profiles = []
    profiles_to_fetch = [
        {
            "profile_id": p["profile_id"],
            "transaction_name": None,
            "is_continuous": p["is_continuous"],
            "start_ts": p["start_ts"],
            "end_ts": p["end_ts"],
        }
        for p in profile_data
    ]

    with ThreadPoolExecutor(max_workers=min(len(profiles_to_fetch), 5)) as executor:
        future_to_profile = {
            executor.submit(
                _fetch_and_process_profile,
                profile_info,
                project.organization_id,
                project_id,
                trace_id,
            ): profile_info
            for profile_info in profiles_to_fetch
        }

        for future in as_completed(future_to_profile):
            result = future.result()
            if result:
                processed_profiles.append(result)

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
    escaped_transaction_name = UNESCAPED_QUOTE_RE.sub('\\"', transaction_name)
    query = f'is:unresolved transaction:"{escaped_transaction_name}"'
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
        referrer=Referrer.SEER_EXPLORER_INDEX,
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
