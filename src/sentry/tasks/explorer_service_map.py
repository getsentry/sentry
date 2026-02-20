"""
Celery Tasks for Explorer Service Map

This module contains periodic tasks that analyze distributed traces to extract
service dependency graphs and send them to Seer for hierarchical retrieval.
The service map helps Explorer understand which services call which others.
"""

from __future__ import annotations

import dataclasses
import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import cast

import orjson
import requests
from django.conf import settings
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

# Maximum rows Snuba returns per query
_SNUBA_MAX_ROWS = 100


def _query_service_dependencies(snuba_params: SnubaParams) -> list[dict]:
    """
    Query segment spans and their parent spans to find cross-project dependencies.

    Uses a two-pass scan:
    - Phase 1: Org-wide query with has:parent_span (limit max_segments). Tracks which
      projects appear in results.
    - Phase 2: If any projects had zero representation in Phase 1, run one additional
      query scoped to those uncovered projects without has:parent_span (limit 500).
    - Phase 3: Batch-resolve all collected parent_span_ids to determine source projects
      and build cross-project edges.

    Returns:
        List of edges: [{"source_project_id": int, "source_project_slug": str,
                        "target_project_id": int, "target_project_slug": str, "count": int}]
    """
    org_id = snuba_params.organization_id
    max_edges = options.get("explorer.service_map.max_edges")
    max_segments = options.get("explorer.service_map.max_segments")

    seen: set[tuple[int, str | None]] = set()  # (child_project_id, parent_span_id)
    covered_project_ids: set[int] = set()
    segments_by_parent: dict[str, list[dict]] = defaultdict(list)

    def _process_rows(rows: list[dict]) -> None:
        for row in rows:
            child_project_id = row.get("project.id")
            parent_span_id = row.get("parent_span")
            if not child_project_id:
                continue
            covered_project_ids.add(child_project_id)
            key = (child_project_id, parent_span_id)
            if parent_span_id and key not in seen:
                seen.add(key)
                segments_by_parent[parent_span_id].append(
                    {
                        "child_project_id": child_project_id,
                        "child_project_slug": row.get("project.slug"),
                    }
                )

    # Phase 1: Org-wide scan — only segments WITH a parent (cross-project candidates).
    # Paginate in _SNUBA_MAX_ROWS pages up to max_segments total rows.
    offset = 0
    while offset < max_segments:
        page_limit = min(_SNUBA_MAX_ROWS, max_segments - offset)
        try:
            result = Spans.run_table_query(
                params=snuba_params,
                query_string="is_transaction:true has:parent_span",
                selected_columns=["id", "parent_span", "project.id", "project.slug"],
                orderby=["-timestamp"],
                offset=offset,
                limit=page_limit,
                referrer=Referrer.SEER_EXPLORER_SERVICE_MAP.value,
                config=SearchResolverConfig(),
            )
            rows = result.get("data", [])
            _process_rows(rows)
            if len(rows) < page_limit:
                break  # Last page
            offset += len(rows)
        except Exception:
            logger.exception("Failed broad segment scan", extra={"org_id": org_id})
            break

    # Phase 2: One scoped query for projects with no representation in Phase 1.
    # No has:parent_span filter — broad scan to give low-traffic projects a second chance.
    uncovered = [p for p in snuba_params.projects if p.id not in covered_project_ids]
    if uncovered:
        logger.info(
            "Running fallback scan for uncovered projects",
            extra={"org_id": org_id, "uncovered_count": len(uncovered)},
        )
        uncovered_params = dataclasses.replace(snuba_params, projects=uncovered)
        offset = 0
        while offset < max_segments:
            page_limit = min(_SNUBA_MAX_ROWS, max_segments - offset)
            try:
                result = Spans.run_table_query(
                    params=uncovered_params,
                    query_string="is_transaction:true",
                    selected_columns=[
                        "id",
                        "parent_span",
                        "project.id",
                        "project.slug",
                        "timestamp",
                    ],
                    orderby=["-timestamp"],
                    offset=offset,
                    limit=page_limit,
                    referrer=Referrer.SEER_EXPLORER_SERVICE_MAP.value,
                    config=SearchResolverConfig(),
                )
                rows = result.get("data", [])
                _process_rows(rows)
                if len(rows) < page_limit:
                    break  # Last page
                offset += len(rows)
            except Exception:
                logger.exception("Failed fallback scan", extra={"org_id": org_id})
                break

    unique_parent_span_ids = list(segments_by_parent.keys())
    if not unique_parent_span_ids:
        logger.info("No cross-project segment candidates found", extra={"org_id": org_id})
        return []

    # Phase 3: Batch-resolve parent spans → get their project_ids.
    batch_size = _SNUBA_MAX_ROWS
    edges_by_pair: dict[tuple[int, str | None, int, str | None], int] = defaultdict(int)

    for i in range(0, len(unique_parent_span_ids), batch_size):
        batch = unique_parent_span_ids[i : i + batch_size]
        span_id_filters = " OR ".join([f'id:"{sid}"' for sid in batch])
        try:
            parent_result = Spans.run_table_query(
                params=snuba_params,
                query_string=span_id_filters,
                selected_columns=["id", "project.id", "project.slug", "timestamp"],
                orderby=["-timestamp"],
                offset=0,
                limit=len(batch),
                referrer=Referrer.SEER_EXPLORER_SERVICE_MAP.value,
                config=SearchResolverConfig(),
            )
        except Exception:
            logger.exception(
                "Failed to query parent spans", extra={"org_id": org_id, "batch_index": i}
            )
            continue

        for parent_row in parent_result.get("data", []):
            parent_span_id = parent_row.get("id")
            parent_project_id = parent_row.get("project.id")
            parent_project_slug = parent_row.get("project.slug")
            if not parent_span_id or not parent_project_id:
                continue
            for segment in segments_by_parent.get(parent_span_id, []):
                child_project_id = segment["child_project_id"]
                if parent_project_id != child_project_id:
                    edge_key = (
                        parent_project_id,
                        parent_project_slug,
                        child_project_id,
                        segment.get("child_project_slug"),
                    )
                    edges_by_pair[edge_key] += 1

    edges = [
        {
            "source_project_id": src_id,
            "source_project_slug": src_slug,
            "target_project_id": tgt_id,
            "target_project_slug": tgt_slug,
            "count": count,
        }
        for (src_id, src_slug, tgt_id, tgt_slug), count in edges_by_pair.items()
    ]
    edges.sort(key=lambda x: cast(int, x["count"]), reverse=True)
    edges = edges[:max_edges]

    logger.info(
        "Extracted service dependencies", extra={"org_id": org_id, "edge_count": len(edges)}
    )
    return edges


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


