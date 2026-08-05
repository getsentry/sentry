from __future__ import annotations

from django.db import router, transaction

from sentry.investigations.models import (
    Investigation,
    InvestigationCell,
    InvestigationCellExecution,
    InvestigationCellExecutionStatus,
    InvestigationCellKind,
)
from sentry.investigations.services.executions import create_cell_execution


def _dependency_is_ready(cell: InvestigationCell) -> bool:
    execution = (
        cell.result_execution
        if cell.kind == InvestigationCellKind.QUERY
        else cell.content_execution
    )
    return (
        execution is not None
        and execution.status == InvestigationCellExecutionStatus.COMPLETED
        and cell.stale_at is None
    )


def schedule_eligible_auto_run_cells(
    *, investigation_id: int, user_id: int, retry_failed: bool = False
) -> None:
    investigation = Investigation.objects.get(id=investigation_id)
    projects = list(investigation.projects.order_by("id"))
    project_ids = [project.id for project in projects]
    project_slugs = [project.slug for project in projects]
    cells = list(
        investigation.cells.filter(deleted_at__isnull=True)
        .select_related(
            "current_execution", "content_execution", "result_execution", "investigation"
        )
        .prefetch_related(
            "dependency_links__depends_on__current_execution",
            "dependency_links__depends_on__content_execution",
            "dependency_links__depends_on__result_execution",
        )
        .order_by("position")
    )
    for cell in cells:
        if not cell.config.get("autoRun"):
            continue
        if cell.current_execution is not None and cell.stale_at is None:
            if not retry_failed or cell.current_execution.status not in {
                InvestigationCellExecutionStatus.FAILED,
                InvestigationCellExecutionStatus.CANCELLED,
            }:
                continue
        dependencies = [link.depends_on for link in cell.dependency_links.all()]
        if not all(_dependency_is_ready(dependency) for dependency in dependencies):
            continue
        execution, created = create_cell_execution(
            cell=cell,
            expected_investigation_version=investigation.version,
            expected_cell_version=cell.version,
            user_id=user_id,
            project_ids=project_ids,
            project_slugs=project_slugs,
            accessible_project_ids=set(project_ids),
        )
        if created:
            from sentry.tasks.seer.investigation import dispatch_investigation_execution

            transaction.on_commit(
                lambda execution_uuid=str(execution.uuid): dispatch_investigation_execution.delay(
                    execution_uuid
                ),
                using=router.db_for_write(InvestigationCellExecution),
            )
