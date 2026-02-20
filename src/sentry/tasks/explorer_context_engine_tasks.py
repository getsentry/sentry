from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

import orjson
import requests
from django.conf import settings

from sentry.models.project import Project
from sentry.seer.explorer.context_engine_utils import (
    EVENT_COUNT_LOOKBACK_DAYS,
    get_event_counts_for_org_projects,
    get_instrumentation_types,
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
def index_org_project_knowledge(org_id: int, project_ids: list[int]) -> None:
    """
    For a given org and list of project IDs, assemble project metadata and call
    the Seer endpoint to generate LLM summaries and embeddings.
    """
    projects = list(
        Project.objects.filter(id__in=project_ids, organization_id=org_id).select_related(
            "organization"
        )
    )
    if not projects:
        logger.warning(
            "No projects found for index_org_project_knowledge",
            extra={"org_id": org_id, "project_ids": project_ids},
        )
        return

    end = datetime.now(UTC)
    start = end - timedelta(days=EVENT_COUNT_LOOKBACK_DAYS)

    event_counts = get_event_counts_for_org_projects(org_id, project_ids, start, end)
    high_volume_projects = [p for p in projects if p.id in event_counts]
    if not high_volume_projects:
        return

    transactions_by_project = get_top_transactions_for_org_projects(
        high_volume_projects, start, end
    )
    span_ops_by_project = get_top_span_ops_for_org_projects(high_volume_projects, start, end)

    project_data = []
    for project in high_volume_projects:
        error_count, transaction_count = event_counts.get(project.id, (0, 0))
        project_data.append(
            {
                "project_id": project.id,
                "slug": project.slug,
                "sdk_name": project.platform,
                "error_count": error_count,
                "transaction_count": transaction_count,
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
