from __future__ import annotations

from functools import partial

from django.db import router, transaction

from sentry.investigations.services.executions import (
    block_execution_needs_dispatch,
    create_block_execution,
)
from sentry.notebooks.models import Notebook, NotebookBlockExecution, NotebookBlockExecutionStatus


def _dispatch_after_commit(execution: NotebookBlockExecution) -> None:
    from sentry.tasks.seer.investigation import dispatch_investigation_execution

    transaction.on_commit(
        partial(dispatch_investigation_execution.delay, execution.id),
        using=router.db_for_write(NotebookBlockExecution),
    )


def schedule_eligible_auto_run_blocks(
    *, investigation_id: int, user_id: int, retry_failed: bool = False
) -> None:
    database = router.db_for_write(Notebook)
    with transaction.atomic(using=database):
        investigation = Notebook.objects.select_for_update().get(id=investigation_id)
        projects = list(investigation.projects.order_by("id"))
        project_ids = [project.id for project in projects]
        blocks = list(
            investigation.blocks.filter(deleted_at__isnull=True)
            .select_related(
                "current_execution", "content_execution", "result_execution", "notebook"
            )
            .order_by("position")
        )
        if any(
            block.current_execution is not None
            and block.current_execution.status == NotebookBlockExecutionStatus.FAILED
            for block in blocks
        ):
            return

        for block in blocks:
            if not block.config.get("autoRun"):
                continue
            if block.current_execution is not None and block.stale_at is None:
                if block_execution_needs_dispatch(block.current_execution):
                    _dispatch_after_commit(block.current_execution)
                    continue
                if not retry_failed or block.current_execution.status not in {
                    NotebookBlockExecutionStatus.FAILED,
                    NotebookBlockExecutionStatus.CANCELLED,
                }:
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