def _build_nodes(edges: list[dict], roles: dict[int, str]) -> list[dict]:
    """
    Build a node list from edges and roles for the Seer payload.

    Each node describes a service with its role, caller slugs, callee slugs,
    project slug, and project ID.
    """
    project_slugs: dict[int, str | None] = {}
    callers_map: dict[int, set[str]] = defaultdict(set)
    callees_map: dict[int, set[str]] = defaultdict(set)

    for edge in edges:
        src_id = edge["source_project_id"]
        src_slug = edge.get("source_project_slug")
        tgt_id = edge["target_project_id"]
        tgt_slug = edge.get("target_project_slug")

        project_slugs[src_id] = src_slug
        project_slugs[tgt_id] = tgt_slug

        if tgt_slug:
            callees_map[src_id].add(tgt_slug)
        if src_slug:
            callers_map[tgt_id].add(src_slug)

    all_project_ids = set(project_slugs.keys()) | set(roles.keys())

    return [
        {
            "project_id": project_id,
            "project_slug": project_slugs.get(project_id),
            "role": roles.get(project_id, "isolated"),
            "callers": sorted(callers_map.get(project_id, set())),
            "callees": sorted(callees_map.get(project_id, set())),
        }
        for project_id in all_project_ids
    ]


def _send_to_seer(org_id: int, nodes: list[dict]) -> None:
    """
    Send service map data to Seer.

    Args:
        org_id: Organization ID
        nodes: List of service nodes with role, callers, callees, project_slug, project_id
    """
    payload = {
        "organization_id": org_id,
        "nodes": nodes,
        "generated_at": django_timezone.now().isoformat(),
    }

    body = orjson.dumps(payload)

    logger.info(
        "Sending service map to Seer",
        extra={
            "org_id": org_id,
            "node_count": len(nodes),
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
def build_service_map(organization_id: int, *args, **kwargs) -> None:
    """
    Build service map for a single organization and send to Seer.

    This task:
    1. Checks feature flags
    2. Queries Snuba for service dependencies
    3. Classifies service roles using graph analysis
    4. Sends data to Seer

    Args:
        organization_id: Organization ID to build map for
    """
    logger.info(
        "Starting service map build",
        extra={"org_id": organization_id},
    )

    # Check feature flags
    if not options.get("explorer.service_map.enable"):
        logger.info("explorer.service_map.enable flag is disabled")
        return

    if options.get("explorer.service_map.killswitch"):
        logger.info("explorer.service_map.killswitch enabled")
        return

    try:
        organization = Organization.objects.get(id=organization_id)
        projects = list(Project.objects.filter(organization_id=organization_id))

        if not projects:
            logger.info("No projects found for organization", extra={"org_id": organization_id})
            return

        end = datetime.now(timezone.utc)
        start = end - timedelta(hours=24)

        snuba_params = SnubaParams(
            start=start,
            end=end,
            projects=projects,
            organization=organization,
        )

        edges = _query_service_dependencies(snuba_params)

        if not edges:
            logger.info("No service dependencies found", extra={"org_id": organization_id})
            return

        roles = _classify_service_roles(edges)
        nodes = _build_nodes(edges, roles)

        _send_to_seer(organization_id, nodes)

        logger.info(
            "Successfully completed service map build",
            extra={
                "org_id": organization_id,
                "edge_count": len(edges),
                "node_count": len(nodes),
            },
        )

    except Organization.DoesNotExist:
        logger.error("Organization not found", extra={"org_id": organization_id})
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
