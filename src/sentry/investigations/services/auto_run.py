from __future__ import annotations

from functools import partial

from django.db import router, transaction

from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockExecution,
    InvestigationBlockExecutionStatus,
    InvestigationBlockKind,
)
from sentry.investigations.services.executions import (
    block_execution_needs_dispatch,
    create_block_execution,
)


def _dependency_is_ready(block: InvestigationBlock) -> bool:
    execution = (
        block.result_execution
        if block.kind == InvestigationBlockKind.QUERY
        else block.content_execution
    )
    return (
        execution is not None
        and execution.status == InvestigationBlockExecutionStatus.COMPLETED
        and block.stale_at is None
    )


def _dispatch_after_commit(execution: InvestigationBlockExecution) -> None:
    from sentry.tasks.seer.investigation import dispatch_investigation_execution

    transaction.on_commit(
        partial(dispatch_investigation_execution.delay, execution.id),
        using=router.db_for_write(InvestigationBlockExecution),
    )


def schedule_eligible_auto_run_blocks(
    *, investigation_id: int, user_id: int, retry_failed: bool = False
) -> None:
    investigation = Investigation.objects.get(id=investigation_id)
    projects = list(investigation.projects.order_by("id"))
    project_ids = [project.id for project in projects]
    blocks = list(
        investigation.blocks.filter(deleted_at__isnull=True)
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
    for block in blocks:
        if not block.config.get("autoRun"):
            continue
        if block.current_execution is not None and block.stale_at is None:
            if block_execution_needs_dispatch(block.current_execution):
                _dispatch_after_commit(block.current_execution)
                continue
            if not retry_failed or block.current_execution.status not in {
                InvestigationBlockExecutionStatus.FAILED,
                InvestigationBlockExecutionStatus.CANCELLED,
            }:
                continue
        dependencies = [link.depends_on for link in block.dependency_links.all()]
        if not all(_dependency_is_ready(dependency) for dependency in dependencies):
            continue
        execution, created = create_block_execution(
            block=block,
            expected_investigation_version=investigation.version,
            expected_block_version=block.version,
            user_id=user_id,
            project_ids=project_ids,
            accessible_project_ids=set(project_ids),
        )
        if created:
            _dispatch_after_commit(execution)
