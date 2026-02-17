"""
Celery Tasks for Explorer Service Map

This module contains periodic tasks that analyze distributed traces to extract
service dependency graphs and send them to Seer for hierarchical retrieval.
The service map helps Explorer understand which services call which others.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import orjson
import requests
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone as django_timezone

from sentry import options
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks

logger = logging.getLogger("sentry.tasks.explorer_service_map")

# Seer endpoint path
SEER_SERVICE_MAP_PATH = "/v1/explorer/service-map/update"

# Rate limiting cache key
RATE_LIMIT_KEY_PREFIX = "explorer_service_map_last_run"


def _get_rate_limit_key(org_id: int) -> str:
    """Generate cache key for rate limiting."""
    return f"{RATE_LIMIT_KEY_PREFIX}:{org_id}"


def _is_rate_limited(org_id: int, force: bool = False) -> bool:
    """
    Check if service map build is rate limited for this organization.

    Args:
        org_id: Organization ID
        force: If True, bypass rate limiting

    Returns:
        True if rate limited, False otherwise
    """
    if force:
        return False

    rate_limit_seconds = options.get("explorer.service_map.rate_limit_seconds")
    cache_key = _get_rate_limit_key(org_id)
    last_run = cache.get(cache_key)

    if last_run is None:
        return False

    elapsed = (django_timezone.now() - last_run).total_seconds()
    return elapsed < rate_limit_seconds


def _set_rate_limit(org_id: int) -> None:
    """Mark organization as having run service map build."""
    rate_limit_seconds = options.get("explorer.service_map.rate_limit_seconds")
    cache_key = _get_rate_limit_key(org_id)
    cache.set(cache_key, django_timezone.now(), timeout=rate_limit_seconds)


def _query_top_transactions(org_id: int, limit: int = 100) -> list[str]:
    """
    Query top transactions across the organization.

    Args:
        org_id: Organization ID
        limit: Maximum number of transactions to return

    Returns:
        List of transaction names
    """
    try:
        organization = Organization.objects.get(id=org_id)
        projects = list(Project.objects.filter(organization_id=org_id))

        if not projects:
            logger.info("No projects found for organization", extra={"org_id": org_id})
            return []

        end = datetime.now(timezone.utc)
        start = end - timedelta(hours=24)

        snuba_params = SnubaParams(
            start=start,
            end=end,
            projects=projects,
            organization=organization,
        )

        # Query for top transactions by total duration (segment spans only)
        result = Spans.run_table_query(
            params=snuba_params,
            query_string="is_transaction:true",  # Only segment spans
            selected_columns=["transaction", "sum(span.duration)"],
            orderby=["-sum(span.duration)"],
            offset=0,
            limit=limit,
            referrer=Referrer.SEER_EXPLORER_SERVICE_MAP.value,
            config=SearchResolverConfig(),
        )

        transactions = [
            row.get("transaction")
            for row in result.get("data", [])
            if row.get("transaction") and row.get("transaction") != ""
        ]

        logger.info(
            "Queried top transactions",
            extra={"org_id": org_id, "transaction_count": len(transactions)},
        )

        return transactions

    except Organization.DoesNotExist:
        logger.error("Organization not found", extra={"org_id": org_id})
        return []
    except Exception:
        logger.exception("Failed to query top transactions", extra={"org_id": org_id})
        return []


def _query_service_dependencies(org_id: int, transactions: list[str]) -> list[dict]:
    """
    Query segment spans and their parent spans to find cross-project dependencies.

    Args:
        org_id: Organization ID
        transactions: List of transaction names to filter on

    Returns:
        List of edges: [{"source_project_id": int, "source_project_slug": str,
                        "target_project_id": int, "target_project_slug": str, "count": int}]
    """
    if not transactions:
        return []

    max_edges = options.get("explorer.service_map.max_edges")

    try:
        organization = Organization.objects.get(id=org_id)
        projects = list(Project.objects.filter(organization_id=org_id))

        if not projects:
            logger.info("No projects found for organization", extra={"org_id": org_id})
            return []

        end = datetime.now(timezone.utc)
        start = end - timedelta(hours=24)

        snuba_params = SnubaParams(
            start=start,
            end=end,
            projects=projects,
            organization=organization,
        )

        # Query 1: Get one segment span per transaction
        # Use a while loop to ensure all transactions are covered
        seen_transactions = set()
        all_segments = []
        remaining_transactions = set(transactions)
        max_iterations = 10  # Safety limit
        iteration = 0

        while remaining_transactions and iteration < max_iterations:
            iteration += 1

            # Build query string for unseen transactions only
            transaction_filters = " OR ".join(
                [f'transaction:"{t}"' for t in list(remaining_transactions)[:100]]
            )  # Limit to 100 transactions per query to avoid query size issues
            query_string = f"is_transaction:true ({transaction_filters})"

            logger.info(
                "Querying segment spans",
                extra={
                    "org_id": org_id,
                    "iteration": iteration,
                    "remaining_count": len(remaining_transactions),
                },
            )

            try:
                segment_result = Spans.run_table_query(
                    params=snuba_params,
                    query_string=query_string,
                    selected_columns=[
                        "id",
                        "parent_span",
                        "project.id",
                        "project.slug",
                        "transaction",
                    ],
                    orderby=["-timestamp"],  # Get most recent
                    offset=0,
                    limit=500,  # Reasonable batch size
                    referrer=Referrer.SEER_EXPLORER_SERVICE_MAP.value,
                    config=SearchResolverConfig(),
                )

                # Process results and track which transactions we've seen
                new_segments_found = False
                for row in segment_result.get("data", []):
                    transaction_name = row.get("transaction")
                    if transaction_name and transaction_name not in seen_transactions:
                        seen_transactions.add(transaction_name)
                        remaining_transactions.discard(transaction_name)
                        all_segments.append(row)
                        new_segments_found = True

                # If no new segments found, break to avoid infinite loop
                if not new_segments_found:
                    logger.warning(
                        "No new segments found, stopping iteration",
                        extra={
                            "org_id": org_id,
                            "iteration": iteration,
                            "remaining_count": len(remaining_transactions),
                        },
                    )
                    break

            except Exception:
                logger.exception(
                    "Failed to query segment spans",
                    extra={"org_id": org_id, "iteration": iteration},
                )
                break

        if not all_segments:
            logger.info("No segment spans found", extra={"org_id": org_id})
            return []

        # Collect parent span IDs and build mapping
        parent_span_ids = []
        segments_by_parent: dict[str, list[dict]] = defaultdict(list)

        for row in all_segments:
            parent_span_id = row.get("parent_span")
            child_project_id = row.get("project.id")
            child_project_slug = row.get("project.slug")

            if parent_span_id and child_project_id:
                parent_span_ids.append(parent_span_id)
                segments_by_parent[parent_span_id].append(
                    {
                        "child_project_id": child_project_id,
                        "child_project_slug": child_project_slug,
                    }
                )

        if not parent_span_ids:
            logger.info("No segment spans with parents found", extra={"org_id": org_id})
            return []

        # Remove duplicates while preserving order
        unique_parent_span_ids = list(dict.fromkeys(parent_span_ids))

        logger.info(
            "Found segment spans with parents",
            extra={
                "org_id": org_id,
                "unique_parents": len(unique_parent_span_ids),
                "total_segments": len(parent_span_ids),
                "transactions_represented": len(all_segments),
            },
        )

        # Query 2: Resolve parent spans to get their project_ids
        # Batch the parent span IDs to avoid query size limits
        batch_size = 500
        edges_by_pair: dict[tuple[int, int], int] = defaultdict(int)

        for i in range(0, len(unique_parent_span_ids), batch_size):
            batch = unique_parent_span_ids[i : i + batch_size]

            # Build query string for span IDs
            span_id_filters = " OR ".join([f'id:"{span_id}"' for span_id in batch])

            parent_result = Spans.run_table_query(
                params=snuba_params,
                query_string=span_id_filters,
                selected_columns=["id", "project.id", "project.slug"],
                orderby=None,
                offset=0,
                limit=len(batch),
                referrer=Referrer.SEER_EXPLORER_SERVICE_MAP.value,
                config=SearchResolverConfig(),
            )

            # Match parents with children to build edges
            for parent_row in parent_result.get("data", []):
                parent_span_id = parent_row.get("id")
                parent_project_id = parent_row.get("project.id")
                parent_project_slug = parent_row.get("project.slug")

                if not parent_span_id or not parent_project_id:
                    continue

                # Find all child segments with this parent
                for segment in segments_by_parent.get(parent_span_id, []):
                    child_project_id = segment["child_project_id"]
                    child_project_slug = segment.get("child_project_slug")

                    if child_project_id and parent_project_id != child_project_id:
                        # Cross-project edge found
                        edge_key = (
                            parent_project_id,
                            parent_project_slug,
                            child_project_id,
                            child_project_slug,
                        )
                        edges_by_pair[edge_key] += 1

        # Convert to list format
        edges = [
            {
                "source_project_id": source_id,
                "source_project_slug": source_slug,
                "target_project_id": target_id,
                "target_project_slug": target_slug,
                "count": count,
            }
            for (source_id, source_slug, target_id, target_slug), count in edges_by_pair.items()
        ]

        # Sort by count and apply limit
        edges.sort(key=lambda x: x["count"], reverse=True)
        edges = edges[:max_edges]

        logger.info(
            "Extracted service dependencies",
            extra={"org_id": org_id, "edge_count": len(edges)},
        )

        return edges

    except Organization.DoesNotExist:
        logger.error("Organization not found", extra={"org_id": org_id})
        return []
    except Exception:
        logger.exception("Failed to query service dependencies", extra={"org_id": org_id})
        return []


def _classify_service_roles(edges: list[dict]) -> dict[int, str]:
    """
    Classify services based on their connectivity patterns.

    Args:
        edges: List of dependency edges

    Returns:
        Dictionary mapping project_id to role: "core_backend", "frontend", or "isolated"
    """
    if not edges:
        return {}

    # Count incoming and outgoing edges for each project
    in_degrees: dict[int, int] = defaultdict(int)
    out_degrees: dict[int, int] = defaultdict(int)
    all_nodes: set[int] = set()

    for edge in edges:
        source = edge["source_project_id"]
        target = edge["target_project_id"]
        out_degrees[source] += 1
        in_degrees[target] += 1
        all_nodes.add(source)
        all_nodes.add(target)

    if not all_nodes:
        return {}

    # Compute average degrees for thresholds
    avg_in = sum(in_degrees.values()) / len(all_nodes)
    avg_out = sum(out_degrees.values()) / len(all_nodes)

    # Classify each node
    roles = {}
    for node in all_nodes:
        in_degree = in_degrees.get(node, 0)
        out_degree = out_degrees.get(node, 0)

        # High connectivity in both directions = core backend
        if in_degree >= avg_in and out_degree >= avg_out:
            roles[node] = "core_backend"
        # High out-degree, low in-degree = frontend/client
        elif out_degree >= avg_out and in_degree < avg_in:
            roles[node] = "frontend"
        # Low connectivity = isolated service
        else:
            roles[node] = "isolated"

    logger.info(
        "Classified service roles",
        extra={
            "total_services": len(roles),
            "core_backend": sum(1 for r in roles.values() if r == "core_backend"),
            "frontend": sum(1 for r in roles.values() if r == "frontend"),
            "isolated": sum(1 for r in roles.values() if r == "isolated"),
        },
    )

    return roles


def _send_to_seer(org_id: int, edges: list[dict], roles: dict[int, str]) -> None:
    """
    Send service map data to Seer.

    Args:
        org_id: Organization ID
        edges: List of dependency edges
        roles: Dictionary mapping project_id to role
    """
    # Convert role keys to strings for orjson compatibility
    roles_str = {str(k): v for k, v in roles.items()}

    payload = {
        "organization_id": org_id,
        "edges": edges,
        "roles": roles_str,
        "generated_at": django_timezone.now().isoformat(),
    }

    body = orjson.dumps(payload)

    logger.info(
        "Sending service map to Seer",
        extra={
            "org_id": org_id,
            "edge_count": len(edges),
            "service_count": len(roles),
            "payload_size_bytes": len(body),
        },
    )

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}{SEER_SERVICE_MAP_PATH}",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
        timeout=30,
    )
    response.raise_for_status()

    result = response.json()
    logger.info(
        "Successfully sent service map to Seer",
        extra={"org_id": org_id, "seer_response": result},
    )


@instrumented_task(
    name="sentry.tasks.explorer_service_map.build_service_map",
    namespace=seer_tasks,
    processing_deadline_duration=10 * 60,  # 10 minutes
)
def build_service_map(organization_id: int, force: bool = False, *args, **kwargs) -> None:
    """
    Build service map for a single organization and send to Seer.

    This task:
    1. Checks feature flags and rate limits
    2. Queries Snuba for service dependencies
    3. Classifies service roles using graph analysis
    4. Sends data to Seer

    Args:
        organization_id: Organization ID to build map for
        force: If True, bypass rate limiting
    """
    logger.info(
        "Starting service map build",
        extra={"org_id": organization_id, "force": force},
    )

    # Check feature flags
    if not options.get("explorer.service_map.enable"):
        logger.info("explorer.service_map.enable flag is disabled")
        return

    if options.get("explorer.service_map.killswitch"):
        logger.info("explorer.service_map.killswitch enabled")
        return

    # Check rate limiting
    if _is_rate_limited(organization_id, force=force):
        logger.info("Service map build is rate limited", extra={"org_id": organization_id})
        return

    try:
        # Query top transactions
        transactions = _query_top_transactions(organization_id)

        if not transactions:
            logger.info("No transactions found for organization", extra={"org_id": organization_id})
            # Still set rate limit to prevent repeated attempts
            _set_rate_limit(organization_id)
            return

        # Query service dependencies
        edges = _query_service_dependencies(organization_id, transactions)

        if not edges:
            logger.info("No service dependencies found", extra={"org_id": organization_id})
            _set_rate_limit(organization_id)
            return

        # Classify service roles
        roles = _classify_service_roles(edges)

        # Send to Seer
        _send_to_seer(organization_id, edges, roles)

        # Mark as complete
        _set_rate_limit(organization_id)

        logger.info(
            "Successfully completed service map build",
            extra={
                "org_id": organization_id,
                "edge_count": len(edges),
                "service_count": len(roles),
            },
        )

    except Exception:
        logger.exception(
            "Failed to build service map",
            extra={"org_id": organization_id},
        )


@instrumented_task(
    name="sentry.tasks.explorer_service_map.schedule_service_map_builds",
    namespace=seer_tasks,
    processing_deadline_duration=15 * 60,  # 15 minutes
)
def schedule_service_map_builds() -> None:
    """
    Main periodic task that runs daily to schedule service map builds
    for eligible organizations.

    This scheduler:
    1. Checks if service map building is enabled
    2. Gets list of eligible organizations from allowlist
    3. Dispatches worker tasks for each organization
    """
    logger.info("Started schedule_service_map_builds task")

    # Check master enable flag
    if not options.get("explorer.service_map.enable"):
        logger.info("explorer.service_map.enable flag is disabled")
        return

    # Check killswitch
    if options.get("explorer.service_map.killswitch"):
        logger.info("explorer.service_map.killswitch enabled")
        return

    # Get eligible organizations
    allowed_org_ids = options.get("explorer.service_map.allowed_organizations")

    if not allowed_org_ids:
        logger.info("No eligible organizations found for service map building")
        return

    logger.info(
        "Found eligible organizations for service map building",
        extra={"org_count": len(allowed_org_ids)},
    )

    # Dispatch tasks for each organization
    for org_id in allowed_org_ids:
        try:
            build_service_map.apply_async(
                args=[org_id],
                countdown=0,
            )
            logger.info("Dispatched service map build", extra={"org_id": org_id})
        except Exception:
            logger.exception(
                "Failed to dispatch service map build",
                extra={"org_id": org_id},
            )

    logger.info(
        "Successfully scheduled service map builds",
        extra={"total_orgs": len(allowed_org_ids)},
    )
