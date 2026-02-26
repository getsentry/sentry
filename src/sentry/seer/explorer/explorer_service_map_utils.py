"""
Celery Tasks for Explorer Service Map

This module contains periodic tasks that analyze distributed traces to extract
service dependency graphs and send them to Seer for hierarchical retrieval.
The service map helps Explorer understand which services call which others.
"""

from __future__ import annotations

import dataclasses
import logging
import math
from collections import defaultdict
from typing import Any, cast

import orjson
import sentry_sdk

from sentry import options
from sentry.search.eap.types import SearchResolverConfig
from sentry.search.events.types import SnubaParams
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import (
    make_signed_seer_api_request,
    seer_autofix_default_connection_pool,
)
from sentry.snuba.referrer import Referrer
from sentry.snuba.spans_rpc import Spans

logger = logging.getLogger("sentry.seer.explorer.explorer_service_map_utils")

# Seer endpoint path
SEER_SERVICE_MAP_PATH = "/v1/explorer/service-map/update"

# Maximum rows Snuba returns per query
_SNUBA_MAX_ROWS = 10000

# Maximum parent span IDs per Phase 3 resolution batch, to keep query strings bounded
_PARENT_SPAN_BATCH_SIZE = 1000


def _query_service_dependencies(snuba_params: SnubaParams) -> list[dict]:
    """
    Query segment spans and their parent spans to find cross-project dependencies.

    Uses a two-pass scan:
    - Broad scan: Org-wide query with has:parent_span (limit max_segments). Tracks which
      projects appear in results.
    - Fallback scan: If any projects had zero representation in the broad scan, run one
      additional query scoped to those uncovered projects without has:parent_span.
    - Parent resolution: Batch-resolve all collected parent_span_ids (1000 per batch) to
      determine source projects and build cross-project edges.

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
            child_project_slug = row.get("project.slug")
            parent_span_id = row.get("parent_span")
            if not child_project_id or not child_project_slug:
                continue
            covered_project_ids.add(child_project_id)
            key = (child_project_id, parent_span_id)
            if parent_span_id and key not in seen:
                seen.add(key)
                segments_by_parent[parent_span_id].append(
                    {
                        "child_project_id": child_project_id,
                        "child_project_slug": child_project_slug,
                    }
                )

    # Broad scan: Org-wide — only segments WITH a parent (cross-project candidates).
    page_limit = min(_SNUBA_MAX_ROWS, max_segments)
    with sentry_sdk.start_span(op="explorer.service_map.broad_scan") as span:
        span.set_data("limit", page_limit)
        try:
            result = Spans.run_table_query(
                params=snuba_params,
                query_string="is_transaction:true has:parent_span",
                selected_columns=["id", "parent_span", "project.id", "project.slug", "timestamp"],
                orderby=["-timestamp"],
                offset=0,
                limit=page_limit,
                referrer=Referrer.SEER_EXPLORER_SERVICE_MAP.value,
                config=SearchResolverConfig(),
            )
            rows = result.get("data", [])
            _process_rows(rows)
            span.set_data("rows_returned", len(rows))
            span.set_data("covered_projects", len(covered_project_ids))
        except Exception:
            logger.exception("Failed broad segment scan", extra={"org_id": org_id})

    # Fallback scan: One scoped query for projects with no representation in the broad scan.
    # No has:parent_span filter — broad scan to give low-traffic projects a second chance.
    uncovered = [p for p in snuba_params.projects if p.id not in covered_project_ids]
    if uncovered:
        logger.info(
            "Running fallback scan for uncovered projects",
            extra={"org_id": org_id, "uncovered_count": len(uncovered)},
        )
        uncovered_params = dataclasses.replace(snuba_params, projects=uncovered)
        page_limit = min(_SNUBA_MAX_ROWS, max_segments)
        with sentry_sdk.start_span(op="explorer.service_map.fallback_scan") as span:
            span.set_data("uncovered_projects", len(uncovered))
            span.set_data("limit", page_limit)
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
                    offset=0,
                    limit=page_limit,
                    referrer=Referrer.SEER_EXPLORER_SERVICE_MAP.value,
                    config=SearchResolverConfig(),
                )
                rows = result.get("data", [])
                _process_rows(rows)
                span.set_data("rows_returned", len(rows))
            except Exception:
                logger.exception("Failed fallback scan", extra={"org_id": org_id})

    unique_parent_span_ids = list(segments_by_parent.keys())
    if not unique_parent_span_ids:
        logger.info("No cross-project segment candidates found", extra={"org_id": org_id})
        return []

    # Parent resolution: Batch-resolve parent spans → get their project_ids.
    # Batched to keep query strings within reasonable size limits.
    edges_by_pair: dict[tuple[int, str, int, str], int] = defaultdict(int)

    with sentry_sdk.start_span(op="explorer.service_map.resolve_parents") as span:
        span.set_data("unique_parent_spans", len(unique_parent_span_ids))
        span.set_data(
            "batch_count", math.ceil(len(unique_parent_span_ids) / _PARENT_SPAN_BATCH_SIZE)
        )
        for i in range(0, len(unique_parent_span_ids), _PARENT_SPAN_BATCH_SIZE):
            batch = unique_parent_span_ids[i : i + _PARENT_SPAN_BATCH_SIZE]
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
                if not parent_span_id or not parent_project_id or not parent_project_slug:
                    continue
                for segment in segments_by_parent.get(parent_span_id, []):
                    child_project_id = segment["child_project_id"]
                    if parent_project_id != child_project_id:
                        edge_key = (
                            parent_project_id,
                            parent_project_slug,
                            child_project_id,
                            segment["child_project_slug"],
                        )
                        edges_by_pair[edge_key] += 1
        span.set_data("edges_found", len(edges_by_pair))

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


def _build_nodes(edges: list[dict], all_projects: list[Any]) -> list[dict]:
    """
    Build a node list from edges for the Seer payload in a single pass.

    all_projects is the full set of active projects for the org — projects
    that have no cross-project edges are included as "isolated" nodes so
    Seer has a complete picture of the service landscape.

    Connected projects are classified by their in/out degree relative to
    the graph average:

      hub        — high in-degree and high out-degree
      caller     — high out-degree, low in-degree
      callee     — high in-degree, low out-degree
      peripheral — low in-degree and low out-degree
      isolated   — no cross-project edges at all
    """
    in_degrees: dict[int, int] = defaultdict(int)
    out_degrees: dict[int, int] = defaultdict(int)
    project_slugs: dict[int, str] = {p.id: p.slug for p in all_projects}
    callers_map: dict[int, set[str]] = defaultdict(set)
    callees_map: dict[int, set[str]] = defaultdict(set)

    for edge in edges:
        src_id = edge["source_project_id"]
        src_slug = edge["source_project_slug"]
        tgt_id = edge["target_project_id"]
        tgt_slug = edge["target_project_slug"]

        out_degrees[src_id] += 1
        in_degrees[tgt_id] += 1
        project_slugs[src_id] = src_slug
        project_slugs[tgt_id] = tgt_slug

        callees_map[src_id].add(tgt_slug)
        callers_map[tgt_id].add(src_slug)

    connected_ids = set(in_degrees.keys()) | set(out_degrees.keys())
    n = len(connected_ids)

    if n > 0:
        avg_in = sum(in_degrees.values()) / n
        avg_out = sum(out_degrees.values()) / n
    else:
        avg_in = avg_out = 0.0

    nodes = []
    role_counts: dict[str, int] = defaultdict(int)

    for project_id, slug in project_slugs.items():
        in_deg = in_degrees.get(project_id, 0)
        out_deg = out_degrees.get(project_id, 0)

        if project_id not in connected_ids:
            role = "isolated"
        elif in_deg >= avg_in and out_deg >= avg_out:
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
                "project_slug": slug,
                "role": role,
                "callers": sorted(callers_map.get(project_id, set())),
                "callees": sorted(callees_map.get(project_id, set())),
            }
        )

    logger.info(
        "Built service map nodes",
        extra={"total_services": len(project_slugs), **role_counts},
    )

    return nodes


def _send_to_seer(org_id: int, nodes: list[dict], edges: list[dict]) -> None:
    """
    Send service map data to Seer.

    Args:
        org_id: Organization ID
        nodes: List of service nodes with role, callers, callees, project_slug, project_id
        edges: List of edges with source_project_id, source_project_slug, target_project_id,
               target_project_slug, count
    """
    # ServiceMapNode and ServiceMapEdge on the Seer side require non-null slugs.
    valid_nodes = [n for n in nodes if n.get("project_slug") is not None]
    valid_edges = [
        e
        for e in edges
        if e.get("source_project_slug") is not None and e.get("target_project_slug") is not None
    ]

    payload = {
        "organization_id": org_id,
        "nodes": valid_nodes,
        "edges": valid_edges,
    }

    body = orjson.dumps(payload)

    logger.info(
        "Sending service map to Seer",
        extra={
            "org_id": org_id,
            "node_count": len(valid_nodes),
            "edge_count": len(valid_edges),
            "payload_size_bytes": len(body),
        },
    )

    response = make_signed_seer_api_request(
        seer_autofix_default_connection_pool,
        SEER_SERVICE_MAP_PATH,
        body,
        timeout=30,
    )
    if response.status >= 400:
        raise SeerApiError("Seer service map update failed", response.status)
