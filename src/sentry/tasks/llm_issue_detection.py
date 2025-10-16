from __future__ import annotations

import logging

from sentry import options
from sentry.models.project import Project
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import issues_tasks

logger = logging.getLogger("sentry.tasks.llm_issue_detection")


def get_enabled_project_ids() -> list[int]:
    """
    Get the list of project IDs that are explicitly enabled for LLM detection.

    Returns the allowlist from system options.
    """
    return options.get("issue-detection.llm-detection.projects-allowlist")


@instrumented_task(
    name="sentry.tasks.llm_issue_detection.run_llm_issue_detection",
    namespace=issues_tasks,
    processing_deadline_duration=120,
)
def run_llm_issue_detection() -> None:
    """
    Main scheduled task for LLM issue detection.
    """
    if not options.get("issue-detection.llm-detection.enabled"):
        return

    enabled_project_ids = get_enabled_project_ids()
    if not enabled_project_ids:
        return

    projects = Project.objects.filter(
        id__in=enabled_project_ids,
    )

    for project in projects:
        try:
            process_project(project)
        except Exception:
            logger.exception(
                "Failed to process project for LLM detection",
                extra={"project_id": project.id, "org_id": project.organization_id},
            )


def process_project(project: Project) -> None:
    """
    Process a single project for LLM issue detection.
    """
    logger.info(
        "Processing project for LLM detection",
        extra={"project_id": project.id},
    )
