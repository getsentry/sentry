from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

import orjson
import requests
import sentry_sdk
from django.conf import settings

from sentry.constants import ObjectStatus
from sentry.models.project import Project
from sentry.seer.explorer.context_engine_utils import (
    EVENT_COUNT_LOOKBACK_DAYS,
    ProjectEventCounts,
    get_event_counts_for_org_projects,
    get_instrumentation_types,
    get_sdk_names_for_org_projects,
    get_top_span_ops_for_org_projects,
    get_top_transactions_for_org_projects,
)
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import seer_tasks

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.explorer_context_engine_tasks.index_org_project_knowledge",
    namespace=seer_tasks,
    processing_deadline_duration=30 * 60,
)
def index_org_project_knowledge(org_id: int) -> None:
    """
    For a given org, list active projects, assemble project metadata and call
    the Seer endpoint to generate LLM summaries and embeddings.
    """
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
        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}{path}",
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(body),
            },
            timeout=30,
        )
        response.raise_for_status()
    except requests.RequestException:
        logger.exception(
            "Failed to call Seer org-project-knowledge endpoint",
            extra={"org_id": org_id, "num_projects": len(project_data)},
        )
        raise

    logger.info(
        "Successfully called Seer org-project-knowledge endpoint",
        extra={"org_id": org_id, "num_projects": len(project_data)},
    )
