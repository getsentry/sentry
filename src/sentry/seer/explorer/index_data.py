import logging
from datetime import UTC, datetime, timedelta
from typing import Any

import orjson

from sentry import search
from sentry.api.event_search import SearchFilter, parse_search_query
from sentry.api.issue_search import convert_query_values
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.event import EventSerializer
from sentry.eventstore import backend as eventstore
from sentry.eventstore.models import Event, GroupEvent
from sentry.models.project import Project
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
    profile_id: str, organization_id: int, project_id: int
) -> dict[str, Any] | None:
    """
    Fetch raw profile data from the profiling service.

    Args:
        profile_id: The profile ID to fetch
        organization_id: Organization ID
        project_id: Project ID

    Returns:
        Raw profile data or None if not found
    """
    response = get_from_profiling_service(
        "GET",
        f"/organizations/{organization_id}/projects/{project_id}/profiles/{profile_id}",
        params={"format": "sample"},
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

    # Step 1: Find spans in the trace that have profile data
    profiles_result = Spans.run_table_query(
        params=snuba_params,
        query_string=f"trace:{trace_id} has:profile.id project.id:{project_id}",
        selected_columns=[
            "span_id",
            "profile.id",
            "transaction",
            "span.op",
            "is_transaction",
            "precise.start_ts",
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

    for row in profiles_result.get("data", []):
        span_id = row.get("span_id")
        profile_id = row.get("profile.id")
        transaction_name = row.get("transaction")

        if not span_id or not profile_id or span_id in seen_spans:
            continue

        seen_spans.add(span_id)
        unique_profiles.append(
            {
                "span_id": span_id,
                "profile_id": profile_id,
                "transaction_name": transaction_name,
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

        # Fetch raw profile data
        raw_profile = _fetch_profile_data(
            profile_id=profile_id,
            organization_id=project.organization_id,
            project_id=project_id,
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
    parsed_terms = parse_search_query(f'transaction:"{transaction_name}"')
    converted_terms = convert_query_values(parsed_terms, [project], None, [])
    search_filters = [term for term in converted_terms if isinstance(term, SearchFilter)]

    results_cursor = search.backend.query(
        projects=[project],
        date_from=start_time,
        date_to=end_time,
        search_filters=search_filters,
        sort_by="freq",
        limit=3,
        environments=[],
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
                issue_id=group.id,
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
