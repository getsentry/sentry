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
from django.utils import timezone as django_timezone

from sentry import options
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
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
                selected_columns=["id", "parent_span", "project.id", "project.slug", "timestamp"],
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


def _build_nodes(edges: list[dict]) -> list[dict]:
    """
    Build a node list from edges for the Seer payload in a single pass.

    Collects degree counts, slug mappings, and caller/callee relationships
    simultaneously, then classifies each service's role based on its
    in/out degree relative to the graph average:

      hub        — high in-degree and high out-degree
      caller     — high out-degree, low in-degree
      callee     — high in-degree, low out-degree
      peripheral — low in-degree and low out-degree
    """
    if not edges:
        return []

    in_degrees: dict[int, int] = defaultdict(int)
    out_degrees: dict[int, int] = defaultdict(int)
    project_slugs: dict[int, str | None] = {}
    callers_map: dict[int, set[str]] = defaultdict(set)
    callees_map: dict[int, set[str]] = defaultdict(set)

    for edge in edges:
        src_id = edge["source_project_id"]
        src_slug = edge.get("source_project_slug")
        tgt_id = edge["target_project_id"]
        tgt_slug = edge.get("target_project_slug")

        out_degrees[src_id] += 1
        in_degrees[tgt_id] += 1
        project_slugs[src_id] = src_slug
        project_slugs[tgt_id] = tgt_slug

        if tgt_slug:
            callees_map[src_id].add(tgt_slug)
        if src_slug:
            callers_map[tgt_id].add(src_slug)

    all_project_ids = set(project_slugs.keys())
    n = len(all_project_ids)
    avg_in = sum(in_degrees.values()) / n
    avg_out = sum(out_degrees.values()) / n

    nodes = []
    role_counts: dict[str, int] = defaultdict(int)

    for project_id in all_project_ids:
        in_deg = in_degrees.get(project_id, 0)
        out_deg = out_degrees.get(project_id, 0)

        if in_deg >= avg_in and out_deg >= avg_out:
            role = "hub"
        elif out_deg >= avg_out and in_deg < avg_in:
            role = "caller"
        elif in_deg >= avg_in and out_deg < avg_out:
            role = "callee"
        else:
            role = "peripheral"

        role_counts[role] += 1
        nodes.append(
            {
                "project_id": project_id,
                "project_slug": project_slugs.get(project_id),
                "role": role,
                "callers": sorted(callers_map.get(project_id, set())),
                "callees": sorted(callees_map.get(project_id, set())),
            }
        )

    logger.info(
        "Built service map nodes",
        extra={"total_services": n, **role_counts},
    )

    return nodes


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

    # TODO: Add endpoint in seer before making the actual request


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

    if not options.get("explorer.service_map.enable"):
        logger.info("explorer.service_map.enable flag is disabled")
        return

    try:
        organization = Organization.objects.get(id=organization_id)
        projects = list(
            Project.objects.filter(organization_id=organization_id, status=ObjectStatus.ACTIVE)
        )

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

        nodes = _build_nodes(edges)

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

    if not options.get("explorer.service_map.enable"):
        logger.info("explorer.service_map.enable flag is disabled")
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
