from __future__ import annotations

import logging

from sentry import options
from sentry.seer.explorer.index_data import get_trace_for_transaction, get_transactions_for_project
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

    # Spawn a sub-task for each project
    for project_id in enabled_project_ids:
        detect_llm_issues_for_project.delay(project_id)


@instrumented_task(
    name="sentry.tasks.llm_issue_detection.detect_llm_issues_for_project",
    namespace=issues_tasks,
    processing_deadline_duration=120,
)
def detect_llm_issues_for_project(project_id: int) -> None:
    """
    Process a single project for LLM issue detection.
    """
    transactions = get_transactions_for_project(
        project_id, limit=50, start_time_delta={"minutes": 30}
    )
    for transaction in transactions:
        trace = get_trace_for_transaction(transaction.name, transaction.project_id)
        if trace:
            logger.info("Found trace for LLM issue detection", extra={"trace_id": trace.trace_id})
