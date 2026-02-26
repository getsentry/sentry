from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta, timezone

import orjson
import sentry_sdk

from sentry import options
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.events.types import SnubaParams
from sentry.seer.explorer.context_engine_utils import (
    EVENT_COUNT_LOOKBACK_DAYS,
    ProjectEventCounts,
    get_event_counts_for_org_projects,
    get_instrumentation_types,
    get_sdk_names_for_org_projects,
    get_top_span_ops_for_org_projects,
    get_top_transactions_for_org_projects,
)
from sentry.seer.explorer.explorer_service_map_utils import (
    _build_nodes,
    _query_service_dependencies,
    _send_to_seer,
)
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import (
    make_signed_seer_api_request,
    seer_autofix_default_connection_pool,
)
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.context_engine_index.index_org_project_knowledge",
    namespace=seer_tasks,
    processing_deadline_duration=10 * 60,
)
def index_org_project_knowledge(org_id: int) -> None:
    """
    For a given org, list active projects, assemble project metadata and call
    the Seer endpoint to generate LLM summaries and embeddings.
    """
    if not options.get("explorer.context_engine_indexing.enable"):
        logger.info("explorer.context_engine_indexing.enable flag is disabled")
        return

    projects = list(
        Project.objects.filter(organization_id=org_id, status=ObjectStatus.ACTIVE).select_related(
            "organization"
        )
    )
    if not projects:
        logger.warning(
            "No projects found for index_org_project_knowledge",
            extra={"org_id": org_id},
        )
        return

    end = datetime.now(UTC)
    start = end - timedelta(days=EVENT_COUNT_LOOKBACK_DAYS)

    project_ids = [p.id for p in projects]
    event_counts = get_event_counts_for_org_projects(org_id, project_ids, start, end)
    high_volume_projects = [p for p in projects if p.id in event_counts]
    if not high_volume_projects:
        logger.info(
            "No high-volume projects found for index_org_project_knowledge",
            extra={"org_id": org_id, "num_projects": len(projects)},
        )
        return

    with sentry_sdk.start_span(op="explorer.context_engine.get_top_transactions_for_org_projects"):
        transactions_by_project = get_top_transactions_for_org_projects(
            high_volume_projects, start, end
        )
    with sentry_sdk.start_span(op="explorer.context_engine.get_top_span_ops_for_org_projects"):
        span_ops_by_project = get_top_span_ops_for_org_projects(high_volume_projects, start, end)
    with sentry_sdk.start_span(op="explorer.context_engine.get_sdk_names_for_org_projects"):
        sdk_names_by_project = get_sdk_names_for_org_projects(high_volume_projects, start, end)

    project_data = []
    for project in high_volume_projects:
        counts = event_counts.get(project.id, ProjectEventCounts())
        project_data.append(
            {
                "project_id": project.id,
                "slug": project.slug,
                "sdk_name": sdk_names_by_project.get(project.id, ""),
                "error_count": counts.error_count,
                "transaction_count": counts.transaction_count,
                "instrumentation": get_instrumentation_types(project),
                "top_transactions": transactions_by_project.get(project.id, []),
                "top_span_operations": span_ops_by_project.get(project.id, []),
            }
        )

    payload = {"org_id": org_id, "projects": project_data}
    body = orjson.dumps(payload)
    path = "/v1/automation/explorer/index/org-project-knowledge"

    try:
        response = make_signed_seer_api_request(
            seer_autofix_default_connection_pool,
            path,
            body,
            timeout=30,
        )
        if response.status >= 400:
            raise SeerApiError("Seer request failed", response.status)
    except Exception:
        logger.exception(
            "Failed to call Seer org-project-knowledge endpoint",
            extra={"org_id": org_id, "num_projects": len(project_data)},
        )
        raise

    logger.info(
        "Successfully called Seer org-project-knowledge endpoint",
        extra={"org_id": org_id, "num_projects": len(project_data)},
    )


@instrumented_task(
    name="sentry.tasks.context_engine_index.build_service_map",
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
    if not options.get("explorer.context_engine_indexing.enable"):
        logger.info("explorer.context_engine_indexing.enable flag is disabled")
        return

    logger.info(
        "Starting service map build",
        extra={"org_id": organization_id},
    )

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
        nodes = _build_nodes(edges, projects)

        if not nodes:
            logger.info("No service map data found", extra={"org_id": organization_id})
            return

        _send_to_seer(organization_id, nodes, edges)

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
    name="sentry.tasks.context_engine_index.schedule_context_engine_indexing_tasks",
    namespace=seer_tasks,
    processing_deadline_duration=30 * 60,
)
def schedule_context_engine_indexing_tasks() -> None:
    """
    Schedule context engine indexing tasks for all allowed organizations.

    Reads the org allowlist from the explorer.service_map.allowed_organizations
    option and dispatches index_org_project_knowledge and build_service_map
    for each org.
    """
    if not options.get("explorer.context_engine_indexing.enable"):
        logger.info("explorer.context_engine_indexing.enable flag is disabled")
        return

    allowed_org_ids = options.get("explorer.service_map.allowed_organizations")
    if not allowed_org_ids:
        logger.info("No allowed organizations for context engine indexing")
        return

    # TODO: as the list of allowed organizations grows, we should batch the tasks to avoid overwhelming the system
    # Also possibly consider spreading the tasks out across a day or week.
    dispatched = 0
    for org_id in allowed_org_ids:
        try:
            index_org_project_knowledge.apply_async(args=[org_id])
            build_service_map.apply_async(args=[org_id])
            dispatched += 1
        except Exception:
            logger.exception(
                "Failed to dispatch context engine tasks for org",
                extra={"org_id": org_id},
            )

    logger.info(
        "Scheduled context engine indexing tasks",
        extra={"total_org_count": len(allowed_org_ids), "dispatched": dispatched},
    )
